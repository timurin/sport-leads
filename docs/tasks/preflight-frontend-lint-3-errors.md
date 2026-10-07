# PREFLIGHT-FE-01 — Fix the 3 existing frontend lint errors

## Context
Production Calendar design is frozen. Current project checks still report 3 frontend lint errors and many warnings. This task is independent from the local PostgreSQL repair being handled by Codex.

## Goal
Fix only the current 3 frontend lint errors with minimal, behavior-preserving changes.

## Scope
- Run the existing frontend lint command and identify the exact 3 errors.
- Fix those errors only, plus any directly required local cleanup.
- Re-run lint and relevant TypeScript/frontend checks.

## Constraints
- Do NOT work on Production Calendar implementation or design.
- Do NOT touch backend, database, Alembic, Docker or `.env` DB configuration.
- Do NOT broadly clean all warnings; warnings are out of scope unless one must change to fix an error.
- Preserve current UI behavior and approved layouts.
- Avoid formatting/refactors unrelated to the 3 errors.
- Do NOT commit, push, merge or tag.
- Preserve existing uncommitted work and avoid files currently being changed by Codex if possible.

## Checks
- Frontend lint command completes with 0 errors.
- Report remaining warning count separately.
- TypeScript check passes if the project provides one.
- Run a production build only if it is part of the normal lightweight frontend verification and does not require unrelated environment repair.
- `git diff --check` passes for files changed by this task.

## Acceptance
Exactly the blocking lint errors are removed without unrelated behavior changes or backend/database changes.

Return a short report: the 3 original errors, files changed, fixes applied, lint result, warning count, TypeScript/build result, and any remaining blocker.
