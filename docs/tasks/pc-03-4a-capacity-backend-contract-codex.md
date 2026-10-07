# PC-03.4A — Capacity Backend Contract

## Контекст
PC-03.1–03.3 завершены. Production Queue работает.
Следующий шаг — лёгкие мощности UI-F без MES/APS-усложнений.

Эта задача выполняется параллельно с Cursor PC-03.4B.
Cursor не должен менять backend/API/DB.
Codex не должен менять UI-F frontend, кроме минимальных contract fixtures/docs при необходимости.

## Цель
Реализовать минимальный backend-контракт мощностей для Production Queue.

## 1. Сначала аудит существующих сущностей
Проверить и переиспользовать:
- WorkCenter / Section;
- employees;
- equipment;
- существующие календари/графики работы;
- существующие production entities.

Не создавать дублирующие справочники.

## 2. Зафиксировать API-контракт
До реализации записать в отчёте точные payloads для:

### GET capacity settings
Возвращает список секций/ресурсов с:
- id/key;
- name;
- section/stage;
- unit;
- base capacity;
- working days / base schedule;
- editable fields;
- date exceptions.

### PUT/PATCH base capacity
Минимальный update базовой мощности.

### POST/PUT date exception
Дата + новое значение/недоступность + optional note.

### DELETE date exception
Удаление исключения.

Контракт должен быть простым и стабильным для Cursor.

## 3. Подтверждённые нормы v0.1

### Печать
- 4 плоттера;
- 15 пог.м/ч каждый;
- 1 каландр;
- 60 пог.м/ч;
- machine-hours и operator-hours отдельно.

### Раскрой
- общий пул 2 раскройщиков;
- поштучно 20 изделий/ч на человека;
- настил 40 изделий/ч на человека;
- лазер 100 изделий/ч;
- оператор лазера отдельно.

### Пошив
- доступные швеи × рабочие часы;
- трудоёмкость из существующей нормы техкарты/варианта сборки.

### Упаковка
- бригада 2 человека;
- 800 изделий / 10 ч на всю бригаду.

### Дизайн
- только явная/ручная оценка часов;
- тираж не множитель.

### Закупка
- milestone;
- часовая мощность не считается.

## 4. Persistence
Предпочтение:
1. использовать существующие сущности/настройки;
2. если невозможно — добавить минимальную новую таблицу settings/exceptions.

Не строить:
- capacity snapshots;
- ledgers;
- shift engine;
- conflict engine;
- auto-scheduling.

## 5. Load state service
Подготовить простой расчёт для будущей интеграции UI-A:
- reserve;
- near (80–100%);
- over (>100%);
- unknown.

Правила:
- unknown norm != 0;
- разные единицы не суммировать;
- ручное планирование не блокировать;
- расчёт warning-only.

Не подключать это к UI-A в этой задаче.

## 6. Scope файлов
Codex:
- backend models/schemas/services/api;
- Alembic, если реально нужна;
- backend tests;
- architecture/task docs.

Не менять:
- frontend UI-F;
- weekly board UI;
- navigation;
- UI-G/H.

## 7. Проверки
- targeted backend tests;
- full backend tests;
- Alembic upgrade/downgrade/upgrade, если migration;
- project check;
- git diff --check.

## Acceptance
Готово, если:
1. есть стабильный API-контракт;
2. настройки и исключения сохраняются;
3. reload возвращает данные;
4. есть лёгкий load-state calculation contract;
5. frontend может подключиться без дополнительной backend-разработки.

## Отчёт
Указать:
- какие существующие сущности переиспользованы;
- migration id, если была;
- exact endpoints + request/response examples;
- tests/checks;
- что намеренно не реализовано;
- подтвердить отсутствие commit/push.


## Результат Codex — 2026-10-05

**PC-03.4A CLOSED (backend only).** Выбран владельцем после PC-03.1–3, параллельно с Cursor PC-03.4B. Выполнена ровно backend-часть. Точные payloads зафиксированы **до реализации** в [Capacity API v1](../architecture/production-calendar-capacity-pc-03-4a.md); этот документ содержит GET response и все request/response примеры для Cursor.

### Реализация / reuse

