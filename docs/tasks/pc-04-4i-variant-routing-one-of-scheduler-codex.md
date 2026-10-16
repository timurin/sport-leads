# PC-04.4I — Variant Routing `ONE OF` + Preliminary/Confirmed Choice

## Исполнитель
Codex

## Контекст
PC-04.4G закрыта: Routing template — единственный шаблон; TechnicalCard получает immutable snapshot; Kanban = Workshop; Calendar/Scheduler = дочерние TechOperation; Scheduler читает snapshot DAG.

Новая бизнес-потребность: внутри одного цеха часть маршрута может быть вариативной.

Пример `Раскрой`:
- Ручной раскрой
- Раскрой настилом
- Раскрой лазером

Это НЕ parallel. Нужно выполнить ровно один вариант.

Без такой модели число маршрутов растёт комбинаторно.

## 1. Каноническая модель
Добавить semantic type `ONE OF` / Variant Group.

Пример:
`Раскрой`
→ Variant Group `Способ раскроя`
  - Ручной раскрой
  - Раскрой настилом [default]
  - Раскрой лазером
→ `Пошив`

## 2. Не смешивать с parallel
Existing parallel = ALL.
Variant Group = ONE OF.
Не кодировать ONE OF обычными parallel edges.

## 3. Persistence
Минимально расширить graph contract.

VariantGroup:
- id
- routing_id
- workshop_id
- name
- code nullable
- selection_mode=`one_of`
- default_operation_node_id nullable/required
- active

Membership:
- operation node id
- position

Operation node может входить максимум в одну ONE OF group.

## 4. Runtime semantics
Для ТК выбирается один member.
Не выбранные members:
- не создают Demand
- не резервируют Capacity
- не создают CalendarAssignment
- не блокируют Workshop completion.

## 5. Default selection
Variant Group может иметь default member.

При создании ТК:
- snapshot содержит всю группу
- default автоматически selected
- selection_status=`preliminary`

Если default отсутствует:
- snapshot создаётся
- scheduler blocker `variant_not_selected`
- не угадывать.

## 6. Selection state
Для TechnicalCard variant group хранить:
- selected_operation_snapshot_node_id
- selection_status: `preliminary` | `confirmed`
- selected_at / selected_by nullable
- confirmation_at / confirmation_by nullable

Адаптировать к текущему auth/audit contract.

## 7. Snapshot
Variant Group копируется в immutable snapshot:
- group identity
- name/code
- members
- default
- required semantics

Правка template не меняет существующую ТК.

## 8. Preliminary planning
Scheduler НЕ ждёт подтверждения.

Если есть preliminary selection:
- selected operation участвует в Demand
- занимает Capacity
- попадает в очередь
- влияет на ETA
- CalendarAssignment создаётся как обычный план.

Это сохраняет предварительный прогноз даты сдачи.

## 9. Confirmation
Начальник производства может:
- подтвердить preliminary → confirmed
- изменить вариант

При смене варианта:
1. сохранить новый selection
2. старый selected member исключить из runtime
3. auto assignments/allocation старого варианта освободить
4. manual/locked/fact не удалять молча
5. required replan
6. пересчитать ETA
7. вернуть deadline impact через существующий plan result.

## 10. Fact protection
Если selected operation = in_progress/completed:
обычная смена варианта запрещена.
Вернуть понятный conflict.

## 11. Scheduler
Single и mass Scheduler:
1. load snapshot graph
2. resolve variant selection
3. build effective DAG only from selected ONE OF nodes
4. Demand only selected member
5. plan only selected member
6. сохранить обычный sequential/parallel/join traversal.

## 12. Effective graph
Сделать service/helper типа:
`resolve_effective_route_snapshot(card_id)`

Возвращает:
- ordinary nodes
- selected ONE OF nodes
- excluded alternatives
- effective edges

Persisted snapshot не мутировать.

## 13. Edges around group
Поддержать logical:
`A -> group -> D`

UI не должен вручную создавать A->B/A->C/A->E и все обратные edges.
Выбрать минимальную backend модель, совместимую с текущим DAG.

## 14. Kanban completion
Variant Group внутри Workshop считается выполненной, если selected member completed.
Не выбранные alternatives не учитываются.

## 15. Demand
Demand endpoint:
- totals только selected member
- alternatives можно вернуть metadata `not_selected`
- не суммировать все варианты.

## 16. Calendar queue
Preliminary selection уже участвует в обычной очереди.
Не создавать отдельную preliminary queue.
DTO желательно содержит selection status.

## 17. API
Нужны минимальные contracts:

Routing template:
- Variant Groups CRUD через graph save contract.

TechnicalCard:
- read variant selection state.

