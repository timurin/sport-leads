# Production health probe (17.2.2.2)
#
# Usage:
#   powershell -File scripts/prod-health-check.ps1 -BaseUrl https://erp.example.com
# Exit 0 when /healthz, /health, and /health/ready all succeed.

param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [int]$TimeoutSec = 15
)

$ErrorActionPreference = "Stop"
$root = $BaseUrl.TrimEnd("/")

function Test-Endpoint([string]$Path) {
    $uri = "$root$Path"
    Write-Host "GET $uri"
    $response = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec $TimeoutSec
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
        throw "Unexpected status $($response.StatusCode) for $Path"
    }
    Write-Host "  OK $($response.StatusCode)"
}

Test-Endpoint "/healthz"
Test-Endpoint "/health"
Test-Endpoint "/health/ready"
Write-Host "All production health probes passed."
