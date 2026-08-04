#!/usr/bin/env bash
# Production restore (17.2.3.2)
# Usage: ./scripts/prod-restore-db.sh backup/sport_leads-prod-….dump
# WARNING: --clean --if-exists replaces objects in the target database.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DUMP_FILE="${1:-}"
if [[ -z "$DUMP_FILE" || ! -f "$DUMP_FILE" ]]; then
  echo "Usage: $0 path/to/dump.dump" >&2
  exit 2
fi

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.prod.yaml}"
SERVICE="${SERVICE:-postgres}"

DB="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r' | tr -d '"')"
USER="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r' | tr -d '"')"
DB="${DB:-sport_leads}"
USER="${USER:-sport_leads}"

LEAF="$(basename "$DUMP_FILE")"
CONTAINER_FILE="/tmp/${LEAF}"

echo "Copying ${DUMP_FILE} into ${SERVICE} ..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" cp \
  "$DUMP_FILE" "${SERVICE}:${CONTAINER_FILE}"

echo "Restoring into database ${DB} (clean if-exists) ..."
set +e
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T "$SERVICE" \
  pg_restore -U "$USER" -d "$DB" --clean --if-exists "$CONTAINER_FILE"
rc=$?
set -e
if [[ "$rc" -gt 1 ]]; then
  echo "pg_restore failed with exit code ${rc}" >&2
  exit "$rc"
fi

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T "$SERVICE" \
  rm -f "$CONTAINER_FILE" >/dev/null || true

echo "Restore completed from ${DUMP_FILE}"
