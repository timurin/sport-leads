# Production Calendar v0.1 — минимальный контракт реализации

**Статус:** DESIGN-FROZEN, `2026-10-05`; документационный PC-02.1 завершён. Решение владельца: [Lightweight Design Freeze](../tasks/pc-02-1-lightweight-design-freeze-implementation-contract.md). UI-A–UI-H OWNER-APPROVED, DESIGN-APPROVED = true. PC-03.1 queue MVP реализован; остальные checkpoints открыты.

Этот контракт заменяет расширенные предложения схемы/API/календарного исполнения §4–7 PC-02 для **v0.1**. [PC-02](production-calendar-pc-02.md) сохраняется как история исследования; [ресурсный контракт](production-calendar-capacity-v0.1.md) сохраняет формулы и единицы. P1 [PC-02.1-B1](../tasks/production-calendar-pc-02-1-b1-refresh-model-material-loss.md) закрыт отдельным исправлением 2026-10-05 (13 регрессионных тестов); согласно AGENTS.md переход к реализации требует обязательных проверок. Baseline DB/lint проверки открыты; PC-03 не начат. Закрытие дизайна не подтверждает исправление кода или успешную браузерную проверку.

**PC-03.1 scope override (2026-10-05):** прямая задача владельца `pc-03-1-lightweight-production-queue-mvp.md` заменяет прежний persistence-only подэтап одним вертикальным срезом. В нём реализована только `CalendarAssignment` (ТК + участок + дата + позиция + примечание + timestamps), UNIQUE (ТК, участок), количество читается из источника. Только standalone ТК draft/in_progress; изменение очереди использует существующее `technical_cards.create`, чтение требует сессии, ограниченный кабинет швеи не расширен. API `GET /production-calendar/board?from=&to=&stage_id=`, `GET /sources?search=&limit=`, `POST /assignments`, `PUT/DELETE /assignments/{id}`. Повтор идентичного POST возвращает ту же запись, несовместимый дубль — 409. Один объект назначается на участок один раз; частичные дневные объёмы/ресурсы не входят в этот MVP. Прочие таблицы/API ниже остаются будущим предложением, не доказательством реализации. PC-03.2…7 не закрываются автоматически.

**PC-03.3 scope override (2026-10-05):** по отдельной задаче владельца `pc-03-3-manual-scheduling-calendar-assignment.md` UI-E реализован только как редактор существующей CalendarAssignment: дата, участок, позиция и note через текущий PUT; quantity из ТК read-only, новый GET detail не нужен — используется bounded GET board выбранной недели. UI-A передаёт id + дату; UI-E показывает prefill/preview и возвращает на новую неделю. Это заменяет прежний planned weekly-board scope для кода PC-03.3 ниже, не закрывает PC-04…10, allocation/capacity/DAG или ERP-факт. PC-03.2 — навигация, а не прежний planned API-подэтап. Остальная таблица §8 остаётся историей предложения, не подтверждением реализации.

**PC-03.4A scope override (2026-10-05):** прямой backend-only срез владельца: [capacity API v1](production-calendar-capacity-pc-03-4a.md), две минимальные таблицы ProductionCapacitySettings/Exception, настройки существующих WorkCenter/пулов и ISO weekday schedule; Decimal warning-only load, нормы из применимых строк ТК/сборки. Нет новых allocations/snapshots/ledgers/shift engine; CalendarAssignment не изменён, UI-A нагрузка не подключена. Это supersedes расширенное предложение capacity rules/allocations только в данном scope. PC-03.4B UI-F/adapter — отдельно, PC-03 и PC-04…10 не закрываются.

**PC-03.4D scope override (2026-10-05):** UI-A shows published POST capacity/load-state results per resource/date, without frontend formulas. One GET settings then <=14×7 read requests, six concurrent; no per-TC fetch. Sewing uses technical_card_id, packing uses existing TC quantity; no guessed meters/machines/methods/manual hours. Separate resource indicators for multi-resource stages, no aggregate percentage across units. Unconfigured/missing/unsupported inputs show unknown; errors remain visible and CRUD remains available. Backend/DB/UI-F unchanged. Owner task context establishes PC-03.4C adapter aligned; prior PC-03.4A handoff note is historical. PC-03 remains open.

