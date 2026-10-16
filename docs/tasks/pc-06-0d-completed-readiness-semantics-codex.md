# PC-06.0D — Completed Readiness Semantics

## Исполнитель
Codex

## Цель
Исправить только смысл readiness для завершённой техкарты.

Сейчас завершённая ТК может показывать:
`6 из 7 · Не готова`

Это неверно для менеджера, потому что:
- карта уже полностью прошла производство;
- повторный запуск запрещён lifecycle;
- `can_launch=false` не означает, что карта не готова.

Production core не менять.

## Ожидаемое поведение для completed
Для `completed` TechnicalCard:
- overall readiness status = completed/final;
- progress = `7 из 7`;
- launch step = completed;
- message: `Производство завершено. Повторный запуск не требуется.`
- `can_launch = false`;
- launch CTA отсутствует;
- blocking issues = 0, если нет реальных integrity/configuration ошибок.

## Главное правило
Развести:
- Readiness = насколько техкарта заполнена и прошла обязательные этапы.
- can_launch = можно ли сейчас выполнить действие запуска.

Для completed:
- readiness = complete;
- can_launch = false.

## Scope
Использовать существующий:
`GET /technical-cards/{id}/readiness`

Targeted files only:
- readiness service;
- launch step mapping;
- readiness schemas/tests;
- relevant diagnostics adapter.

Без repo-wide scan.

## Не менять
Не трогать:
- launch endpoint semantics;
- Kanban;
- Queue;
- Calendar;
- route progression;
- quantity;
- material gate;
- frontend layout;
- P2 UX backlog.

Frontend должен продолжить отображать backend response как есть.

## Cases

### Draft / incomplete
Поведение не менять.

### Ready but not launched
- readiness ready;
- `can_launch=true`.

### Launched / in progress
- `can_launch=false`;
- readiness не должна превращаться в `not ready` только из-за этого;
- launch step должен отражать production lifecycle, а не ошибку заполнения.

### Completed
- 7/7;
- completed status;
- can_launch=false;
- no blocking launch issue.

## Tests
Минимум:
1. completed card:
   - progress 7/7;
   - overall completed/final semantics;
   - launch step completed;
   - can_launch=false;
   - no false blocker.
2. ready draft:
   - can_launch=true.
3. blocked draft:
   - can_launch=false;
   - actual blocking issue remains.
4. in_progress:
   - can_launch=false;
   - no fake readiness blocker from launch prohibition.
5. existing readiness/launch guard agreement for launchable cards remains valid.

## Compatibility
Не ломать frontend PC-06.0B/0C.

Если enum `overall_status` сейчас не содержит `completed`, выбрать минимальный backward-compatible вариант:
- добавить `completed`, если безопасно;
- либо использовать existing status + explicit final-state field.

Предпочтение: ясный backend contract без UI heuristics.

Не заставлять frontend угадывать completed по другим полям.

## Docs
Если contract меняется:
- update targeted Project Memory / DF-DIAGNOSTICS section;
- HTML twin sync where required.

Roadmap не менять.

## Проверки
- targeted backend tests;
- full backend tests once;
- project check;
- git diff --check.

Migration не ожидается.

Commit/push не выполнять.

## Acceptance
Готово, если:
1. completed TechnicalCard показывает 7/7;
2. overall не `Не готова`;
3. launch step completed;
4. can_launch=false остаётся;
5. frontend не требует workaround;
6. production core не менялся;
7. новых P0/P1 нет.

Финальная строка:

`PC-06.0D COMPLETED READINESS SEMANTICS FIXED`


## Implementation / evidence — 2026-10-15

Selected PC-06.0D per explicit owner request. Existing main working-tree WIP preserved. No Roadmap/ERP/project-structure changes in this iteration (explicit task boundary).

Changed files: backend/app/services/technical_card_readiness.py, backend/app/schemas/technical_card_readiness.py, new backend/tests/test_completed_readiness_pc_06_0d.py, targeted old terminal-case assertion in backend/tests/test_technical_card_readiness_pc_06_0a.py. Documentation: targeted PM-DIAGNOSTICS, DF-DIAGNOSTICS and its generated HTML twin, this task report. Additional compatibility-only files: frontend/lib/production/tech-card-readiness.ts (enum literal + caption), frontend/lib/production/tech-card-readiness.test.mjs (completed payload regression). No API/router/production-state/stage-command/Calendar/Queue/Kanban/quantity/material/progression/JSX/layout edits. No migration.