Set/change selection:
`PATCH /technical-cards/{id}/route-variants/{group_id}` или эквивалент.

Confirm:
отдельный action или ясный status change.

Result:
- selected option
- status
- requires_replan
- plan/deadline impact если доступно.

## 18. History
Если уже есть TechnicalCard history, записывать:
- variant selected
- variant changed
- variant confirmed

Не создавать отдельную audit subsystem.

## 19. Existing routes/backfill
Маршруты без Variant Groups работают как раньше.
Никаких variant groups автоматически не создавать.
VIS-STRESS не менять.

## 20. Первый use case
Workshop `Раскрой`
Variant Group `Способ раскроя`
Members:
- Ручной раскрой
- Раскрой настилом
- Раскрой лазером
Default:
- Раскрой настилом

При создании ТК:
- настил selected
- preliminary
- Scheduler сразу резервирует capacity настила

После change to laser:
- после replan используется только laser.

## 21. Optional operations
Не расширять задачу до conditional rules engine.
`Дизайн / без дизайна` пока не реализовывать.
Главная задача = ONE OF.

## 22. Migration
Reversible Alembic migration:
- upgrade
- downgrade
- isolated cycle
- alembic check

## 23. Concurrency
Selection change и schedule не должны оставлять смешанный plan старого и нового варианта.
Использовать transaction/locking в текущем стиле Scheduler.

## 24. Self-check
A. Template:
- create group
- members
- default
- invalid empty group
- duplicate membership rejected

B. Snapshot:
- group copied
- template edit does not mutate TK

C. Effective graph:
- only selected member active
- alternatives excluded

D. Scheduler:
- preliminary plans
- confirmed plans
- change selection moves demand/capacity
- sequential dependencies preserved

E. Kanban:
- unselected alternatives do not block
- selected required operation blocks until completed

F. Fact protection:
- change before start allowed
- change after in_progress/completed rejected

## 25. Tests
Targeted:
- template persistence
- graph validation
- snapshot variant persistence
- preliminary default
- missing default blocker
- effective DAG
- scheduler preliminary
- scheduler changed selection
- Kanban completion
- fact protection
- mass scheduler mixed variants
- immutable snapshot

Regression:
- routes without variants
- explicit parallel
- join
- single/mass scheduler
- manual/locked
- calendar API

Full:
- backend tests
- project check 10/10
- migration cycle
- git diff --check

## 26. Не делать
- frontend
- conditional design/no-design
- AI/autoselection
- earliest-ETA selection
- реальные нормы
- WorkCenter changes
- realistic stress-test
- удаление VIS-STRESS
- commit/push/merge

## 27. Acceptance
Готово, если:
1. Routing поддерживает ONE OF Variant Group
2. group snapshot immutable
3. preliminary default создаётся при создании ТК
4. Scheduler использует preliminary выбор для ETA/queue
5. только selected member создаёт Demand/Capacity
6. operator может изменить selection
7. selection можно confirm
8. change корректно требует/делает replan
9. fact защищён
10. Kanban учитывает только selected member
11. обычные маршруты и explicit parallel не сломаны
12. VIS-STRESS сохранён

Финальная строка:
`PC-04.4I VARIANT ROUTING ONE-OF RUNTIME READY FOR UI`

## Попытка выполнения — 2026-10-08: filesystem blocker

Задача не выполнена и не закрыта. Проверена текущая интеграция PC-04.4G: snapshot nodes/edges, Demand snapshot loader, Scheduler и fact gates уже существуют. Для ONE OF необходимо сохранять template group metadata, immutable copy группы в ТК и отдельное mutable selection state; ordinary parallel edges эту семантику не заменяют.

Начатая реализация остановлена на обязательной миграции `backend/alembic/versions/b8c9d0e1f234_route_variants.py`. `apply_patch` сообщил `Failed to write file`, повторная штатная запись Python в тот же разрешённый workspace путь — `PermissionError: [Errno 13] Permission denied`. Файл не создан. Escalation запрещена текущим permission profile (`approval_policy=never`); обход ограничений не выполнялся.

Только начатые изменения этой итерации откатились: JSON imports/variant fields в двух моделях и новый variant schema. Предыдущий WIP PC-04.4G и остальных задач сохранён. Runtime ONE OF, selection API, effective DAG и migration не установлены; нельзя объявлять предварительный выбор готовым для Scheduler/UI. VIS-STRESS, планы, allocations, нормы, WorkCenter, frontend не менялись; stress/seed/live mass commands и migrations не запускались. Commit/push/merge не выполнялись.