- ProductionStage — существующий участок; WorkCenter — существующее оборудование (ADR-017). Не создавались новые ресурсы/станки/цеха/сотрудники. 14 logical keys — фиксированные роли/slots настроек, equipment bindings ссылаются на реальный WorkCenter; один станок нельзя привязать в два slots. Архивная/удалённая/непривязанная машина даёт unknown capacity. Existing catalog delete preserved (FK SET NULL), его API не менялся.
- Employee/PlatformUser/stage executors не являются доступным штатом смены; численность каталога не подставляется. График работы и capacity persistence в существующих моделях не обнаружены. Сохраняется только явно введённая productive availability; GET не пишет defaults.
- Две новые таблицы `production_capacity_settings` / `production_capacity_exceptions`; Numeric/Decimal, aware timestamps, JSON weekdays 0…6, nullable неизвестные значения; key PK + unique equipment, exception composite PK(key,date), FK/checks. Base capacity вычисляется из staffing/hours, не хранится второй копией. **Migration v1w2x3y4z567**, parent u0v1w2x3y456; upgrade/downgrade, без seeds/перезаписи существующих таблиц.
- Pool = staff × productive hours; machine = hours отдельно от операторов; packing = часы совместной бригады 2 человек, 800/10=80 изделий/team-hour, без второго умножения на два. Cutters — общий пул до 2, оба manual метода делят один ресурс (20/40 изделий/person-hour). Плоттеры 1…4: каждый 15 пм/machine-hour; каландр 60; лазер 100 изделий/machine-hour. Дизайнеры/операторы — явные total hours, тираж не множитель; procurement milestone без hourly capacity.
- Sewing load — sum positive duration_seconds × quantity_per_item применимых швейных строк existing order-item snapshot / выбранного AssemblyVariant. Применимость сверяется с TC sewing operation lines; нет сопоставления по номеру/догадки при неоднозначности. Empty/zero/missing/ambiguous даёт unknown, даже при requested quantity=0; order-item snapshot не заменяется live variant; actual stage duration не норма; manual sewing hours → 422. Новые нормы/снимки не записываются.
- Read-only load-state: reserve <80, near 80…100, over >100, unknown при missing input/norm/capacity. Partial known hours показаны, percentage=null при unknown/zero capacity; положительный known demand на zero capacity → over без деления. Unit mismatch → 422; разные единицы не суммируются. Warning-only, assignment save/production launch не блокируется.

### Exact endpoints / DTO handoff

Префикс `/production-calendar/capacity`; inherited existing PlatformUser session, мутации используют existing `technical_cards.create`, нового RBAC seed нет.

| Method | Endpoint | Request / response |
|---|---|---|
| GET | `/settings` | `{resources:[ResourceRead],stages:[StageRead],work_centers:[WorkCenterRead]}`; 14 keys, actual catalog metadata, units/norms/base schedule/editable_fields/exceptions |
| PUT | `/settings/{resource_key}` | `{staff_count:5,hours_per_day:"8",working_days:[0,1,2,3,4],work_center_id:null,note:null}` → ResourceRead; machine staff=null + real work_center_id |
| PUT | `/settings/{resource_key}/exceptions/{day}` | `{capacity:"24",unavailable:false,note:"..."}` или `{capacity:null,unavailable:true,note:"..."}` → `{date,capacity,unavailable,note}` |
| DELETE | `/settings/{resource_key}/exceptions/{day}` | 204 empty; only the specified exception |
| POST | `/load-state` | `{resource_key:"sewers",date:"2026-10-05",demands:[{unit:"person_hours",technical_card_id:42,quantity:"100"}]}` → `{resource_key,date,unit,capacity,known_planned_hours,unknown_demand_count,load_percent,state,reason,warning_only:true}` |

Exact examples/field limits/resource keys/error codes are in the architecture contract. Base capacity computed hours; norm.rates are throughput, not available capacity. `key` is API ID (string); ISO/Python weekdays 0…6; Decimal responses strings with no promise of fixed trailing zeroes. Exceptions upsert by key+date, full override, DELETE returns base schedule. 401/403/404/409/422 explicit.

### Файлы Codex

Backend: `app/models/production_capacity.py`, `app/models/__init__.py`, `app/schemas/production_capacity.py`, `app/repositories/production_capacity.py`, `app/services/production_capacity.py`, `app/api/production_capacity.py`; existing `app/api/production_calendar.py` includes the child capacity router; migration `alembic/versions/v1w2x3y4z567_production_capacity.py`; `tests/test_production_capacity.py`.

