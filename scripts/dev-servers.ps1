#Requires -Version 5.1
<#
.SYNOPSIS
  Status / stop hung / start Sport-Lead local backend (:8000) and frontend (:3000).

.EXAMPLE
  powershell -File scripts/dev-servers.ps1 -Action status
  powershell -File scripts/dev-servers.ps1 -Action stop
  powershell -File scripts/dev-servers.ps1 -Action start
#>
param(
  [ValidateSet("status", "stop", "start-backend", "start-frontend", "start")]
  [string]$Action = "status",

  [int]$BackendPort = 8000,
  [int]$FrontendPort = 3000,
  [int]$ReadyTimeoutSec = 45
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"

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
      try {
        Stop-Process -Id $l.Pid -Force -ErrorAction Stop
        $stopped += "pid=$($l.Pid) name=$($l.Name) port=$port"
        Write-Host ("Stopped {0}" -f $stopped[-1])
      } catch {
        Write-Warning ("Failed to stop PID {0}: {1}" -f $l.Pid, $_.Exception.Message)
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
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "$BackendPort") `
    -WorkingDirectory $BackendDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -PassThru

  Write-Host ("Started backend PID={0} (logs: {1})" -f $proc.Id, $logDir)
  $ok = (Wait-HttpReady -Url "http://127.0.0.1:$BackendPort/docs" -TimeoutSec $ReadyTimeoutSec) -or `
        (Wait-HttpReady -Url "http://127.0.0.1:$BackendPort/health" -TimeoutSec 5)
  if (-not $ok) {
    throw "Backend did not become ready within ${ReadyTimeoutSec}s. See $errLog"
  }
  Write-Host "Backend ready: http://127.0.0.1:$BackendPort"
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
    -ArgumentList @("/c", "npm", "run", "dev", "--", "-H", "127.0.0.1", "-p", "$FrontendPort") `
    -WorkingDirectory $FrontendDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -PassThru

  Write-Host ("Started frontend PID={0} (logs: {1})" -f $proc.Id, $logDir)
  $ok = Wait-HttpReady -Url "http://127.0.0.1:$FrontendPort/" -TimeoutSec $ReadyTimeoutSec
  if (-not $ok) {
    throw "Frontend did not become ready within ${ReadyTimeoutSec}s. See $errLog"
  }
  Write-Host "Frontend ready: http://127.0.0.1:$FrontendPort"
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
    Start-Backend
    [void](Write-Status)
  }
  "start-frontend" {
    Start-Frontend
    [void](Write-Status)
  }
  "start" {
    Start-Backend
    Start-Frontend
    [void](Write-Status)
  }
}
