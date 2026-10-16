# PC-04.4G-B/C — Unified Routing Runtime Integration + Self-Check

## Исполнитель
Codex

## Контекст
PC-04.4G-A завершена.

Уже есть:
- общий graph DTO;
- DAG validator;
- read-only API шаблона маршрута;
- read-only API snapshot ТК;
- архитектурный документ `docs/architecture/unified-routing-graph-pc-04-4g.md`.

Подтверждён P1:
**Scheduler читает изменяемый live Routing template вместо snapshot конкретной TechnicalCard.**

PC-04.4G после этой задачи должна быть закрыта полностью.

## Главная цель
Сделать единый runtime-контур:

`Routing template`
→ при создании ТК
`immutable TechnicalCard route snapshot`
→ одновременно:
- Kanban = фактический текущий Workshop/цех;
- Scheduler/Calendar = план дочерних TechOperation;
- dependencies = те же snapshot edges.

После создания ТК изменения live Routing template НЕ должны менять маршрут ТК, порядок операций, Scheduler plan и Kanban workshop flow.

---

## 1. Канонические правила

### 1.1 Единственный шаблон маршрута
`/settings/catalogs/routings` остаётся единственным источником шаблона производственного маршрута.

Не создавать calendar routing, scheduler routing или второй dependency catalog.

### 1.2 Родитель = Workshop / Цех
Kanban работает по Workshop.

### 1.3 Дочерние узлы = TechOperation
Calendar/Scheduler работают по конкретным TechOperation внутри Workshop.

### 1.4 Последовательность по умолчанию
Если explicit dependency graph не задан, операции идут последовательно в порядке маршрута.

Параллельность только explicit.

### 1.5 Автоматический переход Kanban
ТК остаётся в текущем Workshop, пока не завершены все обязательные child operations этого Workshop.

После завершения всех required child operations:
- текущий цех считается завершённым;
- ТК автоматически переходит в следующий Workshop snapshot graph.

---

## 2. Snapshot persistence

Сделать snapshot маршрута полноценным persisted runtime source.

Snapshot должен сохранять минимум:

### Workshop node
- stable snapshot id;
- source workshop id;
- source workshop name/code snapshot;
- order/position.

### Operation node
- stable snapshot id;
- source routing node/stage id;
- source TechOperation id;
- source TechOperation name/code snapshot;
- workshop snapshot id;
- position/order;
- required flag;
- runtime metadata, реально нужные Scheduler/Kanban.

### Dependency edge
- predecessor snapshot operation id;
- successor snapshot operation id.

Не читать live names/order/dependencies для runtime после создания snapshot, кроме безопасного display enrichment, не влияющего на поведение.

---

## 3. Snapshot creation

При создании новой TechnicalCard:
1. определить Routing;
2. загрузить validated DAG;
3. создать immutable snapshot;
4. сохранить Workshop nodes;
5. сохранить Operation nodes;
6. сохранить Dependencies;
7. при необходимости зафиксировать snapshot version/source metadata.

Если Routing невалиден, ТК не должна получать частичный snapshot.

Операция atomic.

---

## 4. Existing TechnicalCard backfill

Нужна migration/backfill для существующих ТК.

Правила:
1. если корректный snapshot уже есть — не дублировать;
2. если snapshot отсутствует — построить его из текущего Routing template;
3. если template неоднозначен/невалиден — не угадывать;
4. проблемные ТК перечислить в отчёте.

VIS-STRESS-001…030 НЕ удалять.

---

## 5. Migration

Создать минимальную reversible migration только для реально нужных snapshot/runtime полей/таблиц.

Требования:
- upgrade;
- downgrade;
- alembic check;
- upgrade/downgrade/upgrade в isolated schema;
- локальная Postgres обновляется безопасно.

Если существующие таблицы уже позволяют persistence без migration — использовать их и объяснить почему.

Не создавать duplicate graph tables без необходимости.

---

## 6. Scheduler — главный P1 fix

Scheduler должен перестать читать live Routing template для существующей ТК.

После исправления:

Single-card Scheduler:
`TechnicalCard snapshot graph -> plan`

Mass Scheduler:
`каждая ТК -> её snapshot graph`

Не использовать live Routing order/dependency для runtime planning.

---

## 7. Scheduler traversal

Использовать snapshot dependencies.

### Sequential
A -> B  
B не раньше завершения A.

### Explicit parallel
A -> B  
A -> C  
B и C могут идти параллельно, если capacity позволяет.

### Join
B -> D  
C -> D  
D стартует только после завершения B и C.

Текущий forward scheduler сохраняется.

---

## 8. CalendarAssignment linkage

CalendarAssignment должен однозначно ссылаться на snapshot operation node.

Не на mutable live template node как runtime source.

Если сейчас есть `routing_stage_line_id`, нужно:
- либо переопределить его семантику на snapshot line;
- либо добавить явную snapshot FK;
- не оставлять ambiguous runtime contract.

В отчёте описать точное решение.

