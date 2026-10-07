# PC-03.5A — Automatic Entry Stage for Production Queue

## Контекст
Модуль: Production Calendar / «Производственный календарь».
Работа выполняется параллельно с Cursor PC-03.5B.
Codex меняет backend/DB/API/service logic; frontend не менять.

Текущая постановка задания позволяет менеджеру выбрать любой участок и вручную задать позицию очереди. Это неверно:
- менеджер не должен выбирать «Печать», пока не завершён дизайн;
- менеджер не знает фактическую очередь производства;
- новая работа должна попадать в безопасную стартовую стадию.

## Цель
Сделать добавление работы в календарь бизнес-операцией:
**«Поставить в производственную очередь»**
с автоматическим стартовым состоянием.

## 1. Новая стартовая стадия
Добавить/зафиксировать стадию:
**Подготовка к запуску**

Она является стартовой стадией нового назначения Production Calendar.

К этой стадии относится:
- готовность/закупка материала.

Закупка остаётся milestone/readiness, без часовой мощности.

Существующие производственные стадии после подготовки сохраняются.
Не перестраивать весь production workflow в этой задаче.

## 2. Создание CalendarAssignment
При создании нового назначения:
- frontend не передаёт участок/stage как пользовательский выбор;
- backend автоматически устанавливает стартовую стадию `Подготовка к запуску`;
- пользователь передаёт только существующую ТК/reference, дату и optional note;
- quantity брать из связанной ТК/reference по существующему контракту, если это уже принято в PC-03.1.

Не требовать от менеджера производственных параметров.

## 3. Позиция в очереди
Убрать `position` из обязательного create payload.

Позиция должна назначаться системой автоматически:
- новое назначение помещается в конец очереди выбранной даты/стартовой стадии;
- порядок должен быть стабильным;
- существующий ручной reorder/move contract можно сохранить для диспетчера, если он уже используется UI-E.

Не удалять поле из модели, если оно нужно текущему ordering contract.
Изменить именно create semantics.

## 4. Ограничение стадий
Нельзя при первичном создании напрямую поставить заказ в:
- Печать;
- Раскрой;
- Пошив;
- Упаковку.

Первичное создание всегда идёт через `Подготовка к запуску`.

Не строить в этой задаче полный автоматический dependency engine.
Существующие дальнейшие переходы/ручное планирование сохранить.

## 5. API contract
Сделать create payload минимальным, например по смыслу:
- technical_card/reference id;
- planned_date;
- optional note.

Точный контракт определить по существующим моделям, не создавать дубликаты идентификаторов.

Response должен возвращать фактически назначенные:
- stage;
- position;
- reference;
- date;
- note.

## 6. Совместимость
Проверить существующие CalendarAssignment и UI-E:
- редактирование существующего назначения не сломать;
- ручное планирование диспетчера сохранить;
- migrations делать только если реально нужна новая persistent stage/key.

Предпочтение: переиспользовать существующий ProductionStage/WorkCenter contract.

## Не делать
- не менять frontend;
- не строить полный workflow/dependency engine;
- не реализовывать Dashboard/Center;
- не менять capacity logic кроме необходимости зарегистрировать новую stage;
- не делать commit/push/merge.

## Backend tests
Минимум:
- create без stage/section;
- create без position;
- backend назначает `Подготовка к запуску`;
- auto-position = конец очереди;
- два последовательных create получают стабильный порядок;
- прямой пользовательский выбор будущей стадии не требуется/не применяется;
- move/edit существующего assignment продолжает работать;
- persistence после reload.

## Проверки
- targeted backend tests;
- full backend tests;
- Alembic upgrade/downgrade/upgrade, если migration;
- project check;
- git diff --check.

## Acceptance
Менеджер может поставить ТК в очередь, передав только ссылку на ТК, дату и optional note.
Backend сам определяет стартовую стадию и позицию.


## Результат Codex — 2026-10-05