Для продолжения необходим рабочий доступ сеанса к созданию миграций в `backend/alembic/versions`; после восстановления доступа можно выполнить эту же PC-04.4I. Roadmap и project-structure checklist не менялись; HTML twins не затронуты, завершение не отмечено.

Проверка после отката: existing snapshot-runtime + routing-graph suites —21 passed; `git diff --check` passed. Новые schema/service/migration файлы отсутствуют, variant columns/imports убраны из моделей. Лог: `logs/pc-04-4i-restored-regression.log`. Полный project check и migration cycle для ONE OF не заявляются: реализация не установлена.

## Выполненная итерация — 2026-10-08: PC-04.4I

**Статус: backend CLOSED, READY FOR UI.** Выбрана владельцем после PC-04.4G;
предыдущий filesystem blocker снят. До изменений успешно выполнена запись/чтение
уникального probe в `backend/alembic/versions`; удалён только собственный probe.
Ветка `main`; commit/push/merge и production apply не выполнялись.

### Что поставлено

- ONE OF как отдельная семантика frozen `RoutingGraph`: группы, ordered membership,
  default, active, логические edges `A -> group -> D`; ALL parallel сохранён.
- `PUT /shop-routings/{template_id}/graph`: атомарный graph save с CRUD групп,
  валидацией операций/цеха/оборудования и сохранением line ids на прежних позициях.
  Legacy stages/edges PATCH для маршрута с группами требует graph save.
- Полная immutable копия группы в ТК; nullable default создаёт preliminary selection
  либо явный blocker `variant_not_selected`, без угадывания.
- Общий resolver выбора: effective DAG, excluded alternatives, unresolved groups.
  Demand и single/mass Scheduler планируют только выбранные узлы, включая preliminary;
  не выбранные alternatives не резервируют capacity и не создают assignments.
- Read/PATCH selection API: подтверждение, смена, actor/timestamps, existing audit;
  auto-default, selected/changed/confirmed записываются в существующий аудит.
- Смена освобождает auto plan прежнего member и по умолчанию выполняет атомарный replan
  с ETA/deadline impact в `ScheduleRead`. При blocked/deferred replan новый выбор сохранён,
  прежняя auto capacity освобождена, `requires_replan=true` и deviations явные.
- Manual/locked/card-plan-lock и started/completed факт выбранной операции или её
  successors защищены conflict 409. Selection, single/mass schedule и stage fact/start
  сериализуются общим advisory transaction gate в существующем стиле Scheduler.
- Kanban/current workshop/card completion учитывают selected required nodes;
  unresolved group блокирует completion; fact в excluded alternative невозможен.

Контракт: [variant-routing-one-of-pc-04-4i.md](../architecture/variant-routing-one-of-pc-04-4i.md).
Поля существующих Schedule/queue DTO сохранены; selection metadata доступна через
`GET /technical-cards/{id}/route-variants`. Read требует auth, write использует
существующий `technical_cards.create`, как Scheduler; новой audit subsystem нет.

### Файлы этой итерации

Новые:

- `backend/alembic/versions/b8c9d0e1f234_route_variants.py`;
- `backend/app/schemas/route_variants.py`;
- `backend/app/services/route_variants.py`;
- `backend/app/services/routing_graph_write.py`;
- `backend/tests/test_route_variants_pc_04_4i.py`;
- `backend/tests/test_route_variants_postgres_pc_04_4i.py`;
- `docs/architecture/variant-routing-one-of-pc-04-4i.md`.

Минимальные добавления поверх существующей реализации:

- API: `shop_routings.py`, `technical_cards.py`;
- models: `shop_routing.py`, `technical_card.py`;
- schemas: `routing_graph.py`;
- services: `routing_graph.py`, `route_snapshot.py`, `production_demand.py`,
  `production_demand_snapshot.py`, `production_scheduler.py`, `shop_routings.py`,
  `technical_card_stages.py`;
- этот task report, canonical roadmap/ERP/project-structure MD и соответствующие HTML,
  `roadmap-v1.1.md`/HTML, `production-calendar-v0.1.md`/generated HTML;
- `scripts/generate_production_calendar_roadmap.py`: только регистрация PC-04.4I,
  task link/dependency и число карточек для обязательной проверки generated twin.

### Models / migration

Миграция **`b8c9d0e1f234`**, parent **`a7b8c9d0e123`**, добавляет только:

- template JSON `route_variant_groups`;
- card immutable JSON `route_variant_groups`;
- card mutable JSON `route_variant_selections`.

Legacy rows получают `[]` / `{}`; группы автоматически не создаются.
Upgrade применён только к canonical local Docker PostgreSQL `:5432`;
`alembic check` — `No new upgrade operations detected`.
Upgrade → downgrade → upgrade проверен в isolated transaction/schema, существующие
rows сохранены; новая variant metadata ожидаемо снимается при downgrade.
WorkCenter, нормы, frontend, VPS и production DB не менялись.

