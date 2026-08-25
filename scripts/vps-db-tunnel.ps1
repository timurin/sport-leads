# SSH tunnel: local :5433 → VPS loopback Postgres :5432 (Stage 0.5 / ADR-032).
# Keeps Docker Postgres on :5432 free for pytest / check_project.py.
#
# Usage:
#   powershell -File scripts/vps-db-tunnel.ps1 -SshHost 203.0.113.10
#   powershell -File scripts/vps-db-tunnel.ps1 -SshHost erp.example.com -SshUser deploy
#
# Leave this window open. Stop with Ctrl+C.

param(
    [Parameter(Mandatory = $true)]
    [string]$SshHost,

    [string]$SshUser = "deploy",

    [int]$SshPort = 22,

    [int]$LocalPort = 5433,

    [int]$RemotePort = 5432
)

$ErrorActionPreference = "Stop"

Write-Host "Tunnel 127.0.0.1:${LocalPort} -> ${SshUser}@${SshHost}:${RemotePort} (loopback on VPS)"
Write-Host "Do not point pytest / alembic / check_project.py at port ${LocalPort}."
Write-Host "Stop with Ctrl+C."

& ssh -N -o ExitOnForwardFailure=yes -p $SshPort -L "${LocalPort}:127.0.0.1:${RemotePort}" "${SshUser}@${SshHost}"
if ($LASTEXITCODE -ne 0) {
    throw "ssh tunnel exited with code $LASTEXITCODE"
}