**PC-03.5A CLOSED (backend).** Прямой выбор владельца после PC-03.4D, параллельный frontend PC-03.5B не выполнялся/не закрывался Codex. Общий PC-03 остаётся открытым. Контракт для Cursor [Automatic queue entry](../architecture/production-calendar-entry-pc-03-5a.md) зафиксирован до реализации.

### Что реализовано / контракт

- Новая запись существующего **ProductionStage**: code **launch_preparation**, name **«Подготовка к запуску»**, is_active=true, sort_order=0. В локальном каталоге прежние стадии имеют sort_order10…90; они и их IDs/порядок не менялись. Не новый справочник/тип очереди, не новый WorkCenter. Маршруты/стадии/факт ТК не переписываются.
- **POST `/production-calendar/assignments`** принимает только `{technical_card_id:42,planned_date:"2026-10-12",note:null}`; note optional. Stage/section/position/quantity как extra fields →422, нельзя первично попасть прямо в Печать/Раскрой/Пошив/Упаковку. Backend возвращает прежний AssignmentRead со своими stage/position/reference/date/note/quantity/timestamps. DTO read явно сохраняет stage/position после минимизации Create DTO.
- Системная позиция: пустая дата/preparation →0, иначе max(position)+1 на этой дате и стадии. Existing rows не resequence. **Postgres FOR UPDATE lock на entry-stage row** сериализует создающие транзакции даже для пустой даты; 8 concurrent creates проверены на настоящем API/DB. 32-bit tail overflow →409, не DB500.
- Повтор с той же TC/preparation парой, date и note возвращает прежний id и текущую позицию; несовместимый repeat →409. Existing UNIQUE(TC,stage) сохранён. После dispatcher move в другую стадию новый POST может создать отдельное preparation назначение по прежнему pair контракту — это не global lifecycle/idempotency engine.
- **PUT `/production-calendar/assignments/{id}`** по-прежнему `{production_stage_id,planned_date,position,note}`, доступен диспетчеру, включая последующий ручной перенос на действующий производственный участок. Existing assignment IDs/данные сохранены. DELETE/source search/права прежние; quantity читается из ТК и не копируется новым editable полем. Источник standalone draft/in_progress валидируется как прежде.
- Отсутствующий/неактивный entry stage → явный503, без fallback или создания стадии на лету. Migration требуется перед новым POST. Нет требований перед сохранением исправить capacity warning.
- Единственное необходимое capacity registration изменение: existing key **procurement** теперь stage_code=launch_preparation. Он остаётся **milestone**, без editable hours/base capacity/rates; load-state unknown/milestone, без процентов. Готовность/закупка материала относятся к подготовке, но из BOM/PO автоматически не выводятся. Другие capacity formulas/resources не менялись.

### Миграция и совместимость

**w2x3y4z5a678**, parent v1w2x3y4z567: data-only INSERT одной стадии; CalendarAssignment schema/поля/constraints не менялись, backfill/reorder старых назначений нет. Upgrade отказывается перезаписывать конфликтующие stage code/name. Downgrade проверяет canonical unused seed и **все** FK references через inspector, включая SET NULL/CASCADE; modified/referenced stage →RuntimeError/rollback, назначения/ресурсные ссылки не удаляются. Production/VPS/tunnel не затрагивались.

Frontend task PC-03.5B получает точные JSON request/response examples в architecture contract. Легаси frontend POST со stage/position теперь намеренно несовместим по прямой задаче владельца; его адаптация/UX принадлежит Cursor. Параллельные frontend WIP видны в рабочем дереве, Codex их не редактировал. PUT UI-E не менялся. Live frontend acceptance PC-03.5B этой задачей не заявляется.

### Изменённые файлы Codex

