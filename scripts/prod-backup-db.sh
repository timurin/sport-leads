#!/usr/bin/env bash
# Production backup (17.2.3.1) — dump Postgres from compose.prod stack.
# Usage: ./scripts/prod-backup-db.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.prod.yaml}"
SERVICE="${SERVICE:-postgres}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

DB="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r' | tr -d '"')"
USER="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r' | tr -d '"')"
DB="${DB:-sport_leads}"
USER="${USER:-sport_leads}"

mkdir -p backup
STAMP="$(date +%Y%m%d-%H%M%S)"
HOST_FILE="backup/sport_leads-prod-${STAMP}.dump"
CONTAINER_FILE="/tmp/sport_leads-prod-${STAMP}.dump"

echo "Creating dump inside ${SERVICE} ..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T "$SERVICE" \
  pg_dump -U "$USER" -d "$DB" -Fc -f "$CONTAINER_FILE"

echo "Copying dump to ${HOST_FILE} ..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" cp \
  "${SERVICE}:${CONTAINER_FILE}" "$HOST_FILE"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T "$SERVICE" \
  rm -f "$CONTAINER_FILE" >/dev/null || true

echo "Backup written to ${HOST_FILE}"
