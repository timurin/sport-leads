# Production deploy — VPS bootstrap (17.2.1.3)

**Code:** Sport-Lead `17.2.1`  
**Stack:** `compose.prod.yaml` + `docker/*` + Caddy TLS

## Prerequisites (owner)

1. VPS with public IPv4, Ubuntu 22.04+ (or equivalent)
2. DNS `A`/`AAAA` for `SPORT_LEADS_DOMAIN` → VPS IP
3. Ports **80** and **443** open inbound
4. Docker Engine + Docker Compose plugin installed on the host

## One-time host setup

```bash
# install Docker (official docs) then:
sudo usermod -aG docker "$USER"   # re-login
mkdir -p ~/sport-leads && cd ~/sport-leads
# copy repo (git clone or rsync) including compose.prod.yaml and docker/
cp .env.production.example .env.production
$EDITOR .env.production   # set POSTGRES_PASSWORD, AUTH_BOOTSTRAP_*, SPORT_LEADS_DOMAIN
```

## Bring up

```bash
docker compose -f compose.prod.yaml --env-file .env.production up -d --build
docker compose -f compose.prod.yaml --env-file .env.production ps
curl -fsS "https://$SPORT_LEADS_DOMAIN/healthz"   # Caddy
# Workspace: https://$SPORT_LEADS_DOMAIN/login
```

API and Postgres are **not** published. Next talks to API at `http://api:8000` inside the network. Migrations run on API container start (`alembic upgrade head`).

## TLS

Caddy requests Let's Encrypt certificates when `SPORT_LEADS_DOMAIN` is a real hostname reachable on :80. For `localhost` smoke, HTTP only is enough; do not expect a public cert.

## Rollback / stop

```bash
docker compose -f compose.prod.yaml --env-file .env.production down
# volumes (postgres_data, caddy_data) retained unless -v
```

## Out of scope here

- CI/CD deploy pipeline → covered in `17.2.2` (`docs/ops/production-17-2-2.md`)
- Backup/restore runbooks → `17.2.3` (dev scripts already in `scripts/backup_db.ps1`)
- Secrets manager / monitoring agents → later ops

## Evidence paths

- `compose.prod.yaml`
- `docker/backend/Dockerfile`, `docker/frontend/Dockerfile`, `docker/Caddyfile`
- `.env.production.example`
