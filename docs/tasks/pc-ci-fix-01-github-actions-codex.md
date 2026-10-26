# CI-FIX-01 — Restore GitHub Actions Project Checks (Codex)

## Source of truth
- GitHub Actions `Project checks` run `40307258189`, commit `3c7ebca`.
- `scripts/check_project.py`, `.github/workflows/*`, `frontend/package.json`, `compose.yaml`, existing project guidance (`AGENTS.md`).

## Goal
Make the GitHub Actions **Project checks** pass in CI without changing runtime behavior or lowering coverage/check standards.

## Confirmed CI failures
1. Backend pytest: Python 3.13 CI environment cannot import `pytest` (`No module named pytest`). Install required test/dev dependencies in CI using the repository's established dependency mechanism.
2. Frontend tests: Node 20.20.2 does not accept `--experimental-strip-types`. Align the CI Node version with the project's tested version supporting this flag (or use a legitimate compatible test runner; do not disable tests).
3. `docker compose -f compose.yaml config --quiet`: `.env` is missing in CI; `PGADMIN_EMAIL` and `PGADMIN_PASSWORD` are unset. Provide safe, nonsecret CI-only fixture values and an ephemeral `.env` in the job, or an equivalent nonproduction mechanism that satisfies Compose; never commit actual credentials or production `.env`.

## Scope and constraints
- Target CI workflow and minimal related configuration only. Investigate exact dependency install steps before changing them.
- Keep all 10 checks active; no `continue-on-error`, skipping pytest/frontend tests/Compose checks, silencing failures, or production secrets.
- Preserve ARCH-04 migration and RBAC untouched, and do not edit unrelated working-tree changes.
- Use minimal patch; explain any CI-vs-local tool version differences in the task report.

## Validation
- Validate workflow/configuration locally as far as feasible, then commit targeted CI fix and push via the established protected-branch flow. Since `main` deploys automatically, do not trigger an unnecessary deploy or change runtime files; follow existing project release policy.
- Confirm new GitHub `Project checks` workflow is green (10/10) and log actual backend/frontend test results; if blocked, report precise blocker and do not claim PASS.
- Verify production deployment status remains healthy and report new commit SHA and check-run URL.

## Done when
GitHub CI `Project checks` passes all 10 checks, with no weakening of checks and no exposure of secrets. Update this task file with concise verification evidence.

## Verification — 2026-10-26 (CI-FIX-01)

- Initial continuation restricted work to local checks. Owner subsequently authorized final review, targeted commit/push to main and verification of Project checks and automatic production deployment. GitHub green-run acceptance remains pending publication at commit time.
- Changes: `.github/workflows/checks.yml` installs `backend/requirements-dev.txt` (existing runtime requirements plus `pytest` and FastAPI TestClient dependency `httpx`), uses Node 24.18.0, creates a runner-only `.env` with nonsecret PostgreSQL/pgAdmin fixture values. All 10 checks remain active.
- Versions: local Python 3.14.6 versus CI Python 3.13; Node 24.18.0 matches local. Runtime requirements, ARCH-04, RBAC, migrations and production data unchanged.
- Targeted checks: actionlint 1.7.12 PASS; Compose config with CI fixture in an isolated temporary directory PASS; pip dependency check PASS. Local `.env` preserved.
- Initial local run exposed missing installed runtime packages `argon2-cffi` and `qrcode`; installed from the existing requirements through the dev requirements file. The interrupted retry had no final result; it is not counted as PASS.
- Full project check PASS, 10/10: 1098 backend tests (76 warnings), 510 frontend tests (0 failures), lint (0 errors, 93 existing warnings), TypeScript, production build, OpenAPI, model/import/collector checks, Alembic check and Compose. Evidence: `logs/ci-fix-01/project-check-final.txt`. `git diff --check` PASS.
- No new P0/P1 found locally. Existing dependency deprecations/lint warnings remain outside this CI-only task (P2/P3); no unrelated fixes made. GitHub Actions execution remains unverified until authorized publication; no new commit SHA/run URL exists.
- Final review: only the workflow, dev requirements and this task are included; no credentials, local `.env`, logs or generated files staged. Fixture passwords are public CI-only values. Dev requirements include runtime requirements by relative path and keep test dependencies out of production installs. Main has no configured branch protection or applicable rulesets (GitHub API); no bypass or force push used. Publication and GitHub verification authorized by owner; results will be reported with run URLs. No next roadmap item or stage started.
- Roadmap: changes not required. Project structure checklist: changes not required. ERP-check unchanged. HTML twins untouched; no synchronization required.
- Project memory: no changes required. Data-flow: no changes required.
