# PC-03.4A — Fixed capacity API contract v1

**Зафиксирован до реализации: 2026-10-05.** Для параллельной PC-03.4B; этот документ — контракт DTO, не готовый UI-F. Scope владельца: `docs/tasks/pc-03-4a-capacity-backend-contract-codex.md`. Backend endpoints ниже; frontend adapter/proxy принадлежат Cursor. Обновление UI-A и интеграция нагрузки — отдельная задача.

## Аудит и reuse

- Участок = существующий `ProductionStage`, оборудование = существующий `WorkCenter` (`models/shop_routing.py`, ADR-017). Ни новых участков, ни машин, ни справочников сотрудников не создаём. Имена/ID читаются из этих каталогов. Существующие WorkCenter не содержат расписания или скорости.
- `Employee` содержит организацию/должность/контакты/активность, но не ежедневную доступность; `PlatformUser`/stage executors/кабинет швеи — идентичность, доступ и факт, не сменная мощность (ADR-023/024/029). Количество сотрудников каталога не является числом доступных людей. Working calendar/shift schedule/capacity settings в приложении отсутствуют.
- `CalendarAssignment` остаётся неизменным: нет resource/method/meters или partial quantity. Настройки сами не дают достоверную нагрузку назначений. Load-state API ниже получает явные demands, ничего не пишет в очередь/ТК.
- Пошив: положительные `duration_seconds × quantity_per_item` применимых строк order-item snapshot (при наличии) либо выбранного `AssemblyVariant`; фактический `TechnicalCardStageResult.duration_seconds` не норма. Состав применимых швейных операций сверяется с `TechnicalCardOperationLine.source_kind=sewing`. Отсутствующая/нулевая/неоднозначная норма → unknown; ручная норма пошива не вводится. Live variant не заменяет отсутствующий order-item snapshot.
- Только две новые таблицы: `production_capacity_settings` (настройка существующего ресурса/пула), `production_capacity_exceptions` (полное override доступных часов на дату). Не каталог машин/сотрудников. Read не создаёт записи. Base capacity вычисляется, не хранится второй копией.

## Ресурсные ключи и единицы

Ключи стабильные, `key` — ID API. Дни недели ISO/Python: **0=понедельник … 6=воскресенье**. Все даты `YYYY-MM-DD`, decimals в response — **JSON strings**, timestamps при их наличии timezone-aware. UI подписывает единицы, не складывает разные единицы.

| key | name | stage_code | kind | unit | норматив v0.1 |
|---|---|---|---|---|---|
| `designers` | Дизайнеры | design | pool | person_hours | Только явные общие часы, тираж не множитель |
| `print_operator` | Печатник / подготовка | print | pool | person_hours | Только явные часы подготовки/оператора |
| `plotter_1` … `plotter_4` | Плоттер 1 … 4 | print | machine | machine_hours | Каждый 15 running_meters/hour |
| `calender` | Каландр | print | machine | machine_hours | 60 running_meters/hour |
| `calender_operator` | Оператор каландра | print | pool | person_hours | Явные часы, не копия машинного времени |
| `cutters` | Общий пул раскройщиков | cutting | pool | person_hours | 20 items/person-hour manual_single; 40 manual_lay; общий пул до 2 человек |
| `laser` | Лазер | cutting | machine | machine_hours | 100 items/machine-hour |
| `laser_operator` | Оператор лазера | cutting | pool | person_hours | Явные часы, не выдуманная доля занятости |
| `sewers` | Пошив | sewing | pool | person_hours | Норматив ТК/сборки × количество / 3600 |
| `packing_team` | Бригада упаковки | packaging | team | team_hours | 2 человека вместе, 800 items / 10 team-hours = 80 items/team-hour |
| `procurement` | Закупка | launch_preparation | milestone | milestone | Нет часовой мощности; readiness не вычисляем из материалов |

Четыре plotter slots — привязки настроек к **четырём разным существующим** WorkCenter, не создание оборудования. `work_center_id` уникален среди settings; machine нельзя настроить без реального активного WorkCenter правильного участка. Пулы не используют equipment ID. Если каталог этапа отсутствует/неактивен, GET явно отдаёт отсутствие/неактивность, update → 422. Не добавляем procurement stage ради milestone.

`base_capacity` за рабочий день: pool = `staff_count × hours_per_day`; machine = `hours_per_day`; packing_team = `hours_per_day` при двух доступных сотрудниках, 0 при staff_count=0, unknown при одном или неизвестном составе. `hours_per_day` — **продуктивные** часы 0…24; коэффициентов/перерывов/сменного engine нет. Незаполненные часы/штат/рабочие дни не получают вымышленные значения. Пустой `working_days` — явно все дни нерабочие. Staffing cutters 0…2; packing_team 0…2, остальные pools 0…10000. Пропускная способность 800 не умножается на 2; person_hours бригады при необходимости = 2 × team_hours, отдельный процент не складывается с team_hours.