**PC-03.5A scope override (2026-10-05):** [automatic entry contract](production-calendar-entry-pc-03-5a.md) replaces PC-03.1 arbitrary-stage create semantics by direct owner instruction. POST accepts only technical_card_id/planned_date/note; ProductionStage launch_preparation and date/stage tail position are selected server-side with stage-row locking. Existing AssignmentRead and dispatcher PUT retain stage/position; no assignment backfill/model changes or automatic transitions. Data-only migration seeds one preparation stage, procurement resource registration binds it as milestone (no hourly logic). Frontend simplification is separate PC-03.5B, PC-03 remains open.

## 1. Ежедневная работа

Диспетчер выбирает существующую standalone ТК, проверяет предложенные данные, добавляет её в очередь и назначает даты/объём работы. Повторный ввод номера, модели, изделия, количества и маршрута не нужен. Если ТК отсутствует, используется её действующий сценарий создания, после чего отдельным действием создаётся календарный план. Календарь не создаёт ТК, ProductionOrder, партии, закупки или ресурсные каталоги.

UI-A — основной рабочий экран; UI-C показывает выбранный план, UI-D — участок/дату, UI-E — ручное распределение, UI-F — настройку доступной мощности. UI-G «Дашборд производственного календаря» и UI-H «Центр отклонений» открываются по необходимости. Автоматическое распределение, solver, workflow engine, оптимизация очередей, новые кадровые справочники и MES не входят в v0.1.

## 2. Проверенная матрица переиспользования

| Источник в репозитории | Что читаем / используем | Граница |
|---|---|---|
| `TechnicalCardOrderGroup` — `backend/app/models/technical_card.py` | `order_number`, `desired_date`, связь группы с ТК | Существующий ручной номер; календарь не перенумеровывает группу. |
| `TechnicalCard` | `quantity`, `nomenclature_name`, модель/вариант и их снимки, этапы/операционные строки | Одна ТК — один активный календарный план v0.1. Поля источника в форме read-only. |
| `ProductionOrder`, `ProductionBatch`, `ProductionBatchCardLink` — `production_order.py`, ADR-018 | Контекст заказа/партии, если ТК уже связана с ними | ProductionOrder — документ с XOR SalesOrder/группа и release-логикой партий; привязывать план к нему обязательно нельзя. CalendarPlan не создаёт второй заказ и не меняет партии. |
| `ProductModel`, `AssemblyVariant`, `AssemblyOperationLine` — `product_model.py` | Вариант ТК; применимые `duration_seconds × quantity_per_item` | Норма пошива берётся из строк выбранного варианта; норма не записывается на модель/справочник операции. |
| `TechnicalCardStageResult`, `TechnicalCardOperationLine` | Порядок этапов, назначенный `work_center_id`, статус/факт, плановый объём и единица | Часовой факт этапа не является нормой пошива. Факт остаётся в ТК; материал/PO не подтверждает закупку автоматически. |
| `ProductionStage`, `WorkCenter`, ADR-017 | Существующие участки, оборудование, активность и принадлежность участку | Четыре плоттера, каландр, лазер выбираются из WorkCenter; новых каталогов нет. |
| `PlatformUser`, RBAC, stage executors | Автор действий, существующий механизм прав и список исполнителей для контекста | Наличие пользователя/исполнителя не доказывает доступную численность смены. Именное расписание не вводится. |
| `AuditEvent` и `services/audit.py::append_audit_event`, ADR-025 | История создания/переноса/мощности/снимка, actor/time/request_id и JSON payload | Событие пишется в той же транзакции; отдельного CalendarEvent нет. |
| Действующие DTO/сервисы `/technical-cards`, `/production-orders`, `/production-stages`, `/work-centers` | Существующие выборки и batch-чтение источников | Контракты этих API не меняются; календарь не требует новой копии справочников. |
| AppShell, PT-02, общие Button/table/form, `frontend/lib/navigation.ts` | Утверждённая компоновка и одна платформенная навигация | DS-SHELL-01/02 preserved; новые пункты только в источнике навигации при будущей реализации. |

