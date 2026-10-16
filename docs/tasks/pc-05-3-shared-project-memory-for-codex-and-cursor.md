# PC-05.3 — Shared Project Memory for Codex + Cursor

## Исполнитель
Codex

## Цель
Создать единый компактный слой проектной памяти для Codex и Cursor, чтобы агенты не переисследовали весь репозиторий перед каждой задачей.

Новый canonical context flow:

`Task -> Project Memory -> targeted DF / Invariant / UI context -> targeted code`

а не:

`Task -> repo-wide scan -> rediscover architecture -> change code`

---

## 1. Создать `SL-PROJECT-MEMORY-v1`

Файл:

`docs/architecture/SL-PROJECT-MEMORY-v1.md`

Это не полная документация проекта.

Это компактная оперативная память текущего состояния проекта, которую агент должен читать первой после task-файла.

### Содержимое

Только устойчивый/current context:

- stack и структура backend/frontend;
- canonical modules;
- source-of-truth сущности;
- ключевые routes/screens;
- текущая production architecture;
- Model / Assembly / Routing / Snapshot semantics;
- Demand / Capacity / WorkCenter semantics;
- Scheduler / Calendar / Kanban semantics;
- Diagnostics / Debug Center architecture;
- завершённые guards/invariants IC-G01...current;
- current open P0/P1;
- известные legacy gaps;
- important filenames/services/modules;
- существующие canonical docs и когда их использовать.

Не копировать содержимое `SL-DATA-FLOW-v1` целиком.

Целевой размер:
примерно 200–400 строк.

---

## 2. Создать UI memory для Cursor

Файл:

`docs/architecture/SL-UI-CONTEXT-v1.md`

Содержать только устойчивый frontend/UI context:

- platform shell;
- sidebar/topbar contracts;
- workspace routes;
- approved layout patterns;
- `SL-UI-BASE-v1`;
- TechnicalCard UI structure;
- Production Calendar UI;
- Debug Center UI;
- canonical reusable components;
- responsive rules;
- visual contracts that must not be broken;
- locations of main frontend modules/components.

Не превращать файл в каталог всех компонентов.

---

## 3. Обновить `AGENTS.md`

Добавить короткое правило маршрутизации контекста.

### Required context order

Для любой задачи:

1. прочитать task-файл;
2. прочитать `SL-PROJECT-MEMORY-v1`;
3. определить затронутые сущности/modules;
4. открыть только релевантные:
   - `DF-*` sections из `SL-DATA-FLOW-v1`;
   - invariant из `SL-INVARIANT-COVERAGE-v1`;
   - UI sections из `SL-UI-CONTEXT-v1`;
5. только затем выполнять targeted code search.

### Запрет
Не выполнять repo-wide discovery/re-audit, если:
- задача не требует архитектурного аудита;
- нужный контекст уже подтверждён canonical memory/docs.

Разрешено расширять поиск только если:
- memory устарела;
- обнаружена зависимость вне текущей цепочки;
- code contradicts canonical docs.

В таком случае сначала зафиксировать conflict.

---

## 4. Mandatory memory update rule

Если задача меняет canonical architecture или project state:

обновлять только релевантные части:

- `SL-PROJECT-MEMORY-v1`
- `SL-DATA-FLOW-v1`, если изменилась data-flow semantics;
- `SL-INVARIANT-COVERAGE-v1`, если изменился guard/invariant;
- `SL-UI-CONTEXT-v1`, если изменился approved UI contract.

Если изменений нет, в отчёте:

`Project memory: no changes required`

Не обновлять документы механически при каждом task.

---

## 5. Cursor rules

Найти существующий canonical способ хранения Cursor project rules в репозитории.

Если используется `.cursor/rules`:
создать/обновить минимальное правило, которое направляет Cursor:

1. task;
2. `SL-PROJECT-MEMORY-v1`;
3. `SL-UI-CONTEXT-v1` для frontend;
4. targeted `DF-*`/invariant только если задача затрагивает contract/data;
5. targeted files only.

Если проект использует другой Cursor rules mechanism — использовать его.

Не создавать параллельные правила в нескольких местах.

### Cursor-specific restriction

Для frontend-задач:
- не сканировать весь `frontend`;
- сначала определить page/feature scope;
- открывать конкретные components/hooks/api clients;
- не читать backend internals без изменения API/data contract.

---

## 6. Codex-specific rule

Для backend/architecture задач:

- не сканировать весь repo;
- использовать memory + relevant `DF-*` / invariant;
- искать code symbols/files только по конкретным entities/services;
- не перечитывать закрытые IC tasks без необходимости.

---

## 7. Context conflict rule

Если code расходится с `SL-PROJECT-MEMORY-v1`:

не доверять памяти молча.

Агент должен:

1. проверить минимальный участок кода;
2. определить, что является текущей истиной;
3. исправить memory, если она устарела;
4. продолжить задачу.

---

## 8. Token-efficiency rules

Добавить в общие agent rules:

- не читать большие документы целиком, если есть section IDs;
- не читать task history целиком;
- не повторять архитектуру в финальных отчётах;
- не запускать full test suite после каждого локального изменения;
- targeted tests first, full check once at end;
- не обновлять roadmap/ERP-check/HTML twins несколько раз за одну задачу.

---

## 9. Bootstrap content

`SL-PROJECT-MEMORY-v1` собрать из текущих canonical docs и реального кода только один раз в рамках этой задачи.

