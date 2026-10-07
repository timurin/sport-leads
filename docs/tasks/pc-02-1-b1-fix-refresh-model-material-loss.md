# PC-02.1-B1 — Fix refresh-model material loss

## Context
Production Calendar PC-02.1 design freeze is complete. PC-03 implementation must not start until the existing P1 blocker is fixed.

Known blocker: `refresh-model` removes material data from the technical card/model refresh flow. This is pre-existing behavior and is unrelated to the Production Calendar UI.

Use the canonical project documents and existing repository contracts. Do not redesign the production calendar in this task.

## Goal
Fix the refresh-model flow so refreshing/updating a model does not delete or detach already valid material data from the technical card/specification unless the user explicitly removes/replaces it through the intended workflow.

## Scope
1. Reproduce the current material-loss bug and identify the exact layer responsible.
2. Fix the smallest correct code path.
3. Preserve existing model/technical-card/material relationships and backward compatibility.
4. Add/adjust regression tests that fail before the fix and pass after it.
5. Verify that refresh remains idempotent: repeated refresh must not progressively change or remove valid material data.
6. Update only documentation/checklists that explicitly track this P1 blocker; mark B1 closed only after tests prove the fix.

## Constraints
- Do not start PC-03.
- Do not change approved Production Calendar UI-A–UI-H.
- Do not introduce new entities, catalogs, or migrations unless the current schema objectively cannot support the correct behavior; if a migration appears necessary, stop and document why before creating it.
- Do not rewrite unrelated model/technical-card logic.
- Preserve existing API contracts unless the bug cannot be fixed without a contract correction; document any such need instead of silently changing it.
- Do not fix unrelated Alembic/pytest/frontend lint problems in this iteration.
- Keep all unrelated uncommitted work intact.
- No commit/push/merge/tag.

## Checks
Run the narrowest relevant tests first, then the applicable project checks.

At minimum verify:
- existing material remains after one refresh;
- existing material remains after repeated refresh;
- explicit valid material update still works;
- empty/partial source data does not erase valid stored material by accident;
- refresh does not create duplicate material links;
- `git diff --check` passes.

If the full project check still reports the known unrelated failures, report them separately and do not treat them as B1 failure when the targeted regression suite passes.

## Acceptance criteria
- Root cause documented in the completion report.
- Material is preserved through refresh-model in all covered regression scenarios.
- Targeted backend tests pass.
- No unrelated Production Calendar/application changes.
- B1 may be marked closed in the relevant architecture/roadmap checklist only after the regression test proves the bug is fixed.
- End with a concise report: files changed, root cause, behavior before/after, tests run, remaining blockers for PC-03.

## Completion — 2026-10-05

**B1 CLOSED.** Selected as the existing P1 blocker preceding PC-03. Before the fix, the existing `test_composition_replace_apply_spec_and_refresh_model` failed: refresh left only NOTE/PATTERN. The refresh service called replacement prefill with `model_changed=True`: empty BOM cleared all materials, nonempty BOM replaced them, and route sync could overwrite saved plan/notes with incomplete norms.

`refresh_model_and_pattern_composition` now updates header/pattern snapshots only. Stored MATERIAL rows keep their IDs, nomenclature/stage links, sequence, quantity/unit/notes and shop fact; specification stamp/NOTE are preserved. Repeated refresh does not create material duplicates. No new source-ownership fields are needed because refresh no longer replaces composition. Initial create/revive prefill and explicit composition PUT/apply-specification/delete remain unchanged. Actual model selection/change is the existing explicit bind/prefill workflow (`tech_card_model_assembly.py`, ADR-035), not this refresh action; its behavior is unchanged and covered by neighboring tests. BOM edits alone never overwrite existing TC materials. No writes to Spec, PO or warehouse were added.

**Code/tests:** `backend/app/services/technical_cards.py`, `backend/tests/test_technical_cards_9_3_1.py`, `backend/tests/test_technical_cards_9_3_5_2.py`. Regression covers manual and Spec material, repeated refresh, changed model name/pattern, empty/partial BOM, missing route norm, plan/fact/ID preservation, explicit update/delete, initial BOM prefill and model/assembly binding.

**Checks:** targeted eight test modules — **13 passed**. Broader backend suite with only `test_database.py` excluded — **467 passed, 1 skipped** (the skip is reported by pytest, not introduced here). Full `scripts/check_project.py` using explicitly local `127.0.0.1:5432` — **7/10**; Python compilation, app/OpenAPI (335 paths / 483 unique operationIds), metadata and Compose passed. Alembic and database-test collection fail because local PostgreSQL lacks role `sport_leads`; frontend lint has existing **3 errors / 81 warnings**, so the checker stops before tsc/test/build. These are separate config/service/frontend baseline blockers. `.venv` also lacks argon2; tests used the existing global Python installation. Earlier sandbox run encountered Alembic cache permission errors; escalated verification compiled successfully. Evidence logs stay ignored in `storage/pc-b1-*.log`. No environment files were changed.

**Docs:** B1 checked in v1.1 roadmap and its ERP HTML twin; Production Calendar HTML regenerated from Markdown; canonical roadmap/ERP-check notes and current contract updated only for B1 disposition. Historical failed checks retained in the original validation report. **HTML twin synced.** Project structure checklist: changes not required; its HTML twin untouched. Models/API contracts/migrations and UI-A–UI-H unchanged. No new P0/P1 from this fix; remaining baseline checks and runtime QA block PC-03. Recommended next iteration: restore canonical local DB checks and resolve existing lint errors as separate tasks. PC-03 not started; no commit/push/merge/tag.
