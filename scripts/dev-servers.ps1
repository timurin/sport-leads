#Requires -Version 5.1
<#
.SYNOPSIS
  Status / stop hung / start Sport-Lead local backend (:8000) and frontend (:3001).

.EXAMPLE
  powershell -File scripts/dev-servers.ps1 -Action start
  powershell -File scripts/dev-servers.ps1 -Action status
  powershell -File scripts/dev-servers.ps1 -Action stop
  powershell -File scripts/dev-servers.ps1 -Action start -LoopbackOnly
#>
param(
  [ValidateSet("status", "stop", "start-backend", "start-frontend", "start")]
  [string]$Action = "status",

  [int]$BackendPort = 8000,
  [int]$FrontendPort = 3001,
  [int]$ReadyTimeoutSec = 60,

  # Kept for compatibility. Default start already binds 0.0.0.0 (LAN + 127.0.0.1).
  [switch]$Lan,

  # Opt out of LAN bind (loopback only).
  [switch]$LoopbackOnly
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"
$LanMode = -not $LoopbackOnly
$BindHost = if ($LanMode) { "0.0.0.0" } else { "127.0.0.1" }

function Get-LanIPv4Addresses {
  $addresses = @()
  try {
    $addresses = @(
      Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
          $_.IPAddress -notlike "127.*" -and
          $_.PrefixOrigin -ne "WellKnown" -and
          $_.IPAddress -notlike "169.254.*"
        } |
        Select-Object -ExpandProperty IPAddress -Unique
    )
  } catch {
    $addresses = @()
  }
  return $addresses
}

function Get-PreferredLanIPv4 {
  $all = @(Get-LanIPv4Addresses)
  $preferred = $all | Where-Object { $_ -like "192.168.*" } | Select-Object -First 1
  if ($preferred) { return $preferred }
  $preferred = $all | Where-Object { $_ -like "10.*" } | Select-Object -First 1
  if ($preferred) { return $preferred }
  return ($all | Select-Object -First 1)
}

function Get-DotEnvValue {
  param([string]$Name)
  $envFile = Join-Path $RepoRoot ".env"
  if (-not (Test-Path $envFile)) { return $null }
  $line = Get-Content $envFile -ErrorAction SilentlyContinue |
    Where-Object { $_ -match ("^\s*{0}\s*=" -f [regex]::Escape($Name)) } |
    Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -split "=", 2)[1].Trim().Trim('"').Trim("'")
}

function Get-MergedCorsOrigins {
  $items = @()
  $fromEnv = Get-DotEnvValue "SPORT_LEADS_CORS_ORIGINS"
  if ($fromEnv) {
    $items += ($fromEnv -split ",")
  }
  $items += @(
    "http://127.0.0.1:$FrontendPort",
    "http://localhost:$FrontendPort"
  )
  foreach ($ip in @(Get-LanIPv4Addresses)) {
    $items += ("http://{0}:{1}" -f $ip, $FrontendPort)
  }
  return (
    $items |
      ForEach-Object { $_.Trim() } |
      Where-Object { $_ } |
      Select-Object -Unique
  ) -join ","
}

function Test-DockerReady {
  try {
    $null = & docker info 2>$null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function Ensure-Postgres {
  $portText = Get-DotEnvValue "POSTGRES_PORT"
  if (-not $portText) { $portText = "5432" }
  $pgPort = [int]$portText
  $listening = @(Get-ListenersOnPort -Port $pgPort)
  if ($listening.Count -gt 0) {
    Write-Host ("Postgres already listening on :{0}" -f $pgPort)
    return
  }

  if (-not (Test-DockerReady)) {
    $dockerExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerExe) {
      Write-Host "Starting Docker Desktop..."
      Start-Process $dockerExe | Out-Null
      $deadline = (Get-Date).AddSeconds(90)
      while ((Get-Date) -lt $deadline) {
        if (Test-DockerReady) { break }
        Start-Sleep -Seconds 3
      }
    }
  }

  if (-not (Test-DockerReady)) {
    Write-Warning "Docker is not ready. Start Docker Desktop if the API cannot reach Postgres."
    return
  }

  Push-Location $RepoRoot
  try {
    & docker compose up -d postgres
  } finally {
    Pop-Location
  }
}

function Ensure-DevFirewallRules {
  if (-not $LanMode) { return }
  foreach ($port in @($BackendPort, $FrontendPort)) {
    $name = "Sport-Lead-dev-$port"
    $existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
    if ($existing) { continue }
    try {
      New-NetFirewallRule `
        -DisplayName $name `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $port `
        -Profile Private `
        -ErrorAction Stop | Out-Null
      Write-Host ("Firewall: allowed inbound TCP {0} (Private)" -f $port)
    } catch {
      Write-Host ("Firewall: could not add rule for {0} (run elevated if LAN clients are blocked)" -f $port)
    }
  }
}

function Apply-LanProcessEnv {
  if (-not $LanMode) { return }
  $env:SPORT_LEADS_CORS_ORIGINS = Get-MergedCorsOrigins
  $preferred = Get-PreferredLanIPv4
  if ($preferred) {
    $env:NEXT_PUBLIC_SPORT_LEADS_API_URL = ("http://{0}:{1}" -f $preferred, $BackendPort)
  }
}

function Get-ListenersOnPort {
  param([int]$Port)
  $rows = @()
  try {
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  } catch {
    $conns = @()
  }
  foreach ($c in @($conns)) {
    $proc = $null
    try {
      $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    } catch {}
    $rows += [pscustomobject]@{
      Port = $Port
      Pid  = $c.OwningProcess
      Name = if ($proc) { $proc.ProcessName } else { "?" }
      Path = if ($proc) { try { $proc.Path } catch { "" } } else { "" }
    }
  }
  return $rows
}

function Test-HttpReady {
  param([string]$Url)
  try {
    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    return ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500)
  } catch {
    return $false
  }
}

