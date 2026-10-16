# PC-05.2 — Platform Invariant Coverage Audit

## Исполнитель
Codex

## Цель
Используя Global Debug Center, текущий Diagnostics Engine и `SL-DATA-FLOW-v1`, провести targeted audit критичных invariants платформы и определить:

- какие invariants уже защищены на записи;
- какие только диагностируются постфактум;
- где возможны состояния, которые система позволяет создать, а потом лишь показывает как ошибку.

Не читать весь `SL-DATA-FLOW-v1` без необходимости. Использовать только релевантные `DF-*` цепочки.

## Scope
Минимум проверить:

- `DF-ROUTE-SNAPSHOT`
- `DF-TK-OPERATION-VOLUME`
- `DF-ONE-OF`
- `DF-SEWING-DEMAND`
- `DF-PRINT-DEMAND`
- `DF-CUTTING-DEMAND`
- `DF-DEMAND-CAPACITY`
- `DF-WORKCENTER`
- `DF-SCHEDULER-CALENDAR`
- `DF-DIAGNOSTICS`

## Для каждого invariant
Составить таблицу:

`Invariant | Current guard | Diagnostic | Can invalid state still be created? | Risk | Recommended guard`

Примеры классов проверки:

### Snapshot
- route snapshot содержит все required operation nodes;
- existing TK не молча меняется при edit template;
- explicit reapply получает новый snapshot.

### Operation volume
- source norm существует;
- copied norm сохраняется;
- quantity change корректно пересчитывает volume;
- manual override не затирается.

### ONE OF
- выбран ровно один member;
- Demand/Scheduler используют только selected member;
- in_progress/completed choice нельзя сменить без разрешённого сценария.

### Assembly / sewing
- выбран Assembly Variant;
- sewing norms существуют;
- zero/invalid duration не проходит как валидная готовность;
- derived labor demand совпадает с нормой.

### Demand / Capacity
- Demand source существует;
- единицы совместимы;
- CapacityResource/WorkCenter mapping корректен;
- physical equipment не дублируется вне WorkCenter.

### Scheduler / Calendar
- planned operation имеет CalendarAssignment;
- allocations принадлежат assignment;
- locked/manual plan не переписывается;
- started/completed step не теряет plan mapping.

## Классификация результата
Для каждого gap:

- `P0` — может привести к повреждению/потере факта или неконсистентной ТК;
- `P1` — ломает планирование/календарь;
- `P2` — диагностируется, но ухудшает UX/поддержку;
- `P3` — informational/cleanup.

## Важно
Не исправлять всё в рамках этой задачи.

Разрешено:
- добавить targeted tests, если они нужны чтобы доказать отсутствие guard;
- добавить diagnostic-only assertion, если это безопасно и не меняет бизнес-логику.

Не разрешено:
- mass refactor;
- broad scheduler rewrite;
- новые business rules без отдельной задачи;
- auto-fix данных;
- commit/push.

## Выход
Создать отчёт:

`docs/architecture/SL-INVARIANT-COVERAGE-v1.md`

И HTML twin:

`docs/erp/status/SL-INVARIANT-COVERAGE-v1.html`

HTML:
- summary counters;
- P0/P1/P2/P3 filters;
- matrix по модулям;
- ссылки на `DF-*`;
- список рекомендуемых следующих задач.

## Roadmap
В конце отчёта сформировать короткий приоритетный backlog:
1. P0 guards
2. P1 guards
3. diagnostics enrichment
4. cleanup

Каждая рекомендуемая задача:
- short ID;
- affected DF chains;
- exact invariant;
- suggested executor (Codex/Cursor).

## Проверки
- project check;
- targeted tests;
- git diff --check.

## Acceptance
Готово, если:
1. видно, какие критичные invariants реально защищены;
2. видно, какие invalid states всё ещё можно создать;
3. есть приоритет P0/P1;
4. есть HTML для ручной проверки владельцем;
5. нет broad implementation вне audit scope.

Финальная строка:
`PC-05.2 PLATFORM INVARIANT COVERAGE AUDIT READY FOR OWNER REVIEW`

## Отчёт выполнения — 2026-10-11

Выбрана только PC-05.2 по запросу владельца после PC-05.1B. Выполнен targeted audit десяти заданных DF цепочек; дополнительно прочитаны только найденные зависимости norm ownership/assembly и stage/QR facts. Git branch main, исходный WIP сохранён. Следующие guards не реализовывались, stage transition не выполнялся.

Созданы canonical [SL-INVARIANT-COVERAGE-v1.md](../architecture/SL-INVARIANT-COVERAGE-v1.md) и [offline HTML twin](../erp/status/SL-INVARIANT-COVERAGE-v1.html). В матрице **41 invariant**, ровно шесть требуемых columns; [WRITE]/[PARTIAL]/[READ]/[OBSERVE] обозначают реальную границу guard. Для каждого row указаны diagnostic, supported write versus deliberate incomplete draft versus legacy/DB corruption, риск и recommended guard. Counters **P0=1/P1=7/P2=13/P3=20** считают строки, не live incidents; P3 включает защищённые/informational invariants. Родственные rows объединяются в bounded backlog tasks IC-G01..IC-G06, IC-D01/IC-D02, IC-C01 с affected DF и Codex/Cursor executors.

