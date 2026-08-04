# Production restore (17.2.3.2)
# Restores a custom-format dump into the running compose.prod Postgres.
#
# Usage:
#   powershell -File scripts/prod-restore-db.ps1 -DumpFile backup\sport_leads-prod-….dump
# WARNING: --clean --if-exists replaces objects in the target database.

param(
    [Parameter(Mandatory = $true)]
    [string]$DumpFile,
    [string]$EnvFile = ".env.production",
    [string]$ComposeFile = "compose.prod.yaml",
    [string]$Service = "postgres"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$resolvedDump = Resolve-Path $DumpFile
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

$leaf = Split-Path -Leaf $resolvedDump
$containerFile = "/tmp/$leaf"

Write-Host "Copying $resolvedDump into $Service ..."
docker compose -f $ComposeFile --env-file $EnvFile cp $resolvedDump.Path "${Service}:${containerFile}"
if ($LASTEXITCODE -ne 0) {
    Write-Error "docker compose cp failed with exit code $LASTEXITCODE"
}

Write-Host "Restoring into database $db (clean if-exists) ..."
docker compose -f $ComposeFile --env-file $EnvFile exec -T $Service `
    pg_restore -U $user -d $db --clean --if-exists $containerFile
# pg_restore may return 1 with non-fatal warnings; treat hard failures only.
if ($LASTEXITCODE -gt 1) {
    Write-Error "pg_restore failed with exit code $LASTEXITCODE"
}

docker compose -f $ComposeFile --env-file $EnvFile exec -T $Service rm -f $containerFile | Out-Null
Write-Host "Restore completed from $resolvedDump"
