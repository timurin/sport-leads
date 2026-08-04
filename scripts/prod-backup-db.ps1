# Production backup (17.2.3.1)
# Dumps Postgres from the running compose.prod stack into ./backup/
#
# Usage (on the VPS, from repo root):
#   powershell -File scripts/prod-backup-db.ps1
# Optional: -EnvFile .env.production -ComposeFile compose.prod.yaml

param(
    [string]$EnvFile = ".env.production",
    [string]$ComposeFile = "compose.prod.yaml",
    [string]$Service = "postgres"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$envPath = Join-Path $projectRoot $EnvFile
if (-not (Test-Path $envPath)) {
    Write-Error "Env file not found: $envPath"
}

$db = "sport_leads"
$user = "sport_leads"
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*POSTGRES_DB=(.*)$') { $db = $matches[1].Trim().Trim('"') }
    if ($_ -match '^\s*POSTGRES_USER=(.*)$') { $user = $matches[1].Trim().Trim('"') }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $projectRoot "backup"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$hostFile = Join-Path $backupDir "sport_leads-prod-$timestamp.dump"
$containerFile = "/tmp/sport_leads-prod-$timestamp.dump"

Write-Host "Creating dump inside $Service ..."
docker compose -f $ComposeFile --env-file $EnvFile exec -T $Service `
    pg_dump -U $user -d $db -Fc -f $containerFile
if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump failed with exit code $LASTEXITCODE"
}

Write-Host "Copying dump to $hostFile ..."
docker compose -f $ComposeFile --env-file $EnvFile cp "${Service}:${containerFile}" $hostFile
if ($LASTEXITCODE -ne 0) {
    Write-Error "docker compose cp failed with exit code $LASTEXITCODE"
}

docker compose -f $ComposeFile --env-file $EnvFile exec -T $Service rm -f $containerFile | Out-Null
Write-Host "Backup written to $hostFile"