**Главный P0 — IC-RS-03 / IC-G01.** Existing apply_routing_template разрешает reapply для in_progress, пока нет completed stage, и пересоздаёт StageResult. Isolated test доказал исчезновение записанных started_at/performer/work_done/duration. Audit assignment_detached не является сохранённой копией этих facts. Recommended next iteration: отдельная IC-G01 protection при started/fact/WIP/учёте либо утверждённый fact-preserving сценарий. Related model/assembly binding и rollback policy требуют review там же; их массовое исправление/изменение business rules здесь не выполнено.

**P1 proof cases:** после start manual delete удаляет assignment/allocations, сохраняя in_progress; manual date move не переносит allocations; unit edit nonlegacy resource оставляет старую allocation unit; quantity100→50 оставляет allocation100, start gate принимает identity, затем protected-anchor dry-run обнаруживает demand mismatch. Partial snapshot case создан только direct ORM/DB mutation в fixture: Scheduler принимает неполный frozen graph; публичный API удаления одного node не найден. Live norm drift и destructive TechOperation deletion с snapshot soft refs дополнительно классифицированы по code review, без заявления отдельной HTTP reproduction. Все описанные gaps остаются открытыми; passing gap-proof test не означает исправление.

**Debug Center evidence.** Проверена цепочка frontend PlatformDebugCenter → loadPlatformHealth → platform-health API → shared read_health resolver. Тот же resolver прочитан на local PostgreSQL localhost:5432:58 diagnostics, CONFIGURATION26/DATA_FLOW21/INTEGRITY11; observer0 INSERT/UPDATE/DELETE. Norm/copy issues не смешаны с ошибками guard. STRESS_TEST-1/card121/node867 остаётся started_step_without_saved_plan/unknown; причина исторического возникновения не придумана, repair/replan не выполнялись. Product Debug UI/debug_mode/auth settings не менялись. Evidence ignored logs/pc-05-2/local-health.json.

**Проверки:** 6 новых isolated gap-proof tests PASS; **120 targeted tests PASS** по snapshot/volumes/ONE OF/Demand/WorkCenter/Diagnostics/calendar lifecycle; full scripts/check_project.py **10/10 PASS,806 backend/388 frontend tests**, OpenAPI/Alembic/lint/tsc/test/build/Compose included. Existing warnings остались видимыми, check errors отсутствуют. Генераторы invariant/data-flow/production-calendar --check PASS, git diff --check PASS. Миграция не требуется. Evidence ignored logs/pc-05-2/project-check.log, targeted.log.

**HTML verification:** применены инструкции browser skill; callable in-app browser control отсутствовал в этой сессии, поэтому offline file проверен локальным standalone Chromium. Проверены counts, каждый P0/P1/P2/P3 filter, комбинированные module/search/risk filters, empty result, reset, clickable module matrix, переход к backlog и реальный DF HTML anchor. Widths **1440/1024/768/390/320**, JS errors0, body overflow0; намеренный horizontal scroll module summary table на mobile остаётся внутри container. Desktop/mobile screenshots и P0 row просмотрены. Один layout issue multi-child table cells исправлен в генераторе span wrapper и verification повторена. Product UI/PT templates не применимы: это offline canonical report, reference pattern — существующий SL-DATA-FLOW-v1 status HTML; app shell не редактировался. Owner manual review pending. Evidence ignored logs/pc-05-2/html-check.json, invariant-*.png, p0-row-*.png.

**Data-flow updated:** DF-ROUTE-SNAPSHOT — документирован действительный предел reapply guard/P0; DF-WORKCENTER и DF-SCHEDULER-CALENDAR — исправлено прежнее утверждение о nonexistent CalendarAssignment.work_center_id. Выбранная physical machine persisted через CalendarAllocation.resource_key → CapacityResource.work_center_id. Runtime schema/consumer/formula не менялись. HTML twin regenerated/check PASS.

**Файлы этой итерации:** new architecture report + HTML; scripts/generate_invariant_coverage.py; backend/tests/test_invariant_coverage_pc_05_2.py; SL-DATA-FLOW-v1.md/HTML; этот task report; roadmap.md/HTML, roadmap-v1.1.md/HTML, production-calendar-v0.1.md/HTML, project-structure.md/HTML, erp-check.md, scripts/generate_production_calendar_roadmap.py. Production backend/frontend/model/API/migration файлы этой итерацией не менялись.

**Roadmap/ERP:** closed только audit deliverable PC-05.2, готовый к owner review. Общие PC-05/PC-04.4S и найденные P0/P1 не закрыты. **HTML twin synced:** PC-05.2 MD[x] ↔ HTML done=true относится к выполненному audit, не к реализации рекомендованных guards. Canonical diff review: git diff -- docs/roadmap/roadmap.md docs/erp/status/roadmap.html docs/architecture/project-structure.md docs/erp/status/project-structure.html docs/architecture/erp-check.md; captured ignored logs/pc-05-2/canonical-docs.diff включает прежний WIP. Final git status проверен.

**Remaining / next iteration:** owner review HTML/приоритетов, затем выбрать IC-G01/P0 отдельной задачей. Не начинать P1/diagnostics/cleanup автоматически. Commit/tag/push, production/VPS apply, data repair и broad implementation не выполнялись.

PC-05.2 PLATFORM INVARIANT COVERAGE AUDIT READY FOR OWNER REVIEW
