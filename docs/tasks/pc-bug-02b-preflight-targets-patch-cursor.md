# BUG-02B — Correct preflight fix targets (Cursor)

## Context
BUG-02 live navigation/focus/highlight passed locally (1440/768/390/320); project check 10/10. This is a narrow follow-up before commit/deploy. Read existing `docs/tasks/pc-bug-02-preflight-deeplink-highlight-cursor.md`, current preflight mapping, `SL-UI-CONTEXT-v1`, existing read-only quantity and planning editor contracts. Do not duplicate infrastructure.

## Change
1. `calendar_allocation_amount_mismatch` must NOT open the unrelated shipping-date field. Follow canonical diagnostic `fix_scope`/`field` and route to the actual allocation/operation-input correction surface when editable. If there is no safe editor, show an accurate explanation and existing relevant section; do not present a false precise field target.
2. For `assembly_required`, `variant_not_selected`, `invalid_quantity`, `personalization_quantity_mismatch`, verify true existing editable targets and expose working correction action, unless the problem has no editable target in this card context. In that case show clear text explaining the proper source/workflow, without a dead button.
3. For quantity, avoid focusing the read-only `#tech-card-quantity` as if it were editable. Route to the actual allowed source or explain why editing is unavailable.
4. `plan_review`: keep focus on the calculate/recalculate action only when that action actually resolves the issue; otherwise navigate to its specific diagnostic target or show concrete blockers.
5. Preserve previously passing focus restoration, modal stacking, edit/dirty guards, and responsive behavior. Never calculate a plan, save dates, change production facts or write arbitrary card data as part of navigation tests.

## Verification
- Focused unit tests for code → action → precise destination or honest no-editor explanation, including cases above.
- Browser tests: named misrouting, at least one formerly missing-button issue, accessible focus/highlight, Escape/close/background return focus at desktop 1440 and mobile 390/320.
- `python scripts/check_project.py` (10/10), `git diff --check`.
- Report which issues cannot be corrected inside current TC and why, with exact source paths. Keep unrelated WIP intact.

## Release
No commit/push/deploy until owner review of this patch. Once accepted, scoped commit → push main → deploy → authenticated production verification per EOD rule; no test writes on production without authorization. Update UI context only if contract changes; other docs only if needed.
