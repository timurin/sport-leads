# Restore dev/staging PostgreSQL from a pg_dump custom-format file (roadmap 0.3.3).
# Usage: .\scripts\restore_db.ps1 -DumpFile backup\sport_leads-YYYYMMDD-HHmmss.dump

param(
    [Parameter(Mandatory = $true)]
    [string] $DumpFile
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "Env:$name" -Value $value
        }
    }
}

$resolvedDump = Resolve-Path $DumpFile

$hostName = $env:POSTGRES_HOST
if (-not $hostName) { $hostName = "localhost" }
$port = $env:POSTGRES_PORT
if (-not $port) { $port = "5432" }
$db = $env:POSTGRES_DB
if (-not $db) { $db = "sport_leads" }
$user = $env:POSTGRES_USER
if (-not $user) { $user = "sport_leads" }
$password = $env:POSTGRES_PASSWORD

if (-not $password) {
    Write-Error "POSTGRES_PASSWORD is not set. Copy .env.example to .env and configure it."
}

$env:PGPASSWORD = $password

& pg_restore `
    -h $hostName `
    -p $port `
    -U $user `
    -d $db `
    --clean `
    --if-exists `
    $resolvedDump

if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_restore failed with exit code $LASTEXITCODE"
}

Write-Host "Restore completed from $resolvedDump"