function Test-IsDevServerProcess {
  param($Listener)
  $name = ("{0}" -f $Listener.Name).ToLowerInvariant()
  $path = ("{0}" -f $Listener.Path).ToLowerInvariant()
  if ($name -match '^(python|pythonw|uvicorn|node|nodejs)$') { return $true }
  if ($name -like 'node*') { return $true }
  if ($path -match 'node\.exe$' -or $path -match 'python(\.exe)?$') { return $true }
  if ($path -match '\\uvicorn\\' -or $path -match '\\next\\') { return $true }
  return $false
}

function Get-ServiceSnapshot {
  param([string]$Label, [int]$Port, [string]$ReadyUrl)
  $listeners = @(Get-ListenersOnPort -Port $Port)
  $httpOk = Test-HttpReady -Url $ReadyUrl
  $hung = $false
  if ($listeners.Count -gt 0 -and -not $httpOk) { $hung = $true }
  if ($listeners.Count -gt 1) { $hung = $true }
  foreach ($l in $listeners) {
    if (-not (Test-IsDevServerProcess -Listener $l)) {
      # Foreign owner - report, do not auto-kill later without Force semantics
    }
  }
  [pscustomobject]@{
    Label     = $Label
    Port      = $Port
    ReadyUrl  = $ReadyUrl
    HttpOk    = $httpOk
    Hung      = $hung
    Listeners = $listeners
  }
}

function Write-Status {
  $backend = Get-ServiceSnapshot -Label "backend" -Port $BackendPort -ReadyUrl "http://127.0.0.1:$BackendPort/docs"
  if (-not $backend.HttpOk) {
    $alt = Test-HttpReady -Url "http://127.0.0.1:$BackendPort/health"
    if ($alt) { $backend.HttpOk = $true; $backend.Hung = ($backend.Listeners.Count -gt 0 -and -not $alt) }
  }
  $frontend = Get-ServiceSnapshot -Label "frontend" -Port $FrontendPort -ReadyUrl "http://127.0.0.1:$FrontendPort/"

  foreach ($s in @($backend, $frontend)) {
    $pids = ($s.Listeners | ForEach-Object { "{0}({1})" -f $_.Pid, $_.Name }) -join ", "
    if (-not $pids) { $pids = "-" }
    $state = if ($s.HttpOk) { "ready" } elseif ($s.Hung) { "HUNG" } elseif ($s.Listeners.Count -gt 0) { "listening" } else { "down" }
    Write-Host ("{0,-9} port={1} state={2} listeners={3}" -f $s.Label, $s.Port, $state, $pids)
  }

  $envPath = Join-Path $RepoRoot ".env"
  Write-Host (".env      {0}" -f $(if (Test-Path $envPath) { "present" } else { "MISSING" }))
  return @{ Backend = $backend; Frontend = $frontend }
}

function Stop-DevListeners {
  param([int[]]$Ports)
  $stopped = @()
  foreach ($port in $Ports) {
    $listeners = @(Get-ListenersOnPort -Port $port)
    foreach ($l in $listeners) {
      if (-not (Test-IsDevServerProcess -Listener $l)) {
        Write-Warning ("Skip PID {0} on :{1} ({2}) - not a known dev-server process" -f $l.Pid, $port, $l.Name)
        continue
      }
      $targetPids = @($l.Pid)
      # uvicorn --reload: parent may be dead while spawn child still serves the port
      # (Get-NetTCPConnection can keep reporting the dead parent PID).
      try {
        $orphans = Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
          Where-Object {
            $_.CommandLine -and
            $_.CommandLine -like "*multiprocessing.spawn*" -and
            $_.CommandLine -like ("*parent_pid={0}*" -f $l.Pid)
          }
        foreach ($o in @($orphans)) {
          $targetPids += [int]$o.ProcessId
        }
      } catch {}
      foreach ($pidToStop in ($targetPids | Select-Object -Unique)) {
        try {
          $proc = Get-Process -Id $pidToStop -ErrorAction SilentlyContinue
          $procName = if ($proc) { $proc.ProcessName } else { $l.Name }
          Stop-Process -Id $pidToStop -Force -ErrorAction Stop
          $stopped += "pid=$pidToStop name=$procName port=$port"
          Write-Host ("Stopped {0}" -f $stopped[-1])
        } catch {
          Write-Warning ("Failed to stop PID {0}: {1}" -f $pidToStop, $_.Exception.Message)
        }
      }
    }
  }
  Start-Sleep -Seconds 1
  if ($stopped.Count -eq 0) {
    Write-Host "Nothing stopped (ports free or foreign owners only)."
  }
}

