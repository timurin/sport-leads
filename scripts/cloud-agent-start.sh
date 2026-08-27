#!/usr/bin/env bash
# Per-boot start for Sport-Lead Cloud Agent: Postgres + backend :8000 + frontend :3001.
# Keeps a foreground waiter so the start process does not exit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

sudo pg_ctlcluster 16 main start >/dev/null 2>&1 || true

# shellcheck disable=SC1091
set -a; source "$ROOT/.env"; set +a
export PATH="$ROOT/.venv/bin:$PATH"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
command -v nvm >/dev/null 2>&1 && nvm use 22 >/dev/null || true

mkdir -p "$ROOT/logs"

if ! curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
  (
    cd "$ROOT/backend"
    set -a; source "$ROOT/.env"; set +a
    nohup uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 \
      >"$ROOT/logs/backend.log" 2>&1 &
    echo $! >"$ROOT/logs/backend.pid"
  )
fi

if ! curl -sf -o /dev/null http://127.0.0.1:3001 >/dev/null 2>&1; then
  (
    cd "$ROOT/frontend"
    export SPORT_LEADS_API_URL="${SPORT_LEADS_API_URL:-http://127.0.0.1:8000}"
    export NEXT_PUBLIC_SPORT_LEADS_API_URL="${NEXT_PUBLIC_SPORT_LEADS_API_URL:-http://127.0.0.1:8000}"
    nohup npm run dev -- -H 0.0.0.0 -p 3001 \
      >"$ROOT/logs/frontend.log" 2>&1 &
    echo $! >"$ROOT/logs/frontend.pid"
  )
fi

# Wait until ready, then stay attached
for i in $(seq 1 60); do
  be=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/health 2>/dev/null || echo 000)
  fe=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001 2>/dev/null || echo 000)
  if [ "$be" = "200" ] && [[ "$fe" =~ ^[23] ]]; then
    echo "cloud-agent-start: backend http://127.0.0.1:8000 frontend http://127.0.0.1:3001"
    break
  fi
  sleep 2
done

# Keep start process alive (Cloud Agent start contract)
tail -F "$ROOT/logs/backend.log" "$ROOT/logs/frontend.log"
