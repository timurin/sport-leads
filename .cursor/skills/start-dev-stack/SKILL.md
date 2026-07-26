---
name: start-dev-stack
description: >-
  Starts Sport-Lead local backend (uvicorn :8000) and frontend (next :3000),
  after checking and clearing hung terminal/port sessions. Use when the user
  asks to raise/start/restart backend, frontend, dev servers, локальный стек,
  поднять бэкенд/фронт, or clean hung sessions.
---

# Start Dev Stack

## Goal

Bring up a healthy local stack:

| Service  | Port | Ready signal                          |
|----------|------|---------------------------------------|
| Postgres | 5432 | `docker compose` healthy (if needed)  |
| Backend  | 8000 | `GET http://127.0.0.1:8000/health` or OpenAPI `/docs` responds |
| Frontend | 3000 | `GET http://127.0.0.1:3000` responds  |

Prefer the helper script; fall back to manual commands only if the script fails.

## Subagent launch (preferred)

When the user asks only to start/restart servers (no coding), launch a `shell` Task subagent with this prompt (fill repo root):

```text
Repo: <REPO_ROOT>
Read and follow .cursor/skills/start-dev-stack/SKILL.md and .cursor/rules/dev-server-sessions.mdc.
1) Run: powershell -File scripts/dev-servers.ps1 -Action status
2) If hung/orphan ports or duplicate servers: powershell -File scripts/dev-servers.ps1 -Action stop
3) Ensure postgres: docker compose up -d postgres (from repo root)
4) Start stack: powershell -File scripts/dev-servers.ps1 -Action start
5) Re-check status until both :8000 and :3000 are ready (or report exact failure)
Return: backend URL, frontend URL, PIDs/ports, what was killed, any errors.
```

Parent agent: do not duplicate the start work; wait for the subagent report.

## Workflow (direct)

1. **Status first** — never start blind.
   ```powershell
   powershell -File scripts/dev-servers.ps1 -Action status
   ```
2. **Clear hung sessions** if status reports hung, orphan, or duplicate listeners on 8000/3000.
   ```powershell
   powershell -File scripts/dev-servers.ps1 -Action stop
   ```
3. **Postgres** (if backend cannot connect / compose not up):
   ```powershell
   docker compose up -d postgres
   ```
4. **Start**
   ```powershell
   powershell -File scripts/dev-servers.ps1 -Action start
   ```
   Or separately: `-Action start-backend` / `-Action start-frontend`.
5. **Verify** with `status` again. Report URLs and what was cleaned.

## Manual fallback

- Backend (cwd `backend/`): `uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
- Frontend (cwd `frontend/`): `npm run dev`
- Run each in a long-lived shell (`block_until_ms: 0`). Confirm ready via HTTP, not only process spawn.
- Require `.env` at repo root (`POSTGRES_PASSWORD` set). Do not invent credentials.

## Rules

- Follow `.cursor/rules/dev-server-sessions.mdc` for hung-session detection and kill policy.
- Do not kill unrelated processes on other ports.
- Do not commit, migrate, or change code as part of this skill.
- Stop after stack is ready (or after a clear blocker: missing `.env`, postgres down, port owned by foreign app).
---

## Report template

```text
Dev stack:
- cleaned: <none | ports/pids>
- postgres: <up | skipped | failed>
- backend:  http://127.0.0.1:8000  (<ready|failed>)
- frontend: http://127.0.0.1:3000 (<ready|failed>)
- notes: <optional>
```