Контур v0.1 сохраняет standalone ТК (`order_group_id != null`, без обязательного SalesOrder). Чтение существующего коммерческого заказа через связанный контекст не делает его prerequisite; расширение на ТК контура A не включено в эту итерацию.

## 3. Только необходимые новые записи

Предлагаются **пять типов таблиц**, все добавляющие. Это спецификация, таблиц/миграций ещё нет.

| Запись | Зачем нужна и почему существующая не подходит | Минимальные поля |
|---|---|---|
| `CalendarPlan` | Сохраняет включение ТК в очередь и календарные настройки. ТК не хранит очередь/дневное распределение; ProductionOrder управляет партиями и не обязателен для standalone ТК. | `id`, `technical_card_id UNIQUE FK`, `due_date_override nullable`, `materials_confirmed bool`, `materials_confirmed_by/at nullable`, `materials_confirmation_reason nullable`, `source_snapshot JSON`, `dependency_snapshot JSON`, `version`, `created_by`, aware timestamps. Номер/названия/количество показываются из источника и снимка, не создают независимо редактируемые поля. |
| `CalendarOperation` | Плановая работа участка/ресурса внутри плана. Этап ТК не описывает подготовку, отдельные очереди плоттеров и их дневные назначения. | `id`, `plan_id FK`, `operation_key`, `technical_card_stage_result_id nullable FK`, `production_stage_id nullable FK`, `work_kind`, `norm_snapshot JSON nullable`, `manual_estimate_minutes nullable`, `estimate_reason nullable`, `version`. UNIQUE `(plan_id, operation_key)`. Для виртуальной закупки stage FK отсутствует; новый ProductionStage не создаётся. |
| `CalendarAllocation` | Дата/объём/метод назначения отсутствуют на ТК: один planned WorkCenter не является календарной очередью. | `id`, `operation_id FK`, `local_date`, `work_center_id nullable FK`, `resource_role`, `method nullable`, `planned_quantity Decimal`, `quantity_unit`, `planned_hours Decimal nullable`, `hours_unit`, `estimate_source`, `version`. Несколько партий/дат/ресурсов допустимы; сумма изделий по альтернативным способам ≤ количеству ТК. |
| `CalendarCapacityRule` | Каталоги участка/оборудования не хранят продуктивные смены и численность. Это настройка мощности существующего ресурса. | `id`, `production_stage_id FK`, `work_center_id nullable FK`, фиксированный `resource_role`, `capacity_unit`, `effective_from/to`, `working_weekdays`, `staff_per_shift nullable`, `productive_minutes`, `nonoverlapping_shifts`, `efficiency Decimal`, `version`. Пара `stage/work_center/role` — ресурсный ключ, без отдельного каталога. |
| `CalendarCapacityException` | Выходной, ремонт/отсутствие и дополнительная рабочая дата требуют датированного override, которого нет в WorkCenter. | `id`, `capacity_rule_id FK`, `local_date`, полная замена параметров дня, `reason`, `version`; UNIQUE `(rule_id, local_date)`. |

В v0.1 нет отдельных `CalendarOrder`, справочника сотрудников/машин, `CalendarDependency`, `CalendarShiftRule`, `CalendarLaborNormSnapshot`, CalendarEvent или таблицы рисков. DAG хранится компактным снимком ключей работ на плане и валидируется сервисом: одинаковый план, существующие ключи, отсутствие циклов. Начальные ветви закупки и дизайна параллельны; после подготовки плоттеры → каландр → раскрой → пошив → упаковка. Порядок/реальные этапы читаются из снимка ТК; неоднозначное соответствие даёт `unsupported_route`, а не исправление ТК. Подготовка/машины — работы внутри участка печати, не новые этапы ERP.

