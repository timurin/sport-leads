#!/usr/bin/env bash
# Production health probe (17.2.2.2)
# Usage: ./scripts/prod-health-check.sh https://erp.example.com

set -euo pipefail

BASE_URL="${1:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "Usage: $0 https://your.domain" >&2
  exit 2
fi

BASE_URL="${BASE_URL%/}"

probe() {
  local path="$1"
  local url="${BASE_URL}${path}"
  echo "GET ${url}"
  curl -fsS --max-time 15 "$url" >/dev/null
  echo "  OK"
}

probe /healthz
probe /health
probe /health/ready
echo "All production health probes passed."
