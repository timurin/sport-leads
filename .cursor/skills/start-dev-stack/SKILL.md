---
name: start-dev-stack
description: >-
  Starts Sport-Lead local backend (uvicorn :8000) and frontend (next :3001)
  on 0.0.0.0 (127.0.0.1 + LAN), after checking hung sessions. Use when the
  user asks to raise/start/restart backend, frontend, dev servers, локальный
  стек, поднять бэкенд/фронт, or clean hung sessions.
---

# Start Dev Stack

## Goal

One command brings up a healthy local stack on loopback **and** LAN:

| Service  | Port | Ready signal                          |
|----------|------|---------------------------------------|
| Postgres | from `.env` `POSTGRES_PORT` (often `5433`) | Docker Compose healthy if needed |
| Backend  | 8000 | `GET http://127.0.0.1:8000/health` or `/docs` |
| Frontend | 3001 | `GET http://127.0.0.1:3001`           |

Default bind is `0.0.0.0`. Also report LAN URLs (e.g. `http://192.168.2.98:3001`). Prefer the helper script.

## Subagent launch (preferred)

When the user asks only to start/restart servers (no coding), launch a `shell` Task subagent:

```text
Repo: <REPO_ROOT>
Read and follow .cursor/skills/start-dev-stack/SKILL.md and .cursor/rules/dev-server-sessions.mdc.
1) Run: powershell -File scripts/dev-servers.ps1 -Action status
2) If hung/orphan ports or duplicate servers: powershell -File scripts/dev-servers.ps1 -Action stop
3) Start stack (LAN+loopback is the default; do not pass -LoopbackOnly):
   powershell -File scripts/dev-servers.ps1 -Action start
4) Re-check status until both :8000 and :3001 are ready (or report exact failure)
Return: backend/frontend URLs (127.0.0.1 and LAN), PIDs/ports, what was killed, any errors.
```

Parent agent: do not duplicate the start work; wait for the subagent report.

## Workflow (direct)

1. Status first: `powershell -File scripts/dev-servers.ps1 -Action status`
2. Clear hung sessions: `-Action stop`
3. Start: `powershell -File scripts/dev-servers.ps1 -Action start`
4. Verify status. Report loopback + LAN URLs.

## Manual fallback

- Backend (cwd `backend/`): `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- Frontend (cwd `frontend/`): `npm run dev -- -H 0.0.0.0 -p 3001`
- Confirm ready via HTTP, not only process spawn. Require `.env` (`POSTGRES_PASSWORD`). Do not invent credentials.

## Rules

- Follow `.cursor/rules/dev-server-sessions.mdc`.
- Do not kill unrelated processes or port `3000`.
- Do not commit, migrate, or change code as part of this skill.
- Stop after the stack is ready (or after a clear blocker).
---

## Report template

```text
Dev stack:
- cleaned: <none | ports/pids>
- postgres: <up | skipped | failed>
- backend:  http://127.0.0.1:8000  (<ready|failed>)
- frontend: http://127.0.0.1:3001 (<ready|failed>)
- LAN:      http://<lan-ip>:3001 / :8000
```
