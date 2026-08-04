# Production backup, disaster recovery, and administrator runbooks (17.2.3)

**Depends on:** `17.2.1` stack; extends local `0.3.3` scripts (`backup_db.ps1` / `restore_db.ps1`)

## 1. Backup (RPO target: owner-defined; recommended daily)

On the VPS, from the repo root with stack running:

```powershell
powershell -File scripts/prod-backup-db.ps1
```

```bash
bash scripts/prod-backup-db.sh
```

Output: `backup/sport_leads-prod-YYYYMMDD-HHmmss.dump` (pg_dump custom format `-Fc`).

### Retention (recommended)

| Class | Keep |
|-------|------|
| Daily | 7 days on VPS disk |
| Weekly | 4 copies off-box (object storage / another host) |
| Pre-deploy | 1 dump immediately before `deploy-production` |

Copy dumps off the VPS (scp/rsync/S3) — disk-only backups are not DR.

### Cron example (Linux)

```cron
15 2 * * * cd /path/to/sport-leads && ./scripts/prod-backup-db.sh >> logs/backup.log 2>&1
```

## 2. Restore / disaster recovery

1. **App down but disk OK:** fix compose/Caddy; data volume `postgres_data` intact → no restore.
2. **Corrupt DB / bad migration:** stop writers, restore last known-good dump:

```powershell
powershell -File scripts/prod-restore-db.ps1 -DumpFile backup\sport_leads-prod-….dump
```

```bash
bash scripts/prod-restore-db.sh backup/sport_leads-prod-….dump
```

`pg_restore --clean --if-exists` replaces objects in the target DB. Confirm dump identity before running.

3. **Lost VPS:** provision new host (`production-17-2-1.md`), restore dump into new postgres volume, set DNS, redeploy (`production-17-2-2.md`).
4. **Lost TLS:** Caddy re-issues Let's Encrypt when DNS points at the new host (`caddy_data` volume optional to preserve).

### Post-restore checks

```powershell
powershell -File scripts/prod-health-check.ps1 -BaseUrl https://your.domain
```

Log in as bootstrap admin; spot-check a size-grid and a shop kanban card.

## 3. Administrator ops index

| Topic | Doc / artifact |
|-------|----------------|
| Bootstrap stack | `docs/ops/production-17-2-1.md` |
| Deploy + health + logs | `docs/ops/production-17-2-2.md` |
| Backup / restore / DR | this file |
| Dev DB backup | `scripts/backup_db.ps1`, `scripts/restore_db.ps1` |
| Local stack | `scripts/dev-servers.ps1` |
| Auth bootstrap | `.env.production` `AUTH_BOOTSTRAP_*` |
| Roles | ADR-024; `/settings/users` |

## Out of scope

- Managed backup SaaS / continuous WAL shipping
- Multi-region active-active
- Secrets manager (Vault) — still file-based `.env.production` on host

## Evidence

- `scripts/prod-backup-db.ps1`, `scripts/prod-backup-db.sh`
- `scripts/prod-restore-db.ps1`, `scripts/prod-restore-db.sh`
- Task: `docs/tasks/v0.9.0-stage-17.2.3-production-backup-dr.md`
