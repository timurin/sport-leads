# PC-PREFLIGHT-01 — Restore local PostgreSQL DB checks

## Context
Production Calendar design is frozen and blocker PC-02.1-B1 is closed. Before PC-03, local database checks must work again.

Current known issue: full project check is 7/10 because local PostgreSQL role/database `sport_leads` is unavailable/misconfigured. This is an environment/preflight task only.

## Goal
Restore the local PostgreSQL environment so database-related project checks can run successfully without changing application business logic.

## Scope
- Inspect current local Docker/PostgreSQL setup, `.env`, compose files and app DB settings.
- Determine why local role/database `sport_leads` is unavailable.
- Fix the local environment/configuration with the smallest safe change.
- Verify the application can connect to the intended local PostgreSQL database.
- Run DB-related checks and the relevant project check afterwards.

## Constraints
- Do NOT start PC-03.
- Do NOT modify Production Calendar UI/design/docs except status notes if strictly required by the task log.
- Do NOT change application business logic, models, API contracts or migrations unless the environment issue proves a migration/config mismatch; if so, stop and report instead of redesigning schema.
- Do NOT drop or recreate databases destructively if existing data may be present. Prefer creating/fixing the missing local role/database safely.
- Do NOT touch frontend lint issues; Cursor handles those separately.
- Do NOT commit, push, merge or tag.
- Preserve existing uncommitted work.

## Checks
At minimum verify:
- PostgreSQL service/container is reachable.
- Required role exists and can authenticate.
- Required database exists and ownership/permissions are correct.
- App database URL resolves to the intended local DB.
- Alembic connectivity/checks that were previously blocked can run.
- Re-run `check_project.py` and report exact result.

## Acceptance
Task is complete when the local DB-related failure is removed or a precise non-destructive blocker is documented with exact command/output and no unrelated code changes were made.

Return a short report: root cause, files/config changed, commands run, checks passed/failed, and whether PC-03 is now unblocked from the database side.

## Status — CLOSED 2026-10-05

Local DB connection and DB-related project checks are restored. See final verification below; the first blocked attempt is retained as historical evidence.

## Initial attempt — 2026-10-05 (historical)

**BLOCKED: exact non-destructive blocker documented (acceptance alternative). DB checks are not restored; PC-03 remains blocked from the database side.** This is the preflight immediately after B1; no PC-03 implementation was started.

### Root cause and safe changes

- Docker Desktop was stopped (`docker compose ps`: named pipe `dockerDesktopLinuxEngine` not found). Started with `docker desktop start`.
- Ignored root `.env` had both `POSTGRES_PORT=5433` and `DATABASE_URL` targeting `127.0.0.1:5433`. Changed only those ports to canonical local `5432`, preserving credentials and all other values. `.env.tunnel` and VPS were not touched; no agent DB checks ran against `5433`.
- `docker compose up -d postgres` recreated the container with the same existing volume `sport-leads_postgres_data`; no database/role/schema/data was dropped, recreated or migrated. Container is healthy and publishes `5432`; role/database already exist, so creating them would not fix the failure.
- Windows port `5432` is occupied by another product: native `postgres.exe` PID `7896`, parent `pg_ctl.exe` PID `4976`, service **OlympusDatabase**, display name **Network Olympus Storage Service**, Running / Auto. Service command: `"C:\Program Files (x86)\Network Olympus\Database\bin\pg_ctl.exe" runservice -N "OlympusDatabase" -D "C:\Program Files (x86)\Network Olympus\Database\data" -w -s`. PIDs are observation-time values. Windows connections reach this PostgreSQL instead of Sport-Lead Docker, despite Docker reporting the port published. No changes were made to Olympus or its roles/data.

### Commands and evidence

