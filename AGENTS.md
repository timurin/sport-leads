# Repository Guidelines

## Project Structure & Module Organization

`backend/app/` — FastAPI by layer: `api/`, `models/`, `schemas/`, `collectors/`, `parsers/`, `services/`. Migrations: `backend/alembic/`. Tests: `backend/tests/`. Next.js app: `frontend/` (`app/`, `components/`, `lib/`, `types/`, `public/`). Ops: `scripts/`, `docker/`, `compose.yaml`. Generated data stays in ignored `storage/`, `logs/`, `backup/`.

## Build, Test, and Development Commands

- Copy `.env.example` to `.env` and set `POSTGRES_PASSWORD` before backend or `scripts/check_project.py`
- `docker compose up -d postgres`
- `pip install -r backend/requirements.txt` (Python 3.13+)
- Backend: `alembic upgrade head`, `uvicorn app.main:app --reload` from `backend/`
- Optional API logging via `LOG_LEVEL` (`DEBUG`/`INFO`/…) and `LOG_FORMAT` (`text`|`json`) in `.env`
- Frontend: `npm ci`, then `npm run dev` / `lint` / `build` from `frontend/`
- Repo checks: `powershell -File scripts/check.ps1` or `python scripts/check_project.py` (backend pytest, frontend lint/tsc/test/build, Alembic, Compose config)
- Database backup (dev): `powershell -File scripts/backup_db.ps1`; restore: `scripts/restore_db.ps1 -DumpFile backup\…`

## Coding Style & Naming Conventions

Python: 4 spaces, type hints, `snake_case` modules/functions, `PascalCase` classes, `UPPER_SNAKE_CASE` constants. TypeScript: strict, 2 spaces, `PascalCase` components, `camelCase` vars/functions, kebab-case filenames. Prefer `@/` imports. Follow Next.js ESLint; read `frontend/AGENTS.md` before frontend changes.

## Testing Guidelines

No formal coverage gate yet. Required suite: `scripts/check_project.py`. Add focused `backend/tests/test_*.py`; avoid live network; use mock collector when needed. Run full check before submitting.

## Commit & Pull Request Guidelines

Short imperative sentence-case subjects (e.g. `Add materials catalog API and database model`). PRs explain change + validation, link issues, call out migrations/config, include UI screenshots. Never commit `.env`, credentials, logs, downloads, or generated storage.

# Sport-Lead autonomous development rules

## Canonical documents

Sources of truth:

- `docs/roadmap/roadmap.md` (`SL-ROADMAP-v1`) — sequence
- `docs/architecture/project-structure.md` (`SL-PROJECT-STRUCTURE-v1`) — confirmed readiness
- `docs/architecture/erp-check.md` (`SL-ERP-CHECK-v1`) — ERP readiness
- ADRs in `docs/architecture/decisions/`

HTML under `docs/erp/status/` is a visual report only. Do not create parallel master documents. Roadmap document code ≠ app version.

Before each task read: this file, project-structure, erp-check, roadmap, related ADRs, `docs/releases/latest.md` if present, latest release doc, and the current task file if any.

## Main principle

Execute only the next unfinished item of the current roadmap stage.

Do not advance while the stage is incomplete, checks fail, P0/P1 remain open, or the user has not confirmed the stage transition.

## Work order

Before changes: check git status/branch; read roadmap and ERP-check; inspect existing models/API/schemas/services/components; do not build a parallel implementation; plan briefly; bound the iteration.

While working: minimal diff; keep architecture and compatibility; no visual changes without a direct task; do not mix roadmap stages; no mass refactor; no mock substitution for working code; no error-hiding fallbacks; do not delete unknown/untracked files; never `git reset --hard` / `git clean -fd`.

## Protected Platform Shell

Approved contracts live in `docs/design-system/shell-contracts.md`:

- `DS-SHELL-01` — `frontend/components/navigation/app-sidebar.tsx`
- `DS-SHELL-02` — `frontend/components/navigation/top-navigation.tsx`

