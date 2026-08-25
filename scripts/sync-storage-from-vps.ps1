# Sync Sport-Lead media (Stage 0.5.10 / ADR-032).
# Canonical files live on the VPS bind mount ./storage (compose.prod.yaml).
# Default: pull VPS → local storage/. Use -Push to overwrite VPS (owner only).
#
# Usage:
#   powershell -File scripts/sync-storage-from-vps.ps1 -SshHost 203.0.113.10 -RemotePath /home/deploy/sport-leads
#   powershell -File scripts/sync-storage-from-vps.ps1 -SshHost erp.example.com -RemotePath /home/deploy/sport-leads -Push

param(
    [Parameter(Mandatory = $true)]
    [string]$SshHost,

    [Parameter(Mandatory = $true)]
    [string]$RemotePath,

    [string]$SshUser = "deploy",

    [int]$SshPort = 22,

    [switch]$Push
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$localStorage = Join-Path $projectRoot "storage"
$remoteStorage = ($RemotePath.TrimEnd("/") + "/storage")
$target = "${SshUser}@${SshHost}"

New-Item -ItemType Directory -Force -Path $localStorage | Out-Null

# scp -r copies the directory itself; use trailing /. via OpenSSH.
if ($Push) {
    Write-Host "PUSH local storage/ -> ${target}:${remoteStorage} (overwrites VPS media)"
    & scp -P $SshPort -r "${localStorage}/." "${target}:${remoteStorage}/"
} else {
    Write-Host "PULL ${target}:${remoteStorage} -> local storage/"
    & scp -P $SshPort -r "${target}:${remoteStorage}/." "${localStorage}/"
}

if ($LASTEXITCODE -ne 0) {
    throw "scp exited with code $LASTEXITCODE"
}

Write-Host "Storage sync finished."
