# Dev/staging PostgreSQL backup (roadmap 0.3.3).
# Requires pg_dump in PATH and variables from .env (see .env.example).

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

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $projectRoot "backup"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$outFile = Join-Path $backupDir "sport_leads-$timestamp.dump"

$env:PGPASSWORD = $password

& pg_dump `
    -h $hostName `
    -p $port `
    -U $user `
    -d $db `
    -Fc `
    -f $outFile

if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump failed with exit code $LASTEXITCODE"
}

Write-Host "Backup written to $outFile"