---

## 9. CalendarAllocation

Не менять основную модель allocation.

Allocation остаётся:
- assignment;
- resource/work_center;
- date;
- amount;
- unit.

Но assignment должен относиться к snapshot operation.

---

## 10. Read-only graph API

Обновить/проверить API:

### Template graph
Для редактора маршрута.

### TechnicalCard snapshot graph
Для:
- read-only отображения;
- Scheduler diagnostics;
- будущей TechnicalCard graph visualization.

Snapshot API должен возвращать:
- workshops;
- operations;
- dependencies;
- current workshop;
- operation fact status, если уже существует;
- planned assignment data при необходимости отдельным слоем.

Не смешивать template и snapshot DTO.

---

## 11. Operation fact contract

Определить фактический статус конкретной operation node.

Проверить существующие сущности:
- TechnicalCardOperationLine;
- production status;
- stage status;
- history;
- Kanban transitions.

Не вводить большой execution module.

Нужен минимальный однозначный источник:
- not_started
- in_progress
- completed
или текущий эквивалент.

Если подходящего поля нет — добавить минимальный persisted status на snapshot operation.

---

## 12. Automatic Workshop transition

Workshop считается completed, если все его required child operations = completed.

После этого:
- current workshop ТК -> следующий Workshop;
- Kanban отражает новое состояние автоматически.

Если explicit graph допускает параллельность между Workshop и runtime-факт этого не поддерживает однозначно, сохранить последовательный Workshop flow и документировать ограничение.

---

## 13. Kanban

`/production/tech-cards?view=kanban`

Backend source:
**current Workshop snapshot state**

Не отдельный ProductionStage order.

Kanban columns должны соответствовать Workshop/Shop из snapshot маршрута ТК / общей workshop taxonomy проекта.

Не менять frontend в этой задаче.

---

## 14. ProductionStage audit/final role

Финально определить роль ProductionStage.

Допустимо:
- status vocabulary;
- visual grouping;
- execution state.

Недопустимо:
- отдельный source of route order параллельно Routing.

Не удалять таблицу без необходимости.

---

## 15. Existing calendar dependency logic

Отдельная calendar dependency logic должна быть устранена как runtime source.

Разрешено оставить:
- computed/read-only visualization;
- compatibility DTO.

Но dependencies Scheduler берёт только из TechnicalCard snapshot graph.

---

## 16. Template edit isolation — обязательный тест

Критический сценарий:
1. создать Routing template A;
2. создать TK-1;
3. snapshot = A;
4. изменить Routing template:
   - поменять порядок;
   - добавить operation;
   - изменить dependency;
5. TK-1 snapshot НЕ меняется;
6. Scheduler TK-1 планирует по старому snapshot;
7. создать TK-2;
8. TK-2 получает новый template version.

Обязательный acceptance test.

---

## 17. Existing assignments

Миграция должна сохранить текущие:
- manual;
- locked;
- auto assignments;
- allocations.

Если assignment можно однозначно сопоставить snapshot operation — backfill FK.

Если неоднозначно:
- не угадывать;
- report;
- сохранить данные.

---

## 18. Recalculation

Повторный schedule существующей ТК использует её snapshot.

Изменение template не должно приводить к:
- новой операции в старой ТК;
- исчезновению старой операции;
- изменению dependency.

---

## 19. Mass Scheduler

Проверить:
- разные ТК могут иметь разные snapshot версии одного Routing;
- mass schedule корректно планирует каждую по её snapshot;
- shared capacity продолжает работать;
- priority logic не меняется.

---

## 20. Manual/locked compatibility

Не ломать:
- planning_mode;
- manual_adjusted;
- locked;
- manual_lock;
- plan_locked.

Snapshot migration не должна снимать блокировки.

---

## 21. TechnicalCard creation flows

Проверить все реальные способы создания ТК:
- standalone TechnicalCard;
- order-related TechnicalCard, если используется;
- legacy/demo flow.

Snapshot должен создаваться везде, где ТК становится производственной.

Если какой-то flow пока не поддержан — явно указать.

---

## 22. API compatibility

Не ломать существующий frontend без необходимости.

Если старые поля нужны — оставить compatibility aliases/read model.

Но runtime backend source должен быть snapshot.

---

# 23. Self-check phase — обязательна

После реализации Codex проводит отдельную самопроверку, не только pytest.

## Self-check A — repo search

По репозиторию найти все места, где Scheduler/Kanban/Calendar читают:
- live Routing;
- routing stage lines;
- ProductionStage order;
- calendar-specific dependencies.

Для каждого классифицировать:
- runtime source;
- display only;
- deprecated compatibility.

Не должно остаться скрытого live-template runtime чтения Scheduler.

## Self-check B — database inspection

На локальной Postgres проверить:
- количество ТК со snapshot;
- количество ТК без snapshot;
- orphan snapshot nodes;
- orphan edges;
- duplicate node ids;
- invalid dependencies;
- assignments без snapshot operation mapping;
- VIS-STRESS сохранён.