- `docker compose ps`: Sport-Lead PostgreSQL healthy, `0.0.0.0:5432->5432/tcp`.
- `docker inspect sport_leads_postgres --format "{{json .Mounts}}"`: existing named volume retained.
- `docker exec sport_leads_postgres psql -U sport_leads -d sport_leads -c "SELECT current_user, current_database(), (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner; SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname='sport_leads'; SELECT version_num FROM alembic_version;"`: user/database/owner all `sport_leads`, `rolcanlogin=t`, revision `t9u0v1w2x345`, matching repository head. Internal TCP query with `-h 127.0.0.1` also connects. This does not prove app password authentication from Windows or schema permissions.
- `Get-NetTCPConnection -State Listen -LocalPort 5432`: listeners `::` and `0.0.0.0`, OwningProcess `7896`. `Get-CimInstance Win32_Service | Where-Object ProcessId -EQ 4976`: identifies OlympusDatabase as above.
- `PYTHONPATH=<repo>/backend python storage/pc-preflight-01-db-probe.py`: sanitized app target `postgresql+psycopg2://sport_leads:***@127.0.0.1:5432/sport_leads`; connection fails with exact output `FATAL: role "sport_leads" does not exist`. Same failure outside sandbox. App authentication and permissions remain unverified due to port conflict.
- From `backend/`, `python -m alembic current` and `python -m alembic check`: fail on that same Windows connection error. No migration/config mismatch was established, and no upgrade/stamp was attempted.
- `python scripts/check_project.py`: **7/10**. Alembic fails; backend pytest collection stops at `tests/test_database.py` with **1 error / 3 warnings**. Frontend lint now has **0 errors / 81 warnings** and tsc passes, but frontend tests fail; build is not reached. Frontend was being edited independently during this task; no frontend changes were made here. Full evidence is ignored `storage/pc-preflight-01-check.log`.
- `git diff --check`: passed. Git status and canonical document diffs reviewed; unrelated WIP retained, including independently arriving frontend edits.

### Boundary and next action

Environment/service blocker remains: release canonical Windows `5432` from Olympus by an owner-approved stop/reconfiguration, then recheck Docker publication, app password authentication, schema permissions, Alembic and full project checks. Stopping that service would affect a separate application and was not authorized by this Sport-Lead task. Creating Sport-Lead roles in the Olympus database or silently using another port is not an appropriate fix. No new application P0/P1 introduced; existing DB preflight gate remains open. Other test failures stay outside this task.

Changed this iteration: ignored `.env`, local Docker runtime, this task log; ignored diagnostic probe/log. Business logic, models, API contracts and migrations unchanged. Roadmap: changes not required. Project structure checklist: changes not required. ERP-check unchanged by this iteration. HTML twins untouched by this iteration; existing diffs belong to earlier work. No commit/push/merge/tag. Recommended next iteration: resolve the Olympus port conflict with explicit owner authorization, then rerun this DB preflight; do not start PC-03.

## Final verification — 2026-10-05

**PC-PREFLIGHT-01 CLOSED. DB gate cleared; PC-03 not started.** On the owner's request to recheck, Windows app connections now reach the intended local Docker database on `127.0.0.1:5432`. The previous Olympus port conflict no longer intercepts this endpoint. OlympusDatabase is still Running; this verification did not stop or reconfigure it, and the external change that resolved the conflict is not attributed to this task.

- `PYTHONPATH=<repo>/backend python storage/pc-preflight-01-db-probe.py`: exit 0; masked target `postgresql+psycopg2://sport_leads:***@127.0.0.1:5432/sport_leads`; authenticated user/database `sport_leads`; public schema USAGE/CREATE both True. Cluster identifier **7662698262617706534** matches the Docker cluster observed in the first attempt, proving the app reaches the intended container rather than the other PostgreSQL.
- `docker compose ps`: PostgreSQL healthy, published on `5432`. Container query confirms role can login, database owner `sport_leads`, revision `t9u0v1w2x345`.
- From `backend/`, `python -m alembic current`: `t9u0v1w2x345 (head)`; `python -m alembic check`: exit 0, `No new upgrade operations detected.` No upgrade/stamp/schema changes were needed.
- `python scripts/check_project.py`: **9/10**, all DB-related checks pass. The remaining failed check is frontend tests; full log: ignored `storage/pc-preflight-01-final-check.log`. Frontend lint and TypeScript pass; build is not reached because tests fail. These failures are outside DB preflight scope.
- Backend pytest: **468 passed / 71 warnings**, no skipped tests in this run, including successful database-test collection. Frontend: **293 passed / 3 failed** out of 296; failures are `settings navigation exposes pattern-base catalogs`, `purchases hub is Soft UI chrome without demo PO rows`, and `order card layout breakpoints and collapse wiring (3.5.9)`. Lint: **0 errors / 81 warnings**.
- `git diff --check`: passed; unrelated WIP preserved. No new P0/P1 from this task; the DB environment blocker is removed, while the full-project frontend gate remains open.

This recheck changes only this task log and the ignored diagnostic probe/log. The earlier local `.env` correction remains in effect. Application code, models/API contracts, migrations and UI unchanged. Roadmap: changes not required. Project structure checklist: changes not required. ERP-check and HTML twins untouched in this recheck. No commit/push/merge/tag. Recommended next iteration: separately resolve the failing frontend tests and finish remaining runtime QA before an owner-approved PC-03 start.