Docs: эта задача, architecture `production-calendar-capacity-pc-03-4a.md`, `production-calendar-implementation-v0.1.md`, `project-structure.md`, `erp-check.md`; roadmap `roadmap.md`, `roadmap-v1.1.md`, `production-calendar-v0.1.md`; twins `erp/status/roadmap.html`, `erp/status/roadmap-v1.1.html`, `erp/status/project-structure.html`, `roadmap/production-calendar-v0.1.html`; generator adds PC-03.4A/28 cards. Existing uncommitted work preserved.

### Проверки

- Targeted `test_production_capacity.py` + existing `test_production_calendar.py`: **45 passed**, включая persistence/upsert/delete/reload, validation/auth, equipment reuse/unique binding/catalog delete, thresholds/zero/unknown/mixed units, confirmed rates, shared cutters/packing, sewing snapshot priority/zero/ambiguity, warning-only. New capacity tests **34**, previous calendar **11**. Initial failures were test fixture required SalesOrder/contour fields and lexical Decimal scale comparisons; corrected without changing existing models/contracts.
- Batch budget: GET settings **4 SELECT** independent of 14 resource count; sewing load **7 SELECT** for 1 and 100 demands (mixed snapshot/variant can require the fourth norm query), no per-demand fetching. Slim metadata/read DTO; no ORM from API.
- **Project check 10/10 / exit 0**: backend **513 passed / 71 warnings**, frontend **314 passed** (includes parallel Cursor WIP), lint **0 errors / 84 prior warnings**, TypeScript, production build, OpenAPI, Compose and Alembic passed. Codex did not change frontend to achieve these results.
- Local Docker Postgres `127.0.0.1:5432`: **upgrade/check/downgrade/upgrade/check passed**. Before downgrade both new tables confirmed empty; only these new empty tables dropped. Counts TechnicalCard/ProductionStage/WorkCenter/CalendarAssignment preserved **4/8/8/0**; old queue migration not rolled back. Final DB at v1w2x3y4z567. No VPS/tunnel/production migrations.
- **Live authenticated API + PostgreSQL**: GET 14 resources → PUT base capacity → fresh client GET reload → warning near 80% → exception 24 hours yields over → unavailable exception yields zero_capacity/over/null percent → DELETE restores base → anonymous GET 401. Temporary marked QA settings/exceptions/user/session/role/SalesUser removed; pre-existing settings/working records never overwritten. No frontend integration claimed by this check.
- Evidence ignored: `storage/pc-03-4a-targeted.log`, `pc-03-4a-project-check.log`, `pc-03-4a-migration-check.py/.log`, `pc-03-4a-live-check.py/.log`. `git diff --check` passed. Canonical diff reviewed. **HTML twin synced**: PC-03.4A [x] ↔ done:true in active roadmap/project-structure; PC-03 stays [ ] ↔ done:false. Generator --check passed.

### Параллельный handoff / ограничения

Cursor PC-03.4B owns all frontend files. Its currently observed temporary adapter `calendar-capacity.ts` has alternative `/capacity/rules` / `/capacity/exceptions`, numeric IDs and rate units mixed with availability; exact differences/mapping recorded in architecture contract. It must align to the fixed API v1 and expand frontend proxy allowlist before live UI-F connection. Codex did not edit it, weekly board, navigation or UI-G/H, and does not close PC-03.4B. This is an integration handoff gap in an unfinished frontend slice, not a claim that the fixture is connected or additional backend routes are needed.

No snapshots/ledgers/shift/conflict engine, auto-scheduling, launch gates, execution/fact or UI-A load indicators. CalendarAssignment update contract and DB model unchanged. P0/P1 backend defects none; P2 existing warnings; frontend contract mismatch remains explicit PC-03.4B integration work. Template/breakpoint/browser visual QA not applicable to backend-only task; DS-SHELL-01/02 not touched by Codex. ERP-check full calendar remains [ ]; structure only backend readiness closed.

Next iteration: Cursor aligns UI-F adapter/proxy to this contract, then separate short live integration checks; do not start UI-A capacity indicators automatically. **Commit/push/merge/tag не выполнялись.**