function Wait-HttpReady {
  param([string]$Url, [int]$TimeoutSec)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpReady -Url $Url) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

function Start-Backend {
  if (-not (Test-Path (Join-Path $RepoRoot ".env"))) {
    throw ".env missing at repo root. Copy .env.example and set POSTGRES_PASSWORD."
  }
  $existing = @(Get-ListenersOnPort -Port $BackendPort)
  if ($existing.Count -gt 0) {
    if (Test-HttpReady -Url "http://127.0.0.1:$BackendPort/docs" -or (Test-HttpReady -Url "http://127.0.0.1:$BackendPort/health")) {
      Write-Host "Backend already ready on :$BackendPort"
      return
    }
    throw "Port $BackendPort occupied but not ready. Run -Action stop first."
  }

  $logDir = Join-Path $RepoRoot "logs"
  if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
  $outLog = Join-Path $logDir "uvicorn.out.log"
  $errLog = Join-Path $logDir "uvicorn.err.log"

  $proc = Start-Process -FilePath "python" `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--reload", "--host", $BindHost, "--port", "$BackendPort") `
    -WorkingDirectory $BackendDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -PassThru

  Write-Host ("Started backend PID={0} host={1} (logs: {2})" -f $proc.Id, $BindHost, $logDir)
  $ok = (Wait-HttpReady -Url "http://127.0.0.1:$BackendPort/docs" -TimeoutSec $ReadyTimeoutSec) -or `
        (Wait-HttpReady -Url "http://127.0.0.1:$BackendPort/health" -TimeoutSec 5)
  if (-not $ok) {
    throw "Backend did not become ready within ${ReadyTimeoutSec}s. See $errLog"
  }
  Write-Host ("Backend ready: http://127.0.0.1:{0} (bind {1})" -f $BackendPort, $BindHost)
  if ($LanMode) {
    foreach ($ip in @(Get-LanIPv4Addresses)) {
      Write-Host ("  LAN backend: http://{0}:{1}" -f $ip, $BackendPort)
    }
  }
}

function Start-Frontend {
  $existing = @(Get-ListenersOnPort -Port $FrontendPort)
  if ($existing.Count -gt 0) {
    if (Test-HttpReady -Url "http://127.0.0.1:$FrontendPort/") {
      Write-Host "Frontend already ready on :$FrontendPort"
      return
    }
    throw "Port $FrontendPort occupied but not ready. Run -Action stop first."
  }

  $logDir = Join-Path $RepoRoot "logs"
  if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
  $outLog = Join-Path $logDir "next.out.log"
  $errLog = Join-Path $logDir "next.err.log"

  $proc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList @("/c", "npm", "run", "dev", "--", "-H", $BindHost, "-p", "$FrontendPort") `
    -WorkingDirectory $FrontendDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -PassThru

  Write-Host ("Started frontend PID={0} host={1} (logs: {2})" -f $proc.Id, $BindHost, $logDir)
  $ok = Wait-HttpReady -Url "http://127.0.0.1:$FrontendPort/" -TimeoutSec $ReadyTimeoutSec
  if (-not $ok) {
    throw "Frontend did not become ready within ${ReadyTimeoutSec}s. See $errLog"
  }
  Write-Host ("Frontend ready: http://127.0.0.1:{0} (bind {1})" -f $FrontendPort, $BindHost)
  if ($LanMode) {
    foreach ($ip in @(Get-LanIPv4Addresses)) {
      Write-Host ("  LAN frontend: http://{0}:{1}" -f $ip, $FrontendPort)
    }
    Write-Host ("  CORS merged for loopback + LAN origins on :{0}" -f $FrontendPort)
    Write-Host ("  Windows firewall: inbound TCP {0} and {1} on Private (rule added when possible)." -f $FrontendPort, $BackendPort)
    Write-Host "  Threat: 0.0.0.0 bind is trusted-LAN only - not public internet / production Caddy."
  }
}

switch ($Action) {
  "status" {
    [void](Write-Status)
  }
  "stop" {
    Stop-DevListeners -Ports @($BackendPort, $FrontendPort)
    [void](Write-Status)
  }
  "start-backend" {
    Ensure-Postgres
    Ensure-DevFirewallRules
    Apply-LanProcessEnv
    Start-Backend
    [void](Write-Status)
  }
  "start-frontend" {
    Ensure-DevFirewallRules
    Apply-LanProcessEnv
    Start-Frontend
    [void](Write-Status)
  }
  "start" {
    Ensure-Postgres
    Ensure-DevFirewallRules
    Apply-LanProcessEnv
    Start-Backend
    Start-Frontend
    [void](Write-Status)
  }
}