Вывести краткую таблицу.

## Self-check C — immutable snapshot proof

На тестовой ТК:
- сохранить snapshot;
- изменить template;
- сравнить snapshot before/after;
- подтвердить logical equivalence snapshot старой ТК.

## Self-check D — DAG

Проверить:
- cycle rejected;
- sequential accepted;
- parallel accepted;
- join accepted;
- orphan dependency rejected;
- cross-routing edge rejected.

## Self-check E — Kanban transition

Проверить:
- 3 child operations в Workshop;
- completed 1/3 -> остаётся;
- completed 2/3 -> остаётся;
- completed 3/3 -> автоматически следующий Workshop.

## Self-check F — Scheduler

Проверить:
- sequential;
- parallel;
- join;
- different snapshot versions;
- manual lock;
- mass schedule.

---

# 24. Tests

Минимум targeted:

## Snapshot
- create;
- immutable;
- backfill;
- invalid template;
- template version divergence.

## Scheduler
- no live template read;
- sequential snapshot;
- parallel snapshot;
- join snapshot;
- mass mixed snapshot versions.

## Kanban
- workshop current state;
- auto transition;
- required vs optional if supported.

## Persistence
- assignment -> snapshot operation;
- allocation preserved;
- migration backfill.

## Regression
- existing routing API;
- TechnicalCard API;
- single schedule;
- mass schedule;
- calendar board;
- manual planning;
- locked plan.

Full checks:
- backend tests;
- frontend tests if project check invokes;
- `python scripts/check_project.py`;
- `git diff --check`;
- Alembic cycle if migration exists.

---

## 25. Performance

Не нужен отдельный optimization project.

Но проверить:
- snapshot graph не загружается N+1 на каждый operation без необходимости;
- mass scheduler 30-card scale не деградирует очевидно из-за snapshot access.

Если есть простой query-count regression test — добавить.

---

## 26. Documentation

Обновить:
- `docs/architecture/unified-routing-graph-pc-04-4g.md`
- roadmap/ERP-check только если реально требуется;
- HTML twin по правилам проекта.

Добавить финальную схему:

`Routing template`
↓ on TechnicalCard creation
`TechnicalCard immutable route snapshot`
├── Workshop state -> Kanban
└── Operation DAG -> Scheduler -> Calendar

---

## 27. Что НЕ делать

- не делать frontend DnD;
- не менять Demand/Capacity;
- не менять WorkCenter rate;
- не заполнять нормы;
- не запускать realistic stress dataset;
- не удалять VIS-STRESS;
- не переписывать Scheduler с нуля;
- не делать backward scheduling;
- не commit/push/merge.

---

# 28. Acceptance

PC-04.4G полностью закрыта, если:

1. live Routing используется только как template;
2. TechnicalCard имеет persisted immutable snapshot;
3. Scheduler читает snapshot;
4. CalendarAssignment относится к snapshot operation;
5. Kanban отражает Workshop snapshot;
6. завершение всех required child operations автоматически двигает ТК дальше;
7. parallel dependencies поддержаны explicit graph;
8. default flow sequential;
9. template edit не меняет старую ТК;
10. новые ТК получают новую версию template;
11. mass Scheduler работает с разными snapshot versions;
12. manual/locked данные сохранены;
13. ProductionStage больше не является альтернативным source of route order;
14. отдельная calendar routing logic не используется runtime;
15. migration/backfill безопасны;
16. self-check A–F пройдены;
17. project check зелёный;
18. VIS-STRESS сохранён.

---

# 29. Формат финального отчёта Codex

## 1. Executive summary
- P1 устранён или нет;
- PC-04.4G закрыта или нет.

## 2. Architecture before/after
Короткая схема.

## 3. Snapshot persistence
- tables/fields;
- creation;
- immutability;
- backfill.

## 4. Migration
- revision;
- upgrade/downgrade;
- live DB result.

## 5. Scheduler
- exact source before;
- exact source after;
- traversal.

## 6. Kanban
- current Workshop source;
- automatic transition logic.

## 7. Calendar
- assignment mapping;
- deprecated calendar routing logic.

## 8. ProductionStage
- final role.

## 9. Self-check
Отдельно результаты:
- A repo search;
- B DB integrity;
- C immutability;
- D DAG;
- E Kanban transition;
- F Scheduler.

## 10. Tests
- targeted;
- full backend;
- frontend/project;
- migration cycle;
- diff check.

## 11. Compatibility
- existing ТК;
- manual/locked;
- VIS-STRESS.

## 12. Remaining gaps
Только реальные gaps, не будущие идеи.

## 13. Next task
Одной строкой:
`PC-04.4H — Visual Routing Graph Editor`
если backend contract полностью готов.

Финальная строка при полном успехе:

`PC-04.4G CLOSED — UNIFIED ROUTING SNAPSHOT IS THE RUNTIME SOURCE OF TRUTH`
