#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for Sport-Lead (install only — no long-running servers).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DEBIAN_FRONTEND=noninteractive

if ! command -v python3.13 >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq software-properties-common
  sudo add-apt-repository -y ppa:deadsnakes/ppa >/dev/null 2>&1 || true
  sudo apt-get update -qq
  sudo apt-get install -y -qq python3.13 python3.13-venv python3.13-dev build-essential libpq-dev
fi

if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql postgresql-contrib
fi

# Native Postgres (Docker overlay may be unavailable in nested Cloud VMs)
sudo pg_ctlcluster 16 main start >/dev/null 2>&1 || true

if [ ! -f "$ROOT/.env" ]; then
  cat > "$ROOT/.env" <<'EOF'
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=sport_leads
POSTGRES_USER=sport_leads
POSTGRES_PASSWORD=sport_leads_local_dev
TZ=Europe/Moscow
LOG_LEVEL=INFO
LOG_FORMAT=text
AUTH_SESSION_TTL_HOURS=12
AUTH_SESSION_MAX_HOURS=24
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAMESITE=lax
SPORT_LEADS_CORS_ORIGINS=http://127.0.0.1:3001,http://localhost:3001
SPORT_LEADS_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SPORT_LEADS_API_URL=http://127.0.0.1:8000
PGADMIN_EMAIL=admin@example.local
PGADMIN_PASSWORD=sport_leads_local_dev
PGADMIN_PORT=5050
EOF
fi

# shellcheck disable=SC1091
set -a; source "$ROOT/.env"; set +a

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL >/dev/null
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${POSTGRES_USER}') THEN
    CREATE ROLE ${POSTGRES_USER} LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  ELSE
    ALTER ROLE ${POSTGRES_USER} WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
END
\$\$;
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'" | grep -q 1; then
  sudo -u postgres createdb -O "${POSTGRES_USER}" "${POSTGRES_DB}"
fi
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};" >/dev/null
sudo -u postgres psql -d "${POSTGRES_DB}" -c "GRANT ALL ON SCHEMA public TO ${POSTGRES_USER};" >/dev/null

python3.13 -m venv "$ROOT/.venv"
"$ROOT/.venv/bin/pip" install -U pip wheel >/dev/null
"$ROOT/.venv/bin/pip" install -r "$ROOT/backend/requirements.txt"
"$ROOT/.venv/bin/pip" install pytest httpx >/dev/null

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
if command -v nvm >/dev/null 2>&1; then
  nvm install 22 >/dev/null
  nvm use 22 >/dev/null
fi

mkdir -p "$ROOT/storage" "$ROOT/logs"
(cd "$ROOT/frontend" && npm ci)

(
  cd "$ROOT/backend"
  set -a; source "$ROOT/.env"; set +a
  export PATH="$ROOT/.venv/bin:$PATH"
  alembic upgrade head
)

echo "cloud-agent-install: ok"