`source_snapshot` фиксирует идентификаторы, дату/версию доступного источника или hash, quantity, модель/вариант/маршрут. `norm_snapshot` хранит применимые исходные строки (id, seconds, кратность, единицы) и точную сумму. При изменении master-данных план не пересчитывается молча: `source_drift`, явное подтверждение нового снимка, before/after и причина в AuditEvent. Отдельная история снимков хранится аудитом; snapshot/revision и назначения меняются атомарно. Плановый объём в пм задаётся только если известен из ТК/операционной строки либо явно отмечен ручной оценкой; из тиража автоматически не выводится.

## 4. Расчёты и минимальный ввод

Норма пошива: `unit_person_seconds = Σ_applicable(duration_seconds × quantity_per_item)`, `hours = planned_qty × unit_person_seconds / 3600`. Нулевые/пустые/неоднозначные применимые строки — unknown. Ручная норма пошива не подставляется вместо варианта в v0.1; разрешена лишь плановая запись с неизвестной нагрузкой. Дизайн может иметь явно ручную оценку заказа; тираж её не умножает. Подготовка — предварительный ориентир 1 чел.-ч/заказ; плоттер — пм/15; каландр — готовые пм/60; поштучный/настильный раскрой — шт./20 или шт./40 на общем пуле; лазер — шт./100 с отдельным оператором; упаковка — шт./80 часов одной бригады из двух. Числа конфигурируемы согласно ресурсному контракту, не новые свойства действующих моделей.

Мощность — сотрудники **по каждой непересекающейся смене** × продуктивные минуты × эффективность; для машины без умножения на людей. Если агрегатный режим смен не описывает реальную численность, настройка не применяется до уточнения. Эффективность по умолчанию 100%; реальные сотрудники/перерывы/календарь/timezone задаются при вводе в эксплуатацию, не копируются из демо или системной даты агента. Машина ≤1440 минут/сутки. Рабочие дни и полные override исключений применяются перед расчётом. Параметры не заданы — `capacity_unknown`; явно 0/выходной/ремонт — `zero_capacity`. Процент только для известных плана и положительной мощности в **одной** единице.

Ручной ввод ограничен недостающими календарными данными: даты/назначения, корректировка срока при необходимости, неподтверждённая оценка дизайна/метража с причиной, первичная настройка мощности и подтверждение материалов. Номер, модель, изделие, количество, вариант, маршрут и существующее оборудование повторно не вводятся. Если срок override пуст, читается `TechnicalCardOrderGroup.desired_date`; нет второго обязательного срока.

## 5. План, факт и допуск запуска

Реальный статус/время/выпуск читаются из ТК и её этапов; отдельная календарная машина состояний с `start/pause/complete` и второй производственный факт исключены из v0.1. Статусы «не распределено/распределено» и предупреждения вычисляются по назначениям; факт не выводится из даты. Виртуальная закупка — один ручной флаг с автором/временем/основанием, независимый от PO, остатков и состава ТК. Частичные назначения разрешены; подтверждённая готовность партии не выдумывается из назначенных изделий или процентов. Если существующий факт не даёт её количества, частичный запуск помечается «готовность неизвестна».

| Проверка | Последствие |
|---|---|
| Неизвестная обязательная норма/готовность, незавершённый обязательный предшественник, неподтверждённая закупка | `launchEligibility = blocked`; планирование заранее допускается. |
| Реальная операция уже завершена/отменена, права, конфликт версии/источника, чужой ресурс/этап, недопустимый объём/дублирование партии | Запись отклоняется 403/409/422 по причине; реальный запуск не предлагается. |
| Машина >24 ч, физическое пересечение назначений одной машины, явно отсутствующая мощность | Недопустимое ресурсное назначение/запуск; дата может оставаться черновым планом с hard-сигналом, без обещания исполнения. |
| Предшественник планово заканчивается позже последователя | Конфликт дат сохраняется после переноса; старт требует фактической готовности, дата сама её не подтверждает. |
| План >100% положительной известной мощности | Предупреждение; сохранение требует подтверждения и причины. Это не доказательство опоздания. |
| План позже срока, master-данные изменились, неизвестная часть нагрузки | Предупреждение с источником; неизвестность никогда не отображается как 0%/резерв. При несовместимом снимке запуск блокируется. |

