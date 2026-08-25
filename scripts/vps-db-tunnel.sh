#!/usr/bin/env bash
# SSH tunnel: local :5433 → VPS loopback Postgres :5432 (Stage 0.5 / ADR-032).
# Usage: ./scripts/vps-db-tunnel.sh USER@HOST

set -euo pipefail

TARGET="${1:-}"
LOCAL_PORT="${LOCAL_PORT:-5433}"
REMOTE_PORT="${REMOTE_PORT:-5432}"

if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 user@vps-host" >&2
  exit 2
fi

echo "Tunnel 127.0.0.1:${LOCAL_PORT} -> ${TARGET}:${REMOTE_PORT} (VPS loopback)"
echo "Do not point pytest / alembic / check_project.py at port ${LOCAL_PORT}."
exec ssh -N -o ExitOnForwardFailure=yes -L "${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT}" "$TARGET"
