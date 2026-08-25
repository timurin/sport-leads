# Canonical VPS workflow — live apply (`0.5`)

**Code:** `SL-VPS-CANONICAL-v1` / ADR-032  
**Extends:** `docs/ops/production-17-2-1.md`, `production-17-2-2.md`, `production-17-2-3.md`  
**Do not reopen:** `17.2.1`–`17.2.3` in-repo checkboxes

Owner supplies: IPv4, SSH key, `SPORT_LEADS_DOMAIN`, GitHub access. Agent cannot finish host steps without them.

## 0. Gate (`0.5.3`)

1. Confirm `git status` has no Spec/inventory WIP left uncommitted.  
2. `git push origin main` (owner).  
3. Only then clone on the VPS.

## 1. Host OS — Ubuntu 26.04 (`0.5.4.1`)

Target host is **Ubuntu 26.04** (confirmed owner). The Sport-Lead app does **not** run as native systemd Python/Node: only Docker Engine + Compose, then `compose.prod.yaml` (Python 3.13 and Node 22 stay inside images).

Preferred: copy the script from the Windows repo **before** clone (does not need `0.5.3`), then SSH:

```powershell
scp scripts/vps-bootstrap-ubuntu-26.04.sh USER@VPS_IP:~/
ssh USER@VPS_IP
sudo bash ~/vps-bootstrap-ubuntu-26.04.sh
# log out and back in so group docker applies
```

The script installs Docker CE from Docker's apt repo (deb822 `docker.sources`, suite `$UBUNTU_CODENAME` / `resolute` on 26.04), git, UFW `22/80/443`, TZ `Europe/Moscow`. It refuses snap Docker and does **not** install host Python/Node.

After `0.5.3` is on `origin/main`, the same file is in the clone at `scripts/vps-bootstrap-ubuntu-26.04.sh`.

If Docker's apt repo has no packages for this codename, follow [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/) — do **not** use `snap install docker`. Do not `apt install python3-pip` / Node for the ERP on the host.

## 1a. Clone and env (`0.5.4`)

After `0.5.4.1` and a new SSH login (docker group). Add a GitHub **deploy key** (read-only) for `timurin/sport-leads` on this host, then:

```bash
mkdir -p ~/sport-leads && cd ~/sport-leads
git clone git@github.com:timurin/sport-leads.git .
git checkout main
cp .env.production.example .env.production
# edit: POSTGRES_PASSWORD, AUTH_BOOTSTRAP_*
# SPORT_LEADS_DOMAIN=sport-lead.ru and PUBLIC_APP_ORIGIN=https://sport-lead.ru are already in the example
```

UFW must **not** allow `5432` from WAN. Compose binds Postgres to loopback only.

## 1b. Domain `sport-lead.ru` (`0.5.6.1`) — before TLS

The hostname is registered (hosting panel) but **not yet** pointed at the VPS. Do this at the **registrar / DNS hosting**, not inside Docker:

1. Read the VPS public IPv4 (`curl -4 ifconfig.me` on the VPS, or the provider panel).
2. In the DNS zone for `sport-lead.ru`:
   - `A` `@` (apex `sport-lead.ru`) → VPS IPv4
   - optional later: `A` or `CNAME` `www` → apex (add a Caddy `www` site block only after that record exists, or TLS issuance can stall)
   - `AAAA` only if the VPS has IPv6
3. Wait until `nslookup sport-lead.ru` (or `dig +short sport-lead.ru`) returns that IP from a public resolver.
4. On the VPS `.env.production`:

```
SPORT_LEADS_DOMAIN=sport-lead.ru
PUBLIC_APP_ORIGIN=https://sport-lead.ru
```

User-facing work is **`https://sport-lead.ru` only**. LAN `:3001` remains agent/dev tests, not the shop/office URL.

Do **not** run `0.5.6` compose-up expecting Let's Encrypt until this A-record is live (Caddy needs `:80` reaching this host under that name).

## 2. First up (`0.5.6`)

DNS `A`/`AAAA` for **`sport-lead.ru`** → VPS IP must already be live (`0.5.6.1`) **before** expecting Let's Encrypt.

```bash
cd ~/sport-leads
mkdir -p storage
# .env.production: SPORT_LEADS_DOMAIN=sport-lead.ru  PUBLIC_APP_ORIGIN=https://sport-lead.ru
docker compose -f compose.prod.yaml --env-file .env.production up -d --build
docker compose -f compose.prod.yaml --env-file .env.production ps
curl -fsS "https://sport-lead.ru/healthz"
curl -fsS "https://sport-lead.ru/health"
curl -fsS "https://sport-lead.ru/health/ready"
```

Login: `https://sport-lead.ru/login`. API and Postgres are not on public ports.

## 3. One-time data migrate (`0.5.7`)

On Windows (local Docker Postgres, **not** tunnel):

```powershell
powershell -File scripts/backup_db.ps1
```

Copy `backup/sport_leads-*.dump` to the VPS, then:

```bash
bash scripts/prod-restore-db.sh backup/sport_leads-….dump
```

Do this **before** running local uvicorn against the tunnel (two writers + empty/partial restore).

## 4. GitHub deploy (`0.5.8`)

1. Repo → Settings → Environments → **`production`**.  
2. Secrets: `PROD_SSH_HOST`, `PROD_SSH_USER`, `PROD_SSH_KEY`, `PROD_APP_PATH` (optional `PROD_SSH_PORT`).  
3. Actions → **Deploy production** → Run workflow (`ref=main`).

See `docs/ops/production-17-2-2.md`.

## 5. SSH tunnel (`0.5.9`)

On Windows (Docker Postgres stays on `:5432` for tests):

```powershell
powershell -File scripts/vps-db-tunnel.ps1 -SshHost YOUR_VPS_IP
```

Copy `.env.tunnel.example` → `.env.tunnel`. Use the **same** `POSTGRES_PASSWORD` as VPS `.env.production`. Point owner uvicorn at `.env.tunnel` (`POSTGRES_PORT=5433`). Do not point pytest / `check_project.py` / `alembic` at it.

## 6. Media sync (`0.5.10`)

Postgres dump does not include `storage/`. Canonical files live on the VPS bind `./storage`.

Pull VPS → local (default):

```powershell
powershell -File scripts/sync-storage-from-vps.ps1 -SshHost YOUR_VPS_IP -RemotePath /home/deploy/sport-leads
```

Push local → VPS only when you intend to overwrite production files (`-Push`).

## 7. Backup cron (`0.5.11`)

On the VPS (see `production-17-2-3.md`):

```cron
15 2 * * * cd /home/deploy/sport-leads && ./scripts/prod-backup-db.sh >> logs/backup.log 2>&1
```

Copy dumps off-box. Disk-only is not DR.

## 8. Owner smoke (`0.5.12`)

1. Login at **`https://sport-lead.ru/login`** + `/health/ready`.  
2. Optional: tunnel up, local `:3001` against VPS DB (agent tests stay on Docker Postgres).  
3. Close `0.5.12` in roadmap + HTML twin after visual OK.

## Agent defaults (not owner tunnel)

`powershell -File scripts/dev-servers.ps1 -Action start` — Docker Postgres `:5432`, uvicorn `:8000`, Next `:3001`. LAN ≠ Caddy.