Календарь v0.1 не получает endpoints производственного запуска. UI показывает допуск и ведёт в существующий экран ТК/цеха; действующие start/complete API и их gates сохраняются. Допуск календаря проверяется сервером в его read DTO, но **не является глобальным запретом для всех существующих клиентов ERP**. Внедрение календарного DAG непосредственно в действующие start API потребует отдельного интеграционного решения; до него не обещать такую гарантию. Это граница лёгкого инструмента планирования и сохранения текущей бизнес-логики.

## 6. Минимальный будущий API

Ни один endpoint ниже пока не реализован. Префикс `/production-calendar` добавляется отдельно. DTO отделены от ORM; права используют существующий RBAC с минимальными календарными view/plan/capacity grants без расширения цеховых прав. Время/количества — Decimal, локальные даты ISO; aware timestamps, timezone конфигурации. PATCH/PUT требуют ожидаемую версию, повторное добавление ТК идемпотентно по UNIQUE; транзакция назначения и проверки общей мощности блокирует затронутые resource/date. Ошибки 403/409/422 явны.

| Методы | Минимальная обязанность |
|---|---|
| `GET /plans?from=&to=&search=&limit=&cursor=`, `POST /plans`, `GET /plans/{id}`, `PATCH /plans/{id}` | Slim очередь и detail; POST `{technical_card_id, due_date_override?}`, данные ТК подставляются. PATCH — срок/подтверждение материалов/явная ревизия снимка с причиной; не редактирует ERP. Detail содержит работы, DAG, источники, read-only факт и launchEligibility; история из AuditEvent с серверной проверкой прав. |
| `PUT /operations/{id}/allocations` | Проверка и полная замена дневных/партийных назначений одной работы, версия и причина; атомарный before/after, overload acknowledgment. Удаление/перенос через эту же операцию. |
| `GET /board?week_start=&stage_ids=`, `GET /days/{date}?stage_id=&limit=&cursor=` | UI-A batch 6×7; UI-D ресурсные итоги + пагинируемые назначения; known/unknown/zero/blocked и факт отдельно. |
| `GET/PUT /capacity/rules`, `GET/PUT /capacity/exceptions` | Минимальные настройки UI-F; эффективный день читается в board/day. Каталоги участков/оборудования существующие. |
| `GET /dashboard?from=&to=&bucket=day|week&stage_ids=` | UI-G агрегаты по ресурсам и датам в одинаковых единицах, unknown и назначения без мощности отдельно; drill-down использует `/days`. |
| `GET /deviations?from=&to=&search=&stage_id=&kind=&severity=&sort=&limit=&cursor=` | UI-H вычисляемые группы причин, общие и фильтрованные счётчики, один ресурсный конфликт с массивом уникальных plan/ТК IDs; детализация с пагинацией. Таблица рисков и автокоррекция не создаются. |

Выбор ТК/модели/варианта/участка/оборудования переиспользует текущие сервисы и API. Нет отдельных `/timeline`, `/risks`, CRUD ресурсов, статусного workflow или обязательного daily review. Batch/embed без per-row fetch по SL-LIST-PAGE-RULES-v1; справочные карточки не вкладываются целиком в list DTO.

## 7. Frontend и связь утверждённых экранов

| Экран | Минимальный будущий путь/компонент | Переход |
|---|---|---|
| UI-A | `/production/calendar`, `CalendarWeeklyBoard` | Ячейка → UI-D; номер → UI-C; добавить → UI-B; очередь → UI-E. |
| UI-B | `CalendarAddPlanDialog` на UI-A | Выбор ТК, показ подставленных полей, POST plan → UI-C. Отдельного route создания заказа нет. |
| UI-C | `/production/calendar/plans/[id]`, `CalendarPlanDetail` | Источник ТК, план/факт/DAG; редактировать → UI-E, назначение → UI-D. |
| UI-D | `/production/calendar/day?date=&stage_id=`, `CalendarSectionDay` | Возврат в ту же неделю/участок UI-A, номер → UI-C, назначение → UI-E. |
| UI-E | `/production/calendar/plans/[id]/schedule`, `CalendarManualScheduling` | PUT allocations, возврат в переданный проверенный локальный UI-C/UI-D. |
| UI-F | `/production/calendar/capacity`, `CalendarCapacitySettings` | Из UI-A/UI-E, возврат в сохранённый контекст. |
| UI-G | `/production/calendar/dashboard`, `CalendarDashboard` | Необязательный обзор; ресурс/дата → UI-D, ссылки в UI-A/UI-F/UI-H. |
| UI-H | `/production/calendar/deviations`, `CalendarDeviations` | Причина → пагинируемые случаи → UI-C/UI-D/UI-E/UI-F. |