## GET `/production-calendar/capacity/settings`

Requires existing PlatformUser session, response 200. Четыре bounded SELECT (этапы, WorkCenter, settings, exceptions), без per-resource запросов. Возвращает **все 14 ключей** и реальные каталоги. Неинициализированный ресурс виден: `configured=false`, nullable поля, `base_capacity=null`, `exceptions=[]`. No demo replacement. Milestone всегда capacity=null, editable_fields=[]; остальные поля ниже одинаковы.

```json
{
  "resources": [{
    "key": "sewers", "name": "Пошив", "stage_code": "sewing",
    "production_stage_id": 4, "stage_name": "Пошив", "stage_active": true,
    "kind": "pool", "unit": "person_hours", "configured": true,
    "work_center_id": null, "staff_count": 5, "hours_per_day": "8.0000",
    "working_days": [0, 1, 2, 3, 4], "note": null,
    "base_capacity": "40.0000",
    "editable_fields": ["staff_count", "hours_per_day", "working_days", "note"],
    "norm": {"source": "technical_card_assembly", "rates": {}, "required_staff_count": null},
    "exceptions": [{"date": "2026-10-09", "capacity": null, "unavailable": true, "note": "Нет швей"}]
  }],
  "stages": [{"id": 4, "name": "Пошив", "code": "sewing", "is_active": true}],
  "work_centers": [{"id": 21, "name": "Плоттер A", "code": "plotter-a", "production_stage_id": 3, "is_active": true}]
}
```

Пример содержит один ресурс для компактности; настоящий ответ содержит все 14. `norm.rates` maps rate-name → Decimal JSON string: plotter `{running_meters_per_hour:"15"}`, calender `{running_meters_per_hour:"60"}`, cutters `{manual_single_items_per_person_hour:"20", manual_lay_items_per_person_hour:"40"}`, laser `{items_per_machine_hour:"100"}`, packing `{items_per_team_hour:"80"}` с required_staff_count=2. `norm.source`: manual / confirmed_v0.1 / technical_card_assembly / milestone.

## PUT `/production-calendar/capacity/settings/{key}`

Full replacement/upsert; permission **`technical_cards.create`**, как существующие календарные изменения. 200 → ResourceRead (тот же объект, что в GET resources). No new RBAC/catalog seed. `hours_per_day` nullable Decimal (max 4 decimal places), `staff_count` nullable integer, `working_days` required unique array 0…6; `note` optional/null max 2000; `work_center_id` optional/null existing ID. Extra fields запрещены. Numeric JSON inputs принимаются, frontend предпочтительно отправляет strings.

```json
{"staff_count":5,"hours_per_day":"8","working_days":[0,1,2,3,4],"work_center_id":null,"note":null}
```

Machine example:

```json
{"staff_count":null,"hours_per_day":"10","working_days":[0,1,2,3,4],"work_center_id":21,"note":"Плоттер A"}
```

Staff_count у machine должен быть null; у pool/team work_center_id должен быть null. Stage ID/unit/name не редактируются здесь. Unknown key → 404; milestone update → 422; неверные значения/каталог → 422; один WorkCenter в двух slots/concurrent insert → 409. Backend не выбирает WorkCenter по похожему имени и не создаёт missing machines.

## PUT `/production-calendar/capacity/settings/{key}/exceptions/{day}`

Upsert даты (одна запись на key+date), requires same write permission. Settings должны существовать; 404 если не настроены. Полное override **доступных часов в unit ресурса**, не поправка к base_capacity. 200 → ExceptionRead. Override может задавать рабочий выходной; delete восстанавливает базовое расписание.

```json
{"capacity":"24","unavailable":false,"note":"Три швеи по 8 часов"}
```

Response:

```json
{"date":"2026-10-09","capacity":"24.0000","unavailable":false,"note":"Три швеи по 8 часов"}
```

Недоступность:

```json
{"capacity":null,"unavailable":true,"note":"Выходной"}
```

unavailable=false требует capacity>=0, max 4 decimal places; unavailable=true требует capacity=null. Значение 0 допустимо; NaN/Infinity/negative не допустимы. Исключение не утверждает наличие нормы/готовности заказа.

## DELETE `/production-calendar/capacity/settings/{key}/exceptions/{day}`

Same write permission. 204, empty body; 404 для отсутствующей записи/key. Удаляет только указанное исключение, ресурс/ТК/очередь неизменны.

