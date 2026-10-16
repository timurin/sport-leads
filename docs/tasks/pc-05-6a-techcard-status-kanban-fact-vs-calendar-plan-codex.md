# PC-05.6A — TechnicalCard Status + Kanban Fact vs Calendar Plan

## Исполнитель
Codex

## Цель
Исправить рассогласование между списком ТК, Kanban и Production Calendar.

Canonical rule:
- **Calendar = план будущих/текущих операций**
- **Kanban = факт текущего цеха ТК**
- **TechnicalCard status = lifecycle ТК**
- Kanban DnD не должен управлять календарём.

Использовать `SL-PROJECT-MEMORY-v1` + только релевантные `DF-*`. Без repo-wide scan.

## 1. Проверить текущую семантику

На `MINI-STRESS-*` определить, почему:
- в списке ТК `Участок = Дизайн`;
- статус остаётся `Черновик`;
- Calendar уже содержит операции в Печати/Раскрое/Пошиве/Контроле;
- Kanban строится не по тому же фактическому состоянию.

Не считать наличие будущего CalendarAssignment фактом перехода в другой цех.

## 2. Canonical lifecycle

Зафиксировать/переиспользовать существующие состояния ТК, минимум по смыслу:
- draft — ещё не запущена;
- planned/ready — подготовлена/спланирована;
- in_progress — производство реально начато;
- completed — производство завершено;
- cancelled/closed — если уже существует.

Не вводить новые enum без необходимости.

`Черновик` недопустим, если по ТК уже существует подтверждённый production fact `in_progress/completed`.

## 3. Current workshop

`current_workshop` должен определяться **по факту выполнения snapshot route**, а не по будущим CalendarAssignment.

Правило:
- ТК присутствует в Kanban ровно в одном текущем цехе;
- будущие операции Calendar не двигают Kanban;
- после завершения всех required child operations текущего workshop — переход к следующему workshop;
- parallel/ONE OF semantics учитывать по существующему snapshot DAG.

## 4. Kanban API

Убрать из backend contract возможность произвольного DnD-перехода, если она напрямую меняет производственный факт/очередь календаря.

Разрешённые действия Kanban:
- start;
- complete;
- rollback — только по существующим guarded semantics;
- переход в следующий workshop только через подтверждённый факт завершения.

Не использовать Kanban как planner.

## 5. Queue semantics

Не менять очередь Scheduler в этой задаче, но зафиксировать контракт:

**Очередь управляется планом, не Kanban.**

Источник порядка:
`CalendarAssignment / Scheduler planning order / manual planning override`

Kanban только отражает факт.

## 6. Diagnostics

Если status/current_workshop расходятся с production fact:
- diagnostic category `INTEGRITY`;
- показать expected vs actual;
- manager message простым языком;
- technical trace в Debug.

## 7. Проверка на MINI-STRESS

Проверить 5 `MINI-STRESS-*`:
- список ТК;
- lifecycle status;
- current workshop;
- Kanban column;
- Calendar assignments.

Ожидается:
- Calendar может показывать одну ТК в нескольких будущих участках;
- Kanban показывает её только в текущем фактическом workshop;
- status не `Черновик`, если производство реально стартовало.

## Tests
- planned but not started -> Kanban current workshop / status consistent;
- started first workshop -> `in_progress`;
- future CalendarAssignment does not advance Kanban;
- completed workshop advances Kanban;
- parallel/join;
- ONE OF;
- no DnD side-effect on Calendar;
- project check;
- DB integrity;
- git diff --check.

## Не делать
- UI redesign;
- Calendar queue UI;
- mass repair production facts;
- commit/push.

Финальная строка:
`PC-05.6A KANBAN FACT AND CALENDAR PLAN SEMANTICS VERIFIED`

## Результат — 2026-10-12

PC-05.6A выбран прямым указанием владельца. Найдена незавершённая реализация без финального отчёта; она проверена и дополнена. Остальной WIP сохранён.