Только один пункт производственного календаря в существующей навигации; UI-G/H — страницы модуля, без второй платформенной навигации. Детальный график отдельного заказа не вводится в v0.1. Shared shell/components переиспользуются; UI ошибки API/403/loading не заменяются демо. Утверждение прототипа не доказывает наличие маршрута/API. Frontend data layer → календарные DTO, сервис → repositories/ERP read services; формулы и ограничения живут на сервере.

## 8. Короткие последовательные подэтапы PC-03

Все подэтапы **запланированы**, выполнения нет. Коды этапов PC-04…PC-10 и их порядок сохранены: таблица задаёт последовательность минимального пакета PC-03 и карту будущих приёмок, не закрывает остальные этапы. Каждый подэтап выбирается отдельной задачей после допуска к реализации.

| Подэтап | Ограниченный результат | Приёмка / связь с roadmap |
|---|---|---|
| PC-03.1 Persistence/data model | Только пять типов записей, добавляющая миграция upgrade/downgrade, FK/UNIQUE/CHECK/indexes | ERP модели/факт неизменны; rollback и инварианты. Основа PC-04/05/06. |
| PC-03.2 API | Plan/allocations/capacity + read DTO, права/версия/аудит | Slim batch, OpenAPI, 403/409/422; no N+1, тест отсутствующей нормы. |
| PC-03.3 Weekly board | UI-A + минимальный UI-B/UI-C/UI-D по существующим данным | Создать из ТК без повторного ввода, неделя/даты/пусто/error/mobile. Приёмки PC-04/08. |
| PC-03.4 Manual scheduling | UI-E, перенос/снятие/партийные объёмы | Общий пул, qty не удваивается, DAG/норма unknown, конфликт версии. Приёмки PC-05/06. |
| PC-03.5 Capacity/read-only calculations | UI-F, исключения и серверная загрузка по ресурсам | Нормативы/единицы/100%/zero/unknown, упаковка бригадой; PC-07. |
| PC-03.6 Dashboard/deviations | UI-G/UI-H поверх общих calculations/DTO | 100 заказов, ограниченная детализация, уникальные заказы/сигналы, common conflict один. |
| PC-03.7 Integration/tests | Связи UI-A…H, regression, audit/permissions/migrations, runtime UI | Проверки приложения/ТК/планов, responsive matrix и ручной сценарий. PC-09 launchEligibility только read-only; запись факта/глобальные launch gates отдельная согласованная интеграция. PC-10 release остаётся отдельным gate. |

## 9. Открыто перед реализацией

B1 refresh-model закрыт отдельным исправлением 2026-10-05 (13 регрессионных тестов); baseline общего check остаётся открытым. Перед включением расчётов требуются реальные capacity/timezone/work-center bindings и применимые нормы; без них сохраняются unknown. Основание закупки — ручное подтверждение диспетчера с автором/временем/причиной, а не доказательство складского прихода. Частичный факт/готовый метраж и доля участия операторов не выводятся из планов: используется существующий подтверждённый источник, иначе unknown. Универсальная интеграция календарных gates в текущий цеховой запуск отдельно не согласована.

Дизайн утверждён владельцем по задаче `2026-10-05`. Прежняя недоступность Edge и непроверенные runtime breakpoints сохранены в спецификациях как технические проверки при реализации, не выдаются за выполненные. PC-02.1 закрыт как документационный design freeze по прямому решению владельца; PC-03 автоматически не начинается.