## POST `/production-calendar/capacity/load-state`

Session required, **read-only**, no write permission needed. Warning-only расчет по одному ресурсу/дате: 200 → LoadStateRead, никогда не блокирует PUT assignments. До 100 demands; unit каждого demand обязан совпасть с unit ресурса, иначе 422 — никаких конверсий/сумм разных единиц.

```json
{"resource_key":"sewers","date":"2026-10-05","demands":[{"unit":"person_hours","technical_card_id":42,"quantity":"100"}]}
```

Demand optional fields: `hours` explicit total hours, `quantity` items, `running_meters`, `technical_card_id`, `method` (`manual_single`|`manual_lay`). Все числовые объёмы >=0, max 4 decimal places; отсутствующий объём/норма → unknown. Для sewing explicit hours запрещены: только применимая существующая норма; при quantity=null читается quantity самой ТК. Для cutters метод обязателен при расчёте из quantity; оба способа суммируются в **один** cutters pool. Для дизайнеров и операторов hours — явная общая оценка, quantity не множитель. Print machine hours = running_meters/rate, laser hours=quantity/100, packing team hours=quantity/80. Explicit hours допустимы для иных ресурсов как явная оценка без притворства, что найден норматив; нормы не пишутся в ТК/каталоги.

```json
{
  "resource_key":"sewers","date":"2026-10-05","unit":"person_hours",
  "capacity":"40.0000","known_planned_hours":"32",
  "unknown_demand_count":0,"load_percent":"80",
  "state":"near","reason":null,"warning_only":true
}
```

States: reserve <80%; near 80…100 inclusive; over >100%; unknown если capacity/norm отсутствует или есть хотя бы один unknown demand. Unknown-demand частичный known hours показан, percentage=null. capacity=0: положительный известный план → over, percentage=null (no division), нулевой план → unknown, reason=zero_capacity. Неизвестная норма имеет приоритет даже над zero capacity; milestone всегда unknown/milestone. Нерабочая дата без override даёт capacity=0; datetime/launch/execution отсутствуют.

## Стабильность и handoff

API ошибок: стандартный FastAPI `{detail:string}` либо validation detail array, 401 anonymous, 403 write без permissions, 404 resource/record, 409 conflicting machine binding, 422 invalid payload. GET settings включает исключения; mutations возвращают native DTO без ORM. Подключение к frontend `/api/production-calendar/capacity/...` требует расширения existing frontend allowlist **в PC-03.4B / отдельной интеграции Cursor**; Codex не меняет этот frontend-файл.

В контракте нет snapshots, ledgers, новых equipment/employee каталогов, сменного/конфликтного двигателя, автопереноса, UI-A индикаторов, Dashboard/Center of deviations, readiness из BOM или MES. `CalendarAssignment` и существующий производственный факт не меняются.

### Наблюдение параллельного адаптера (2026-10-05)

`frontend/lib/production/calendar-capacity.ts` в процессе PC-03.4B пока объявляет временный `/capacity/rules` + `/capacity/exceptions`, numeric resource IDs, weekdays 1…5, поля working_hours/value и единицы rates (`meters_per_hour`/`pieces_per_shift`). Это **не** backend contract v1 выше. Scope Codex не включает этот файл. Для подключения Cursor адаптирует его к этому документу: `/capacity/settings`, строковый key, days 0…6, hours_per_day/staff_count/work_center_id, исключения через key/date, часы в unit ресурса. Скорости относятся к `norm.rates`, а не к available base_capacity. `print_prep` → `print_operator`, `cutting_pool` → `cutters`, `sewing` → `sewers`, `packaging` → `packing_team`; machine keys сохраняются. Не заявляем live frontend integration до этой синхронизации. API менять или создавать alias для ошибочных rate/capacity единиц не требуется.


**Implementation verified 2026-10-05:** exact endpoints/DTO implemented; migration v1w2x3y4z567; 45 targeted + 513 full backend tests, project check 10/10, local PostgreSQL upgrade/check/downgrade/upgrade/check and live settings/exceptions reload passed. Frontend contract alignment remains PC-03.4B. Decimal strings do not guarantee a fixed number of trailing zeroes; compare numbers, round only for display. FK on catalog deletion uses SET NULL so existing catalog deletion is preserved; unbound resource capacity becomes unknown.


**PC-03.5A registration update 2026-10-05:** existing procurement key now binds to launch_preparation (Подготовка к запуску), seeded by w2x3y4z5a678. Kind/unit/source remain milestone; no hourly settings/rates/calculation. Other resources and capacity payloads unchanged. Entry contract: production-calendar-entry-pc-03-5a.md.