The service no longer equates not-blocked with launchable. Lifecycle availability separately controls can_launch; completed adds overall_status=completed, 7/7 and completed nonblocking steps. Personalization warning evidence is retained without undoing historically completed progress. Launch summary is the exact requested message, no fix action/URL. in_progress stays ready/warning according to actual evidence, with completed lifecycle-aware launch step and no prohibition issue. Cancelled and draft rules unchanged.

The completed branch skips adapter-only launch prerequisites for a new plan/date entry; existing diagnostic errors and required header/config checks are preserved. Tests explicitly retain genuine completed model/config and cache integrity errors. Real errors may make overall blocked/progress below7, rather than be concealed by the terminal flag. No repair/certification/plan mutation is performed.

Launch endpoint implementation untouched. The readiness guard's fallback now handles can_launch=false with zero blocking steps (in-progress) by returning the lifecycle summary rather than raising StopIteration; completed remains rejected by the existing endpoint lifecycle guard. Launchable and blocked draft command agreement still tested.

Compatibility decision: additive overall_status=completed. Targeted inspection showed PC-06.0B/0C parser already accepts the additive enum, but its generic fallback would print the English code. The readiness schema/label adapter therefore adds just that enum literal and «Производство завершено» caption; no lifecycle inference, progress calculation, launch predicate, JSX or layout changes. Existing parser/roadmapView/showLaunchButton consume the backend DTO, rendering `7 из 7 · Производство завершено`, green launch check and no launch CTA. The launch detail text is the exact requested Russian message. Nine frontend readiness tests PASS. Evidence from actual isolated backend completed DTO passed through that adapter: logs/pc-06-0d/completed-payload.json, compat_payload.py, compat.mjs.

Targeted checks:16 backend tests PASS (6 new completion cases plus10 existing readiness cases). Coverage: completed7/7/no blockers/no CTA data, completed with personalization warning, in-progress no fake blocker, genuine config/integrity blockers retained, ready/blocked draft guard agreement, no SQL writes during completed read/rejected relaunch. Existing frontend parser/view with the literal enum caption compatibility PASS. Full backend once inside required project check; result appended after completion.

Project memory updated: PM-DIAGNOSTICS. Data-flow updated: DF-DIAGNOSTICS. No invariant inventory/guard change; existing IC-DI-01 no-write coverage extended by the tests. HTML twin generated and checked. Roadmap: changes not required (task explicitly says not to change it). Project structure checklist / ERP-check: changes not required. Status HTML twins untouched; only data-flow HTML regenerated.

No commit/push, real-data edits, production apply or next task. New P0/P1: none after final checks; pre-existing unrelated P3 EOF whitespace remains. Recommended next action: owner review of readiness semantics; P2/UI work not started.


## Final verification

`python scripts/check_project.py` PASS 10/10: 981 backend tests (one full run), 431 frontend tests, lint/TypeScript/build, Alembic no-new-operations check and Compose. Focused backend16/16 and frontend readiness9/9 PASS. OpenAPI contains additive completed enum. Actual completed backend DTO → existing parser/view + literal caption yields «7 из 7 · Производство завершено», completed green launch check, zero blockers, no CTA. Completed SQL observer: no INSERT/UPDATE/DELETE.

Production core/launch endpoint source untouched. No migration, data repair, actual production command, commit/push or stage transition. Task whitespace PASS; global diff only pre-existing unrelated P3 `frontend/components/settings/shop-routing-detail-workspace.tsx:237` EOF blank line. Roadmap/project structure/ERP-check and status twins verified byte-for-byte unchanged against iteration baseline. Project memory updated PM-DIAGNOSTICS. Data-flow updated: DF-DIAGNOSTICS; HTML twin synced (13 flows/link check PASS). Existing WIP/main preserved. Only readiness schema/service/tests, enum caption adapter/tests, targeted memory/data-flow and this report changed. No next task auto-started; recommended next step is owner review of completed/in-progress readiness.

PC-06.0D COMPLETED READINESS SEMANTICS FIXED
