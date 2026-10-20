# PC-06.4B-R — Capacity E2E unblock + BUG-01 release (Cursor)

## Context
- PC-06.4A live Capacity UI implemented; PC-06.4B blocked only on saving base schedule and dated exception without a safe test resource.
- BUG-01 frontend fix locally PASS: create form sends `shipping_date` separately from order-group `desired_date`; local TC 164 (BUG01-20261020-1), shipping 2026-11-21, `unplanned` expected until schedule is run.
- Use current `main` working tree, existing PC-06.4B and BUG-01 task contracts. Preserve all existing unrelated changes. No broad audit.

## Task
1. Find a safe, **local-only** E2E setup for capacity schedule+exception editing. Prefer isolated temporary test database/schema or rollback-safe test fixture compatible with existing API/auth. Never edit owner resources or infer that an unlabeled existing resource is disposable. If creating a temporary resource, use existing public APIs/required linkage and record exact ownership/cleanup; if this cannot be done safely, report the precise blocker without touching production.
2. Through the actual authenticated browser UI `/production/calendar/capacity`, edit a **non-machine** test resource schedule (hours, shifts, efficiency, weekdays), save, reload and confirm GET returns persisted values. Save a dated exception; reload and confirm it. Check success/error state and UI on desktop/mobile. Verify a bound machine still loads authoritative `GET /work-centers/{id}/capacity/load`; no invented labor occupancy, no mixed units. Do not use an empty POST `/capacity/load-state` as proof of zero load.
3. Reverify BUG-01 creation UI and readback: `shipping_date` persisted independently of `desired_date`, card detail/planning summary/planning-health show correct shipping date. Missing ETA before scheduling is valid; do not claim a schedule ETA unless a separate authorized scheduler test executes.
4. Run targeted tests, one complete `python scripts/check_project.py` (10/10 expected), `git diff --check`; inspect diff/status. Keep test fixture data scoped and remove only demonstrably owned fixtures when safe. **Do not remove TC 164** without explicit owner permission.
5. If all acceptance checks pass, follow the user-approved EOD release flow: commit only PC-06.4A/4B, BUG-01 frontend change, and relevant docs/tasks; push `main`, verify deploy workflow and authenticated `https://sport-lead.ru` behavior read-only or with explicitly authorized production test data. Do not include BUG-02/03 or other WIP. HTTP 200 of login alone is not acceptance. If production auth/verification is unavailable, report partial acceptance honestly; no false DONE claim.

## Boundaries
- No backend redesign, migration, second capacity store, guessed staff load, production seed/DB writes, destructive reset or changes to real resource settings.
- Respect scheduler/fact/audit guards and existing project memory/Data-flow/UI context. Update status/docs only if actual state changed; HTML twins when required.

## Deliverable
Report browser evidence for save/reload of schedule and exception; fixture isolation and state; BUG-01 field persistence; project check counts; exact changed files, commit SHA, push/deploy link and production QA outcome or exact blocker. Distinguish **local PASS**, **deployed**, and **production verified**.