Backend: `app/schemas/production_calendar.py`, `app/services/production_calendar.py`, `app/api/production_calendar.py`, `app/services/production_capacity.py` (только procurement stage registration), `alembic/versions/w2x3y4z5a678_launch_preparation_stage.py`, `tests/test_production_calendar.py` (existing fixture/expectations адаптированы к новому create), `tests/test_production_calendar_entry.py`.

Docs: эта задача; `architecture/production-calendar-entry-pc-03-5a.md`, `production-calendar-capacity-pc-03-4a.md`, `production-calendar-implementation-v0.1.md`, `project-structure.md`, `erp-check.md`; roadmaps `roadmap.md`, `roadmap-v1.1.md`, `production-calendar-v0.1.md`; twins `erp/status/roadmap.html`, `erp/status/roadmap-v1.1.html`, `erp/status/project-structure.html`, `roadmap/production-calendar-v0.1.html`; generator adds PC-03.5A/30 cards. Unrelated existing WIP preserved.

### Проверки

- Targeted entry/calendar/capacity tests: **61 passed**, **16 новых entry tests**: minimal create without stage/position, assigned preparation and quantity, date/stage tail/gaps/order, idempotent retry preserving manual position, legacy fields rejected, dispatcher edit/read/delete, original legacy assignment preserved, missing/inactive stage503, permissions, procurement milestone, integer bound and OpenAPI create/read/update shapes. Existing calendar/capacity tests сохраняют coverage; 2 warnings Starlette/httpx + existing pytest cache path.
- **Project check 10/10 / exit0**: backend **529 passed / 71 warnings**, frontend **324 passed** (snapshot includes independent Cursor PC-03.5B WIP), lint **0 errors / 84 прежних warnings**, TypeScript, build, OpenAPI, Compose/Alembic passed. Frontend checks отражают текущее общее рабочее дерево; Codex не исправлял frontend.
- **Local Postgres :5432 migration**: upgrade/check/downgrade/upgrade/check прошёл. Прежние stage rows (id/name/code/is_active/sort_order) и assignment rows сравнивались полностью; unchanged. TC/WorkCenter/settings/exceptions counts preserved **4/8/2/0**. Existing queues не удалялись; capacity migration не откатывалась. Final local revision w2x3y4z5a678.
- **Real API/Postgres**: 8 temporary standalone TC → eight concurrent minimal POST → unique contiguous tail positions; automatic canonical stage/name, repeated POST same id/position; explicit stage/position →422; dispatcher PUT to printing and another date → fresh authenticated GET reload with same id, position, note, quantity. Guarded downgrade while own preparation assignments exist → refusal, all 7 remaining prep assignments and revision preserved. No backend fallback/demo substitution.
- Marker-checked QA group/cards/assignments/user/session/role/SalesUser удалены в finally; seeded entry stage остаётся; существующие owner records не менялись. Only local Docker DB127.0.0.1:5432, no tunnel/VPS.
- Evidence ignored: `storage/pc-03-5a-targeted.log`, `pc-03-5a-migration-check.py/.log`, `pc-03-5a-live-check.py/.log`, `pc-03-5a-project-check.log`. `git diff --check` passed. Canonical diffs reviewed. **HTML twin synced**: PC-03.5A [x] ↔ done:true в active roadmap/project-structure; PC-03 [ ] ↔ done:false. Generator --check passed.

### Границы / следующий шаг

P0/P1 новых нет. P2 — прежние warnings; create stage-row lock сериализует новые подготовки разных дат (простое решение малой очереди), без shift/workflow engine. P3 новых нет/визуальная проверка не применима к backend-only scope. Никаких frontend/nav/shell/UI-G/H изменений Codex; не добавлены автоматические дальнейшие переходы, дизайн/материал launch gates, MES/APS или capacity engine. ERP-check оставляет полный календарь [ ]; закрыта только backend readiness entry operation.

Следующее: отдельная проверка frontend PC-03.5B на минимальном контракте и короткий integrated create scenario; автоматически не запускались. **Commit/push/merge/tag не выполнялись.**