- Причина расхождения: Calendar содержит будущие операции, а current workshop/lifecycle определяются StageResult production fact. Pending спланированные ТК могут оставаться draft; planned/ready enum не нужен. MINI-STRESS-2113 уже имеет подтверждённый in_progress факт; никаких фактов этой итерацией не добавлено.
- Общая read-only проекция current_stage_order/label/current_workshop_id используется list/detail. Kanban группирует по workshop ID, а не переименованному label; один текущий цех независимо от будущих назначений.
- Complete не перескакивает через in_progress sibling; selected ONE OF и unresolved groups учитываются, join ждёт predecessors. Guarded rollback сохраняет later fact, DnD отключён, совместимый move action отказывает без API вызова. Calendar/Allocation и Scheduler queue не меняются этими UI действиями.
- Shared INTEGRITY diagnostics: technical_card_lifecycle_fact_mismatch и technical_card_workshop_fact_mismatch. Expected/actual и snapshot trace в Debug, manager message простым языком. Legacy status/pointer не исправляются чтением.

| ТК | Статус | Текущий цех / Kanban | Calendar assignments |
|---|---|---|---:|
| MINI-STRESS-2011 /122 | draft | Дизайн / Ожидает |0|
| MINI-STRESS-2012 /123 | draft | Дизайн / Ожидает |7|
| MINI-STRESS-2111 /124 | draft | Дизайн / Ожидает |7|
| MINI-STRESS-2112 /125 | draft | Дизайн / Ожидает |7|
| MINI-STRESS-2113 /126 | in_progress | Дизайн / В работе |7|

Проверки:10 task regressions;74 focused (до добавления последнего успешного rollback case);полный project check10/10,929 backend/397 frontend PASS. Включены OpenAPI, Alembic drift, lint, tsc, frontend tests/build и Compose. DB:247 FK,0 orphan references,0 audit SQL writes. Scoped git diff --check PASS. Global git diff --check reports one P3 whitespace issue outside task scope: frontend/components/settings/shop-routing-detail-workspace.tsx:237 new blank line at EOF; owner WIP preserved, not repaired. Initial local .venv collection failure classified dependency (missing argon2); canonical installed Python used successfully. Local Postgres initially unavailable (Docker daemon/service); Docker Desktop/Postgres started and DB checks passed.

Файлы реализации:backend/app/services/technical_card_fact_projection.py,technical_card_stages.py,technical_cards.py,production_diagnostics.py;backend/app/schemas/technical_card.py;backend/tests/test_techcard_fact_pc_05_6a.py;frontend/lib/sales/order-tech-cards-api.ts;frontend/lib/production/shop-stage-modules.ts и .test.mjs;frontend/components/production/shop-stage-kanban-workspace.tsx;frontend/app/(workspace)/production/kanban/shop-kanban-actions.ts. Эти пути содержат и ранее существующий WIP, весь diff не приписывается этой итерации.

API: additive nullable current_workshop_id в list/detail DTO; existing guarded fact endpoints сохранены. Models/DB/migrations не менялись. Очередь определяется CalendarAssignment/Scheduler/manual planning override, Kanban — проекция факта.

UI:PT-03;семантика списка/detail/Kanban/Calendar проверена на пяти реальных локальных ТК через canonical DTO и actual column builder. Browser tool недоступен в этой сессии; страницы/breakpoints визуально не проверены, responsive acceptance не заявлена. Layout/shell не изменены; visual bugs не оценивались. Изолированная SSR попытка без AppRouter provider не является доказательством UI проверки.

P0/P1 новых нет; существующая матрица41 invariant,P0=0/P1=0/P2=13/P3=28 не пересчитана в новую бизнес-гарантию. P2/P3 вне scope не исправлялись. Data-flow updated:DF-KANBAN-FACT,DF-DIAGNOSTICS. Project memory/UI context updated; invariant evidence supplemented without inventory changes. Roadmap/project structure/ERP checkpoint и HTML twin synced; общий stage остаётся open.

Evidence:logs/pc-05-6a/mini-audit.json,kanban-proof.json,db-integrity.json,project-check.log,canonical-docs.diff. Аудит локальный localhost:5432,без VPS. Commit/push,production apply,mass fact repair,30-TK test не выполнялись. Remaining:owner review/visual verification;следующая итерация только по выбору владельца.

PC-05.6A KANBAN FACT AND CALENDAR PLAN SEMANTICS VERIFIED
