# Production pipeline, monitoring, and logs (17.2.2)

**Depends on:** `17.2.1` stack (`compose.prod.yaml`, Caddy)

## 1. Deploy pipeline (GitHub Actions)

Workflow: `.github/workflows/deploy-production.yml`  
Trigger: **Actions → Deploy production → Run workflow** (`workflow_dispatch` only).

### GitHub setup (owner)

1. Create environment **`production`** (Settings → Environments) with required reviewers if desired.
2. Add repository secrets:

| Secret | Meaning |
|--------|---------|
| `PROD_SSH_HOST` | VPS hostname or IP |
| `PROD_SSH_USER` | SSH user (e.g. `deploy`) |
| `PROD_SSH_KEY` | Private key (PEM) for that user |
| `PROD_APP_PATH` | Absolute path to repo on VPS (e.g. `/home/deploy/sport-leads`) |
| `PROD_SSH_PORT` | Optional; default `22` |

3. On the VPS: repo cloned, `.env.production` present, Docker installed (see `production-17-2-1.md`).
4. Ensure `git` remote is reachable with the deploy key / credentials used by the SSH user.

### What the job does

1. SSH into the host  
2. `git fetch` + checkout requested ref (unless skip_pull)  
3. `docker compose -f compose.prod.yaml --env-file .env.production up -d --build`  
4. Probe `https://$SPORT_LEADS_DOMAIN/healthz`, `/health`, `/health/ready`

Dev CI (`checks.yml` / `0.2.3`) stays separate and is not a deploy gate in Actions — run checks on `main` before dispatching deploy.

## 2. Centralized monitoring (health)

| URL | Meaning |
|-----|---------|
| `GET /healthz` | Caddy edge alive |
| `GET /health` | FastAPI liveness (proxied) |
| `GET /health/ready` | FastAPI + DB ready (proxied) |

Scripts:

```powershell
powershell -File scripts/prod-health-check.ps1 -BaseUrl https://erp.example.com
```

```bash
bash scripts/prod-health-check.sh https://erp.example.com
```

Point any uptime provider (UptimeRobot, Better Stack, …) at these three URLs. Full APM/Prometheus is out of MVP scope.

## 3. Log aggregation

- API uses `LOG_FORMAT=json` in production (compose default).
- All compose services use Docker `json-file` driver with rotation (`max-size=20m`, `max-file=5`).
- On the host:

```bash
docker compose -f compose.prod.yaml --env-file .env.production logs -f --tail=200 api
docker compose -f compose.prod.yaml --env-file .env.production logs --since=1h
```

Optional later: ship rotated json-file / journald to Loki/ELK — not required to close `17.2.2`.

## Evidence

- `.github/workflows/deploy-production.yml`
- `docker/Caddyfile` health proxies
- `compose.prod.yaml` logging anchors
- `scripts/prod-health-check.ps1`, `scripts/prod-health-check.sh`
- Task: `docs/tasks/v0.9.0-stage-17.2.2-production-pipeline.md`
