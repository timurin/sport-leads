# PC-03.7B-B1 — TechOperation edit modal

Owner-selected visual microtask, 2026-10-06, within current PC-03. Scope: `/settings/catalogs/tech-operations`, replace inline editing with a populated modal, Save/Cancel in the header, protect against accidental close. This does not close the complete shared-resource integration PC-03.7B.

## Implementation

- `frontend/components/settings/tech-operation-edit-modal.tsx`: native modal dialog with focus trap/focus restoration and body scroll lock; editable name/code/unit/stage/status/materials and the existing capacity form. Header remains visible while content scrolls; Save, Cancel and close icon live in the header.
- `frontend/components/settings/tech-operations-workspace.tsx`: desktop/mobile Edit actions open the same modal. Inline inputs/actions and the detached capacity panel under the list were removed; saved operation updates the existing row state and refreshes the route. Search, list columns, totals, create drawer and material drawer remain available.
- `frontend/components/settings/tech-operation-capacity-fields.tsx`: optional pending-exception callback. Consumers checked: create drawer and calendar-capacity panel; their behavior is unchanged without the callback.
- `frontend/lib/tech-operation-capacity.test.mjs`: existing consumer check updated for workspace → modal → shared capacity fields instead of requiring inline fields inside the list.

All close paths (Cancel, X, Escape, backdrop) use one guard: unchanged drafts close immediately; dirty drafts require confirmation. Declining keeps the modal and inputs. Changes in the pending date-exception editor also trigger the guard; Save asks the user to add the exception or clear its fields rather than dropping those inputs. Pending requests block close and repeated submit. `beforeunload` protects dirty/in-flight forms from browser reload/close. Errors remain inside the modal and preserve the draft; successful save closes without a discard prompt.

The native dialog makes the background inert, traps focus and restores focus to the opener on close. Initial values come from the selected existing operation; no replacement entity/store or extra per-row server fetch was added. Shared platform shell/components were not restyled. Backend, models, migrations and existing data contract are unchanged in this UI microtask.

## Validation

Template: **DS-PT-02-CATALOG**, existing form controls **DS-FORM-01**; explicit owner request permits the edit modal. Creation continues to use CreateDrawer (ADR-013).

Chromium runtime check used a temporary route on canonical frontend `127.0.0.1:3001`, rendering the actual TechOperationsWorkspace with real catalog API reads outside the authenticated platform shell. It was removed before production build; no QA page is shipped. A no-op save exercised the real update action/API; failure verification aborted the frontend POST before it reached the backend. No sample operation or resource was inserted/deleted.

**17 browser checks passed**:

- 1440/1366/1280/1024/768/390/320 px: modal fits viewport without horizontal overflow, fields prefilled, both header actions visible, clean Cancel has no prompt.
- Dirty Cancel/X/Escape/backdrop: rejected discard preserves inputs; accepted discard and reopen restore original values. Native focus stays in the dialog.
- Pending date exception: Save prevents loss; Cancel prompts.
- Real no-op save closes; a failed save keeps the modal and draft; in-flight save blocks close/duplicate submit; dirty beforeunload guard is active.

Evidence (ignored local artifacts): `logs/tech-operation-modal-qa.json`, `logs/tech-operation-edit-1440.png`, `logs/tech-operation-edit-390.png`, `logs/qa_tech_operation_modal.py`. Visual inspection at 390 px passed; no visual bugs found in this matrix. The actual authenticated shell route was not browser-verified in the isolated session; owner can review it in their existing signed-in session.

Initial TypeScript/lint check passed. Final required project check result and canonical synchronization are recorded below after completion.

### Final result — complete 2026-10-06

`python scripts/check_project.py`: **10/10, PROJECT CHECK PASSED** — TypeScript, lint, 331 frontend tests, production build, 555 backend tests, OpenAPI/Alembic/Compose. Targeted catalog/capacity frontend tests: 7 passed. The first full check found one outdated source assertion expecting inline capacity fields in the workspace; it was updated for workspace → modal → existing shared fields, then the complete suite passed. No backend changes or migrations in this iteration.

`git diff --check` passed. Roadmap and project-structure updated for PC-03.7B-B1; complete PC-03.7B stays `[ ]`. **HTML twin synced**, including v1.1 and generated Production Calendar roadmap (`--check` passed). ERP-check: changes not required (UI microtask only); its prior uncommitted changes were preserved. No shell edit in this iteration. Model/API contracts unchanged; no new P0/P1 found within this visual scope. Owner visual review may use the existing signed-in catalog route; screenshots are available in the local evidence paths above. No commit/push.

## Remaining scope

The existing PC-03.7B capacity adapter/form is retained in this microtask. Its full M:N integration with CapacityResource remains open under the owner decision and `docs/architecture/production-calendar-shared-capacity-pc-03-7a.md`; this modal change does not claim that integration. No scheduler/route/TC changes. No new P0/P1 from this microtask; pre-existing capacity adapter work and deprecation/cache warnings are not closed here. Commit/push/merge not performed; other uncommitted WIP preserved.

Recommended next iteration: owner-prepared [PC-03.7C M:N frontend integration](pc-03-7c-mn-capacity-resources-frontend-integration-cursor.md), which replaces the temporary flat capacity adapter retained from PC-03.7B. That newly supplied task was inspected after final verification; its uncommitted file was preserved and implementation was not started.