### Self-check A–F

| Блок | Проверенное поведение | Результат |
|---|---|---|
| A Template | persistence, ordered members/default, logical edges, empty/duplicate/wrong member/workshop/cycle rejection, atomic failed save | PASS |
| B Snapshot | все members copied, preliminary default, null default, template edit не меняет snapshot/selection | PASS |
| C Effective graph | selected-only nodes/edges, excluded alternatives, explicit independent nodes без invented sequence | PASS |
| D Scheduler | preliminary/confirmed, real Demand/Capacity, selection transfer/replan/deadline result, blocked/deferred replan, sequential dependencies, mixed ordinary/preliminary/confirmed mass queue | PASS |
| E Kanban | selected required node блокирует до completed; alternatives не блокируют; unresolved group не завершает workshop/card | PASS |
| F Fact protection | pending change разрешена; in_progress/completed/manual/locked/card-lock conflict; old choice/plan сохранены при отказе | PASS |

Также PostgreSQL races: selection vs single schedule, selection vs mass schedule,
selection vs fact start — consistent selected node/plan, без смешанных вариантов.
Datasets — SQLite fixtures и UUID-owned PostgreSQL schemas; live stress/seed/schedule
commands не выполнялись.

### Все проверки

- **29 новых targeted tests** — PASS.
- **Self-check + PC-04.4G graph/snapshot regressions: 50 passed**.
  [Лог](../../logs/pc-04-4i-self-check-final.log).
- **Полный backend: 693 passed**, без skipped tests.
- **Полный project check: 10/10** — Python compile/import, OpenAPI,
  backend pytest, PostgreSQL, Alembic, frontend TypeScript/lint/tests/build,
  Docker Compose. **Frontend: 358 passed**, lint: 0 errors / 85 existing warnings.
  [Финальный лог](../../logs/pc-04-4i-project-check-final.log).
- `python scripts/generate_production_calendar_roadmap.py --check` — PASS.
- `git diff --check` — PASS; `git status --short` проверен.
- VIS-STRESS точное сравнение всех прежних полей до/после миграции — PASS:
  **30 cards / 125 stage rows / 125 operation rows**; assignments/allocations
  были 0/0 и остались 0/0. Новые variant fields пусты.
  [Evidence](../../logs/pc-04-4i-vis-stress-verification.json).

Первый ручной pytest из `backend/` без root PYTHONPATH обнаружил import-path конфликт
`scripts.seed_sales_dev` с существующим WIP `backend/scripts/` (environment/command,
не дефект ONE OF). Запуск из корня с корректным PYTHONPATH и штатный project check
проходят; исходники seed и существующий WIP для обхода не менялись.

### WIP, canonical sync и границы

До изменений сохранён byte baseline всех **116** существовавших WIP files в ignored
`logs/pc-04-4i-baseline/`. Все файлы сохранены; интеграционные изменения PC-04.4I
наложены поверх WIP без отката/стейджинга чужих изменений. **Frontend WIP byte-identical**,
existing tests/старые migrations/WorkCenter code сохранены. Incremental diff относительно
начала сеанса: [pc-04-4i-incremental.diff](../../logs/pc-04-4i-incremental.diff).

PC-04.4I добавлена/закрыта как отдельный backend checkpoint; прежние notes и checkbox
соседних задач не переписаны. ERP-check явно backend-only. **HTML twin synced**:
MD `[x]` ↔ HTML `done: true` в roadmap, roadmap-v1.1 и project-structure;
детальный calendar HTML заново сгенерирован и проверен.

Обязательный `git diff --` по roadmap.md, roadmap.html, project-structure.md,
project-structure.html и erp-check.md сохранён для ревью:
[canonical-git.diff](../../logs/pc-04-4i-canonical-git.diff).
В нём виден и прежний WIP; incremental diff отделяет только эту итерацию.

Новых P0/P1 нет. P2: existing lint/deprecation warnings, вне этой задачи;
новых P3/visual findings нет, UI не менялся. Cross-workshop parallel Kanban остаётся
в прежних границах PC-04.4G. Conditional rules/design-no-design/autoselection,
realistic norms/stress test не добавлялись.

Осталось: отдельная **PC-04.4J** — frontend choice/confirmation и owner visual acceptance.
Это рекомендуемая следующая итерация, она не начата. Общие PC-03/PC-04 и прочие
открытые checkpoints не закрыты; переход roadmap stage не выполнялся.

`PC-04.4I VARIANT ROUTING ONE-OF RUNTIME READY FOR UI`