Использовать:
- roadmap;
- ERP-check;
- project structure;
- `SL-DATA-FLOW-v1`;
- `SL-INVARIANT-COVERAGE-v1`;
- текущие IC-G01...latest results.

Не читать историю всех task-файлов.

---

## 10. HTML не требуется

Для `SL-PROJECT-MEMORY-v1` HTML twin не нужен.

Это agent-facing memory.

`SL-UI-CONTEXT-v1` также без HTML.

---

## Проверки

Проверить на двух mock scenarios:

### Backend example
`Изменить stale-plan guard`

Ожидаемый context:
- Project Memory
- relevant IC invariant
- relevant DF sections
- targeted backend files

Без repo-wide scan.

### Frontend example
`Изменить Debug Center card`

Ожидаемый context:
- Project Memory
- UI Context
- targeted frontend components

Без полного чтения frontend/backend.

---

## Не делать

- не менять business/runtime code;
- не менять DB;
- не делать architecture refactor;
- не запускать IC-G05/IC-FINAL;
- не commit/push.

---

## Acceptance

Готово, если:

1. создан `SL-PROJECT-MEMORY-v1.md`;
2. создан `SL-UI-CONTEXT-v1.md`;
3. `AGENTS.md` содержит targeted-context rules;
4. Cursor получает те же правила через canonical Cursor project rules;
5. memory update rules зафиксированы;
6. repo-wide rediscovery запрещён по умолчанию;
7. mock backend/frontend context lookup работает;
8. task report коротко показывает, какие файлы теперь являются canonical context sources.

Финальная строка:

`PC-05.3 SHARED PROJECT MEMORY ACTIVE FOR CODEX AND CURSOR`

## Результат — 2026-10-11

PC-05.3 выполнен по прямому выбору владельца после IC-G04. Это отдельная документационная итерация; следующий integrity backlog IC-G05 не запускался.

Canonical context sources теперь:

- `docs/architecture/SL-PROJECT-MEMORY-v1.md` — 285 строк текущей общей памяти, PM-* index, sources/ownership, ключевые modules/routes, IC-G01…04, open P1, dated legacy evidence, production/local boundaries и context conflicts.
- `docs/architecture/SL-UI-CONTEXT-v1.md` — UI-* index, protected shell, existing SL-UI-BASE references/ограничение, approved patterns, TechnicalCard/Calendar/Debug, shared primitives и responsive contracts.
- `AGENTS.md` — task → memory → relevant DF/invariant/UI → targeted code; conditional updates, recorded conflicts и targeted checks before one final full check.
- `.cursor/rules/project-memory.mdc` — одно alwaysApply правило того же маршрута, без параллельного rules mechanism. Frontend presentation work не читает backend без contract change.

Bootstrap конфликты записаны в PM-CONFLICTS: старое имя branch в roadmap против main, исторический matrix narrative против IC-G04 rows, shell summary260 против current token max(220px,10vw); отдельный SL-UI-BASE-v1 document не найден. Минимальный targeted код подтвердил текущий контекст; historical source docs не переписывались и новый visual contract не придумывался. Memory не заменяет canonical contracts или verified code.

Mock backend «Изменить stale-plan guard»: PM-PLAN/GUARDS/STATE → IC-OV-05/IC-SW-04 → DF-SCHEDULER-CALENDAR/DEMAND-CAPACITY/DIAGNOSTICS → calendar_plan_freshness/demand_input_guard/lifecycle + focused tests. PASS, без repo-wide discovery.

Mock frontend «Изменить Debug Center card»: PM-DIAGNOSTICS → UI-DEBUG/SHARED → platform-diagnostic-card, platform-debug helpers, readiness types + focused test. PASS, backend files не открывались в этом сценарии. Это проверка context lookup, не runtime mutation этих сценариев. Evidence: `logs/pc-05-3/context-validation.json`.

Проверки: memory200–400 lines, local Markdown links, shared alwaysApply rule, named sections/exact paths, whitespace PASS; existing data-flow/invariant HTML --check PASS; project check10/10 PASS, 896 backend/391 frontend tests PASS. Полная suite запускалась один раз в конце. Existing warnings не маскировались. `git diff --check` и final status проверены; canonical diffs сохранены в `logs/pc-05-3/canonical-docs.diff`.

Файлы этой итерации: два новых memory MD, AGENTS, одно Cursor rule, task report, root roadmap/project-structure/ERP-check и существующие status HTML twins. Новых memory HTML нет по explicit task requirement. Runtime/business/API/DB/models/migrations/UI не менялись; существующий WIP сохранён. Browser/responsive runtime проверки не требуются для документационного scope.

Project memory: created and bootstrapped. Data-flow: no changes required. Invariant guard semantics: no changes required. P0/P1 не добавлены; ранее открытые IC-RS-01/IC-RS-05 остаются P1, matrix P0=0/P1=2/P2=13/P3=26. Только PC-05.3 checkpoint отмечен выполненным, owner review pending; общий PC-05 не закрыт. **HTML twin synced**.

Рекомендуемая следующая integrity итерация: IC-G05 — completeness применённого snapshot. IC-G05/IC-G06/IC-FINAL не начаты; commit/push не выполнялись.

PC-05.3 SHARED PROJECT MEMORY ACTIVE FOR CODEX AND CURSOR