Do not change shell visuals, spacing, compact mechanics, or JSX frames without an explicit user visual task. Navigation structure comes only from `frontend/lib/navigation.ts`. Before editing shell UI, read the shell contracts file. Reports that touch the shell must include `DS-SHELL-01 visual contract preserved` and/or `DS-SHELL-02 visual contract preserved`.

## Platform design system

Canonical design docs: `docs/design-system/`.

1. New pages reference template IDs `PT-01`–`PT-08` once approved.
2. Until a template is approved, use the nearest reference pattern from `docs/design-system/ui-audit.md` / `docs/design/`.
3. Route group `(workspace)` is never part of the URL.
4. Demo/local UI must be labeled and is not persistent readiness.
5. New modules do not invent layouts without checking shared templates.
6. Shared components change only after checking consumers.
7. Visual bugs become separate roadmap microtasks (`B1`, `B2`, …).
8. Visual verification uses the approved responsive matrix.
9. UI task reports list template ID, pages checked, breakpoints checked, and visual bugs found.

## Architecture

Keep layers separate: API, schemas, services, repositories, DB models, frontend data layer, UI.

Rules: no ORM objects from API; business rules in services; money via Decimal/Numeric; timezone-aware datetimes; migrations have upgrade and downgrade; one source of truth per entity; no duplicate models/routers/`operationId`/API prefixes; frontend must not silently replace API errors with demo data.

## Roadmap, microtasks, and canonical sync

1. Canonical roadmap: `docs/roadmap/roadmap.md`; HTML twin: `docs/erp/status/roadmap.html`.
2. Split work into microtasks; one microtask = one logical problem; task files only in `docs/tasks/`.
3. Execute only the selected microtask; do not auto-start the next.
4. Close only the matching checkbox after successful applicable checks.
5. Functional items close after all required microtasks (and user visual check if required).
6. Bugs get `B1`, `B2`, …; unrelated refactor is forbidden.
7. Update roadmap HTML with Markdown. Update project-structure (+ HTML) only when factual readiness changes.
8. Roadmap Markdown uses only `[x]` / `[ ]`. ERP-check may use `[x]` / `[~]` / `[ ]` / `[!]` / `[?]`.
9. Do not renumber/reorder stages or merge items without permission; do not delete unfinished items.
10. Beside updated items note iteration version, result, evidence files, tests, remaining limits.
11. If unchanged: `Roadmap: changes not required.` / `Project structure checklist: changes not required.`
12. After each iteration show: `git diff -- docs/roadmap/roadmap.md`, `project-structure.md`, `erp-check.md`.
13. No commit until the user reviews code, tests, roadmap, and ERP-check.
14. If the user rejects the result, revert only this iteration’s changes.

## Checks

Run applicable checks after each iteration.

Backend: `python scripts/check_project.py`, `python -m pytest`, OpenAPI check, Alembic when models change.
Frontend: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
Git: `git diff --check`, `git status --short`.

Classify failures (code, config, dependency, service, test data). Do not mask errors.

## Severity

- **P0:** data loss, security, app will not start
- **P1:** architecture break, broken migration/API contract, broken core scenario
- **P2:** non-blocking debt
- **P3:** cosmetic

Stop on P0/P1. Do not chase P2/P3 without a dedicated task.

## Git permissions

Allowed: code, migrations, tests, docs/roadmap updates, running checks.

Forbidden without explicit permission: commit, tag, push, merge, rebase, switching primary branch, deleting branches, production migrations, deleting data, advancing to the next roadmap stage.

## Iteration size

One iteration = one roadmap item, one finished result, limited scope, tests + report, then stop. If too large, split and complete only the first finished subtask.

## Report

After each iteration list: selected roadmap item; why next; what shipped; files changed; models/contracts; migrations; check results; P0–P3; roadmap/ERP-check updates; remaining work; recommended next iteration. Then stop.

## Model selection

The project owner chooses the Codex model before the task. Do not change/request model switches or write model-change reports.

If blocked by a missing architecture or business decision, stop only the contested part, record the blocker, and tell the owner.
