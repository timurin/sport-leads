# BUG-02C — Preflight navigation: release and production verification

**Agent:** Cursor  
**Base:** `main`; last confirmed production before BUG-02 = `6531626`.  
**Sources:** `docs/architecture/SL-UI-CONTEXT-v1.md` (UI-TK), `docs/tasks/pc-bug-02-preflight-deeplink-highlight-cursor.md`, `docs/tasks/pc-bug-02b-preflight-targets-patch-cursor.md`; current code and AGENTS.md take precedence.

## Goal
Close BUG-02 after local BUG-02/02B pass: commit only verified preflight navigation/highlight changes and their tests/docs, push `main`, deploy, perform safe production QA.

## Scope
1. Review `git status`/diff against main and isolate changes belonging to BUG-02/02B. Preserve unrelated WIP; do not stage it. Confirm that BUG-01 and PC-06.4B remain deployed and unaffected.
2. Validate issue → action mapping, especially `calendar_allocation_amount_mismatch` → show plan (not shipping date); no false edit action for read-only `invalid_quantity`; real edit targets for assembly/variant/personalization; `plan_review` action only when its reasons warrant it.
3. Run focused preflight tests, `python scripts/check_project.py` (10/10), `git diff --check`. Fix only regressions introduced by BUG-02.
4. Commit BUG-02 changes and relevant task/UI context, push `main`, confirm successful deploy workflow. Do not include new backend migrations or write production data.
5. After deploy, authenticate and verify on `https://sport-lead.ru`: preflight opens, action targets/focus/highlight/close focus restore; desktop and mobile viewport; no plan calculation, date save or fact mutation. If matching issue is absent on real cards, report *not exercised* rather than synthesizing or modifying production records. Confirm Capacities page and creation form still load.
6. Report SHA, pushed branch, deploy run URL/status, project check summary, production checks performed versus blocked, and final `git status`. Update docs only for real state transitions; keep applicable HTML twins in sync.

## Safety / Done
No deletion or reset of existing cards, facts, assignments, allocations, test records or owner files. No production mutation for QA. Existing user data and uncommitted changes must be preserved. BUG-02 is *production verified* only for flows actually exercised; remaining synthetic-only mappings explicitly documented as covered by tests, not browser E2E.
