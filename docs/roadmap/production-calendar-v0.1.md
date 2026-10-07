# Production Calendar v0.1 — Roadmap / Task list

**Проект:** Sport-Leads (SPORT UNIFORM)  
**Тип:** отдельный модуль ручного планирования и диспетчеризации производства  
**Статус:** DESIGN-FROZEN / PC-03.1 queue MVP implemented; PC-03 open  
**Версия плана:** PC-ROADMAP-v0.1  
**Приоритет:** отдельное решение P1/обязательных проверок перед выбранным подэтапом PC-03

**Актуальный контракт 2026-10-05:** [минимальная реализация v0.1](../architecture/production-calendar-implementation-v0.1.md) имеет приоритет над первоначальными предложениями PC-02. UI-A–UI-H OWNER-APPROVED, DESIGN-APPROVED = true. PC-03.1 реализован по отдельной задаче владельца; PC-03…10 остаются открытыми.

## 0. Цель и границы

Выпустить автономный производственный календарь, который позволяет **вручную добавлять производственные заказы**, распределять операции по датам и участкам, видеть дневную/недельную загрузку и контролировать последовательность выполнения.

### Принципы
- **Заказ покупателя в CRM не требуется**: модуль работает без использования сущности SalesOrder и без автоматической конвертации лидов.
- Для плана выбирается существующая standalone ТК: ручной номер группы, изделие, модель, вариант, количество и маршрут подставляются из ERP. Диспетчер вводит только недостающие даты/назначения и календарное подтверждение материалов.
- **Норматив времени пошива 1 изделия на 1 швею** брать из модели (прочитать фактические поля, единицы измерения и семантику). Не заводить второй норматив пошива.
- Мощность пошива: число доступных швей × часы смены × коэффициент эффективного времени. Это **человеко-часы**, не машино-часы. Доступное количество изделий за смену вычислять по нормативу модели.
- Прочие операции (дизайн, печать, раскрой, упаковка): выяснить наличие норм и ресурсов в платформе; если отсутствуют — поддержать ручной ввод плановой трудоёмкости по операции, пометку «нет норматива» и последующее подключение норм. **Не подставлять норму пошива для иных этапов.**
- Планирование **ручное**. Система автоматически лишь рассчитывает загрузку, проверяет зависимости и предупреждает о перегрузке/рисках. Не создавать авто-планировщик или авто-перенос работ в v0.1.
- Использовать существующие модели, техкарты и маршруты, **не дублировать** справочники. Изменять работающие API/сущности только при доказанной необходимости, обратно совместимо и после явного отражения в плане.
- Дизайн: существующий AppShell и утверждённый SL-UI-BASE-v1; адаптивность desktop/laptop/tablet/mobile, без независимой дизайн-системы.

## 1. Минимальный пользовательский сценарий

1. Открыть UI-A «Производственный календарь» и выбрать неделю/участок.
2. «Добавить заказ» открывает UI-B: выбрать существующую standalone ТК, проверить подставленные поля; при отсутствии ТК пройти её действующее создание.
3. Создать CalendarPlan над ТК, без новой бизнес-сущности заказа и без обязательного ProductionOrder/SalesOrder; срок по умолчанию читается из группы ТК.
4. Назначить даты, ресурс и количество работы в UI-E; часы рассчитываются из подтверждённой нормы, иначе unknown/явная допустимая оценка.
5. UI-A/UI-D показывают ресурсную загрузку, неизвестные нормы, выходные и отдельный допуск запуска. Производственный факт читается из ТК.
6. При отклонении перенести план с аудитом; UI-G/H доступны для необязательного обзора. Календарь не дублирует start/complete workflow ТК.

## 2. Маршрут и зависимости

- Независимый calendar DAG snapshot использует реальные этапы снимка ТК: закупка и дизайн параллельно → подготовка → плоттеры → каландр → раскрой → пошив → упаковка. Подработы печати не становятся новыми ProductionStage.
- Закупка — ручное подтверждение с автором/временем/причиной, без часовой нормы и автоматического чтения готовности из PO/материалов ТК.
- Планирование до готовности допускается; launchEligibility блокируется при неизвестной норме/готовности или незавершённом предшественнике. Плановая дата не подтверждает факт.
- Реальный запуск остаётся в существующем ТК/цеховом API. Глобальное внедрение calendar DAG в эти endpoints требует отдельного интеграционного решения; текущая бизнес-логика не меняется.
- Партийные назначения сохраняют собственный объём/единицы, сумма изделий не удваивается. Если существующий источник не подтверждает готовый объём частичной партии, её launchEligibility остаётся unknown/blocked.
- Неподдерживаемый/неоднозначный маршрут не исправляется автоматически; см. минимальный контракт §3/5.

## 3. Расчёт мощностей

### Пошив
- `available_person_minutes(day) = Σ_shift (available_sewers_shift × productive_hours_shift × 60 × efficiency_shift)`; реальные параметры смен/перерывов задаются при вводе мощности в эксплуатацию; без них capacity_unknown.
- Решение владельца PC-02.1: `duration_seconds` применимой операции — секунды на одно изделие для одной швеи. `unit_labor_seconds = Σ_applicable_variant_lines (duration_seconds × quantity_per_item)`; `required_person_minutes(order) = quantity × unit_labor_seconds / 60`. Поля `model.sewing_time_per_unit_minutes` в коде нет. Пустой вариант, нулевая применимая строка или неоднозначный состав варианта → `norm_missing`/`norm_unverified`, а не числовая загрузка. Исключения: `docs/tasks/production-calendar-pc-02-1-validation.md`.
- `load_percent(day) = sum(planned_person_minutes_for_day) / available_person_minutes(day) * 100`.
- `model_capacity_per_shift = floor(available_person_minutes / sewing_minutes_per_unit)` — справочная величина **только при выпуске одной модели**, а не дополнительный независимый лимит.
- Для нескольких моделей суммировать трудоёмкость в человеко-минутах. Загрузка >100% выделяется как перегрузка; смену самовольно не расширять.
- 0 швей, нерабочий день, отсутствие норматива, некорректные единицы → явное состояние невозможности расчёта или нулевой доступной мощности; не делить на ноль и не обозначать как «свободно».

### Календарь ресурсов
- Участок (или его ссылка на существующую сущность, если уже реализована); рабочие дни; число смен; длительность смены; количество доступных сотрудников по профилю; коэффициент эффективности (по умолчанию настраиваемый, **не зашивать 85%**).
- Исключения по конкретным датам: выходной, сокращённый день, количество реально вышедших швей, дополнительная смена.
- Уточнить в аудите: единица нормы, продолжительность смены, учитываются ли перерывы, применимость нормы к изделию/комплекту, хранится ли норма на модели или операции.
- Для дизайна/печати/раскроя/упаковки не придумывать пропускную способность: на v0.1 допустимы отдельные настройки доступных часов и **ручные оценки трудоёмкости**, пока не подтверждены существующие нормативы.

### Историчность
- При создании операции фиксировать ссылку на источник норматива, норму и единицу на момент планирования (snapshot), отдельно — актуальный справочник.
- Изменение модели не должно автоматически пересчитывать утверждённые прошлые планы и факт; пересчёт будущих операций — только явным действием с аудитом.

## 4. Минимальные данные

Пять типов добавляющих записей: CalendarPlan над существующей ТК, CalendarOperation для плановой работы, CalendarAllocation для даты/ресурса/объёма, CalendarCapacityRule и CalendarCapacityException. Зачем нужен каждый тип, поля и ограничения: [implementation contract §3](../architecture/production-calendar-implementation-v0.1.md). Отдельных CalendarOrder, кадровых/ресурсных каталогов, CalendarDependency, нормо-снимка отдельной таблицей и CalendarEvent нет. DAG/нормы — компактные снимки; история — существующий AuditEvent. Факт/статусы ERP читаются, не зеркалятся вторым workflow.

## 5. UI и права

UI-A — основной недельный календарь; UI-B добавляет план из ТК без повторного ввода источников, UI-C показывает план и read-only факт, UI-D — участок/дату, UI-E — ручные назначения, UI-F — мощности. UI-G — Дашборд производственного календаря; UI-H — Центр отклонений, необязательные обзоры. Восемь экранов OWNER-APPROVED; DESIGN-APPROVED=true. Existing AppShell/PT-02/RBAC переиспользуются, справочники и shell не дублируются. Runtime loading/error/403/версии/keyboard/responsive проверяются при реализации; ошибки API не заменяются демоданными.

## 6. Roadmap разработки — задачи и приёмка

**PC-01 — Read-only аудит (BLOCKER).** Проверить `AGENTS.md`, `project-structure.md`, `erp-check.md`, корневой `roadmap.md`; найти реальные модели/маршруты/техкарты, поля «количество/время» и единицы, доступные API, справочник участков, календарь, права и компоненты UI. Артефакт: матрица переиспользования + риски + список вопросов без догадок. **Приёмка:** ни один продуктивный файл/миграция не изменены.

**PC-02 — Контракт и схема данных.** Определить границы новых сущностей, ссылки на уже реализованные модели/техкарты/маршруты, правила историчности нормативов, статусы и зависимости, решение при отсутствии норм. **Приёмка:** нет обязательной связи с SalesOrder, нет дубликатов существующих справочников, миграции только добавляющие. Архитектурный результат `2026-10-03`: `docs/architecture/production-calendar-pc-02.md`; нерешённые бизнес-вопросы перечислены там и остаются gate до реализации.

**PC-02.1 — Lightweight design freeze и минимальный implementation contract (CLOSED 2026-10-05).** Семантика норм исследована, UI-A–UI-H OWNER-APPROVED, DESIGN-APPROVED = true по `docs/tasks/pc-02-1-lightweight-design-freeze-implementation-contract.md`. **Артефакты:** `docs/architecture/production-calendar-implementation-v0.1.md`, проверка PC-02.1 и генерируемый HTML roadmap. **Приёмка:** минимальные новые записи/API/переиспользование и короткий план PC-03 документированы, MD/HTML синхронизированы. P1 B1 закрыт 2026-10-05 (13 регрессионных тестов); прежние сбои проверок сохраняются как отдельные ограничения реализации; закрытие не исправляет их и не начинает PC-03.

**PC-02.1-B1 — P1: потеря материала ТК после refresh-model (CLOSED 2026-10-05).** Исправление: `docs/tasks/pc-02-1-b1-fix-refresh-model-material-loss.md`; refresh обновляет только заголовок/лекала, не префиллит материал повторно. **Приёмка:** 13 targeted regression tests passed: ручные/Spec/route материалы сохраняют id, количество, факт и привязки после повторных refresh; пустой/частичный BOM не заменяет состав; явные edits/delete и initial BOM prefill работают. API/БД/миграции без изменений; baseline DB/lint проверки открыты, PC-03 не начат.

**PC-03 — Минимальная реализация лёгкого календаря (в работе).** In progress: PC-03.1 lightweight queue MVP complete per docs/tasks/pc-03-1-lightweight-production-queue-mvp.md; remaining implementation checkpoints open. Capacity, dependency engine, execution, dashboard/deviations excluded from this slice. **Приёмка:** оставшиеся checkpoint-ы требуют отдельных задач; PC-04…PC-10 не закрыты.

**PC-03.1 — Lightweight Production Queue MVP (CLOSED 2026-10-05).** PC-03.1 lightweight queue MVP CLOSED 2026-10-05; CalendarAssignment only, migration u0v1w2x3y456; authenticated batch API and /production/calendar UI-A; 479 backend / 299 frontend tests, project check 10/10, live CRUD/reload/filter and 1440/1024/768/390/320 px. Evidence: docs/tasks/pc-03-1-lightweight-production-queue-mvp.md. PC-03 remains open; capacity/workflow/UI-G/H deferred. **Приёмка:** существующая standalone ТК назначается на участок/дату; перенос/удаление/фильтр/ссылка/перезагрузка сохраняют данные; один reversible additive migration, без изменения ERP факта.

**PC-03.2 — Production Queue Navigation Integration (CLOSED 2026-10-05).** PC-03.2 navigation integration CLOSED 2026-10-05; Production → Очередь производства, five primary links, parent opens /production/calendar; UI-E/F/G/H entry pages explicitly not implemented. 15 navigation / 300 frontend / 479 backend tests; project check 10/10; isolated shell browser QA 1440/1024/768/390/320 px; authenticated route QA limited by bootstrap 401. Evidence: docs/tasks/pc-03-2-production-queue-navigation.md. Backend/DB/business logic unchanged; PC-03 open. **Приёмка:** один родитель, пять маршрутов, раскрытие и активный подпункт; будущие экраны явно обозначены, persistent readiness не закрыта.

**PC-03.3 — Manual Scheduling on CalendarAssignment (CLOSED 2026-10-05).** PC-03.3 manual scheduling on CalendarAssignment CLOSED 2026-10-05; /production/calendar/planning, UI-A assignment deep link, date/stage/position/note prefill, before/after preview, existing PUT and return to destination week; quantity read-only from TC. Backend/API/DB/migrations unchanged. 23 targeted frontend / 11 existing calendar backend / 305 full frontend / 479 full backend tests; project check 10/10; live Chromium 1440/1366/1280/1024/768/390/320 px, real 409 and reload persistence. Evidence: docs/tasks/pc-03-3-manual-scheduling-calendar-assignment.md; PC-03 open, UI-F/G/H deferred. **Приёмка:** UI-A → UI-E → дата/участок → сохранение → целевая неделя → reload; quantity не редактируется.

**PC-03.4A — Capacity Backend Contract (CLOSED 2026-10-05).** PC-03.4A Capacity backend contract CLOSED 2026-10-05; 14 logical resource keys reusing ProductionStage/WorkCenter; two settings/exception tables, migration v1w2x3y4z567; GET/PUT capacity/settings, PUT/DELETE dated exceptions, read-only POST capacity/load-state with separate units and unknown norms. 45 targeted / 513 full backend tests; project check 10/10; local PostgreSQL upgrade/check/downgrade/upgrade/check and live persistence passed. Contract: docs/architecture/production-calendar-capacity-pc-03-4a.md. Frontend/UI-A unchanged by Codex; PC-03.4B temporary adapter still requires contract alignment; UI-F integration not claimed. PC-03 open. **Приёмка:** stable native API, durable settings/exceptions, warning-only load, no catalogs/shift engine; frontend adapter alignment belongs to PC-03.4B.

**PC-03.4D — Queue Load Indicators (CLOSED 2026-10-05).** PC-03.4D Queue Load Indicators CLOSED 2026-10-05; UI-A stage/date badges from existing POST capacity/load-state, one settings read + bounded resource/date requests (six in flight), no frontend formulas or mixed-unit section percentage; unknown stays explicit, reserve/near/over never gate assignment creation/move. 17 targeted / 323 frontend / 513 backend tests; project check 10/10; real API Chromium seven widths, four states, empty days, create/move while over, 503/retry. Evidence: docs/tasks/pc-03-4d-queue-load-indicators-cursor.md. Backend/DB/UI-F/navigation unchanged; PC-03 open. **Приёмка:** backend-only calculation, four states/unknown≠0, compact per-cell details, manual create/move not blocked; missing meters/method/manual hours remain unknown.

**PC-03.5A — Automatic Entry Stage (CLOSED 2026-10-05).** PC-03.5A Automatic Entry Stage CLOSED 2026-10-05; minimal POST assignments accepts technical_card_id/planned_date/optional note, server chooses launch_preparation (Подготовка к запуску) and stable date/stage tail position; legacy create stage/position rejected422. Existing dispatcher PUT/read/reference quantity preserved. Data-only migration w2x3y4z5a678; procurement remains milestone on entry stage. 61 targeted / 529 backend tests; project check10/10; local migration cycle, eight concurrent creates and durable move verified. Contract docs/architecture/production-calendar-entry-pc-03-5a.md. Frontend PC-03.5B separate; PC-03 open. **Приёмка:** safe preparation entry/no manager stage or position, stable tail, persistence, preserved dispatcher PUT; no full dependency/workflow engine.

**PC-03.6A — Operation Date Range (CLOSED 2026-10-06).** PC-03.6A Operation Date Range implemented 2026-10-06: planned_start_date aliases legacy planned_date; persisted planned_end_date with inclusive range CHECK/backfill; PUT accepts start/end, GET board uses overlap, minimal POST remains single-day. Migration x3y4z5a6b789; 71 targeted / 539 backend tests passed; PostgreSQL migration cycle/backfill verified. Contract docs/architecture/production-calendar-date-range-pc-03-6a.md. Frontend PC-03.6B separate; PC-03 remains open. **Приёмка:** old single-day compatibility, multi-day edit/reload, invalid ranges rejected, inclusive overlap across week boundaries; no auto-scheduling or frontend changes.

**PC-03.7A — Shared Capacity Resources (CLOSED 2026-10-06).** PC-03.7A Shared CapacityResource CLOSED 2026-10-06 per owner M:N decision: TechOperation owns technology, CapacityResource owns capacity; existing settings renamed in place, dated exceptions preserved, print_operator shared by sublimation and heat_transfer without resource copies. Migration y4z5a6b7c890; canonical resource CRUD and operation links, legacy capacity/load-state compatible. 53 targeted / 555 backend / 331 frontend tests; project check 10/10; isolated PostgreSQL migration cycle and exact data preservation verified. Contract docs/architecture/production-calendar-shared-capacity-pc-03-7a.md. Other resources remain unlinked until explicitly selected; frontend PC-03.7B separate; PC-03 open. **Приёмка:** one shared resource across operations, preserved data and exceptions, legacy load compatibility, no route/TC semantics change or frontend edits.

**PC-03.7B — Unified Tech Operation Capacity UI (IN PROGRESS).** In progress: Unified Tech Operation Capacity UI; follows owner M:N decision in production-calendar-shared-capacity-pc-03-7a.md. Owner-selected guarded edit modal PC-03.7B-B1 complete; shared CapacityResource/link adapter integration and authenticated runtime acceptance remain open. docs/tasks/pc-03-7b-unified-tech-operation-capacity-ui-cursor.md; no scheduler. **Приёмка:** both editors consume shared resource data and M:N keys without independent capacity copies; overall task remains open.

**PC-03.7B-B1 — Guarded TechOperation Edit Modal (CLOSED 2026-10-06).** PC-03.7B-B1 Guarded TechOperation edit modal CLOSED 2026-10-06 per owner visual request: desktop/mobile Edit opens populated dialog, header Save/Cancel/X, dirty discard confirmation for Cancel/X/Escape/backdrop, beforeunload and pending-save protection; pending date exception and failed save preserve inputs. DS-PT-02-CATALOG; 17 Chromium checks at 1440/1366/1280/1024/768/390/320 px; 7 targeted / 331 frontend / 555 backend tests, project check 10/10. Evidence docs/tasks/pc-03-7b-b1-tech-operation-edit-modal.md. Backend/contracts/migrations unchanged; complete shared-resource frontend integration PC-03.7B remains open. **Приёмка:** populated modal, header actions, close/dirty/pending-save guards, errors keep draft, seven responsive widths; no complete capacity integration claim.

**PC-04 — Добавление существующей ТК в календарную очередь.** UI-B подставляет номер группы, изделие/модель/вариант/количество/маршрут; создаётся CalendarPlan, а не второй заказ. **Приёмка:** данные источника read-only, нет обязательного SalesOrder/ProductionOrder, повторное добавление ТК идемпотентно.

**PC-04.2 — Demand Calculation Contract (ARCHITECTURE SPECIFICATION CLOSED 2026-10-07).** PC-04.2 Demand Calculation Contract CLOSED as architecture specification 2026-10-07 per owner task after stated PC-04.1 prerequisites. Canonical production-demand-pc-04-2.md defines step-scoped ResourceDemand DTO/status/provenance, adapter registry, verified TC/assembly inputs, exact unit equality, shared resources, missing/manual policy and future tests. No executable Demand/API/DB/frontend/Scheduler changes; hourly-throughput mismatches and absent fixed/operator/design/split inputs remain explicit implementation limits. Project check10/10; 565 backend tests. docs/tasks/pc-04-2-demand-calculation-contract.md. Historical PC-04 queue checkpoint and Scheduler implementation remain open. **Приёмка:** verified-source contract covers every step with ready/manual/missing/not_applicable outcomes, no calendar dependence or implicit conversions. Documentation completion only; executable service remains future work.

**PC-05 — Формирование маршрута.** Создать независимые календарные операции по выбранному маршруту с параллельными «Закупка» и «Дизайн» и последовательными последующими. **Приёмка:** печать ждёт двух предшественников; операции можно планировать до завершения предыдущих.

**PC-06 — Ручное размещение по датам.** Добавить задания на один/несколько дней, редактирование и удаление распределений, предупреждение о конфликтах. **Приёмка:** одно задание 14 ч может иметь 8 ч в первый и 6 ч во второй день; пересчёт корректен.

**PC-07 — Расчёт загрузки.** Подтверждённые снимки норм и мощность одного ресурса в одной единице; ручная оценка дизайна/недостающего метража явно маркируется, пустая норма пошива остаётся unknown. **Приёмка:** нет 0% при отсутствующей норме, нет деления на ноль, перегрузка >100%, операторы/машины/общий пул и бригада разделены.

**PC-08 — Недельное табло.** Матрица по участкам/датам, карточка дня, план/факт, перегрузка, адаптивность. **Приёмка:** неделя с датами, предыдущая/следующая, задания по клику, корректная мобильная прокрутка.

**PC-09 — Read-only факт и допуск запуска.** Чтение ТК/этапов, calendar DAG snapshot, launchEligibility и аудит календарных правок. **Приёмка:** план до готовности допустим; неизвестная обязательная норма/готовность или предшественник блокируют предлагаемый запуск. Существующие start/complete API сохраняются, глобальная интеграция calendar gates и второй производственный факт не реализуются в v0.1.

**PC-10 — Стабилизация и выпуск.** Проверки backend/frontend/typecheck/build/migrations/permissions, регрессия CRM/заказов/моделей/техкарт, документация, демонстрационный сценарий. **Приёмка:** существующие тесты проходят; новый модуль не пишет в исходные бизнес-сущности; UI не нарушает SL-UI-BASE-v1; известные ограничения описаны.

## 7. Приоритет / зависимости задач

- Фаза A «согласование»: PC-01 → PC-02 → PC-02.1 (документационный gate закрыт 2026-10-05).
- Фаза B «основа»: PC-03 и PC-04 после PC-02.1 и DESIGN-APPROVED; начало требует отдельного выбора владельца и устранения P1/обязательных сбоев.
- Фаза C «план»: PC-05 → PC-06 → PC-07.
- Фаза D «табло и факт»: PC-08, PC-09 после PC-06/07.
- Фаза E «релиз»: PC-10 после всех обязательных задач.
- Закрывать фазы отдельно; не брать реализацию всех фаз одной гигантской задачей Codex.

## 8. Вне объёма v0.1

Автоматическая генерация производственных заказов из CRM/SalesOrder; закупочные документы и остатки; автоматическая оптимизация или перепланирование; стоимость/зарплата/сдельная оплата; работа с отдельными машинами/полным MES; частичные передачи между этапами; сложные графики Ганта; производственные маршруты, не предусмотренные текущими данными; автоматическое резервирование складских остатков.

## 9. Встраивание в общий roadmap платформы

- Раздел: «Производство → Production Calendar v0.1 (ручное планирование и загрузка)».
- Разместить в существующем этапе производственного контура (либо как предварительную независимую фазу **до** автоматизации производства), **не переименовывая существующие этапы 0–10 и не меняя порядок других задач**.
- В общий `roadmap.md` добавлять **короткую ссылку и контрольные точки**, а подробности держать в настоящем файле.
- По итогам PC-01 откорректировать пункты, опирающиеся на непроверенные предположения, через явное изменение roadmap, а не молчаливое кодирование.

## 10. Definition of Done (v0.1)

Диспетчер создаёт заказ из модального окна без CRM-заказа, вручную назначает его операции на даты, видит недельную загрузку, рассчитанную с учётом штатной/дневной мощности и **существующей нормы пошива на одну швею**, может отметить выполнение. Все зависимости валидируются на сервере; прочие модули функционируют по прежним правилам; новый календарь изолирован и протестирован.

## 11. Interface design — before implementation

**UI-A–UI-H OWNER-APPROVED; DESIGN-APPROVED = true (`2026-10-05`).** Явное решение владельца: [Lightweight Design Freeze](../tasks/pc-02-1-lightweight-design-freeze-implementation-contract.md). PC-UI-01…12 и документационный PC-02.1 закрыты. UI-A — основной недельный календарь, UI-G — [Дашборд производственного календаря](../design/production-calendar/gantt-prototype.html), UI-H — [Центр отклонений](../design/production-calendar/risks-conflicts-prototype.html); обзорные страницы не обязательны в ежедневной работе. [Минимальный контракт](../architecture/production-calendar-implementation-v0.1.md) имеет приоритет над расширенным предложением PC-02. Дизайн утверждён; приложение/миграции не реализованы, P1 B1 закрыт 2026-10-05; baseline checks открыты. Прежняя недоступность Edge остаётся runtime QA при реализации, не выполненной проверкой.

| Screen | Purpose | Planned specification |
|---|---|---|
| UI-A | Weekly load board | docs/design/production-calendar/screens/weekly-board.md |
| UI-B | Autonomous order creation | docs/design/production-calendar/screens/create-order.md |
| UI-C | Order and operation detail | docs/design/production-calendar/screens/production-order.md |
| UI-D | Section day | docs/design/production-calendar/screens/section-day.md |
| UI-E | Manual planning | docs/design/production-calendar/screens/manual-scheduling.md |
| UI-F | Section capacities | docs/design/production-calendar/screens/capacity-settings.md |
| UI-G | Production calendar dashboard | docs/design/production-calendar/screens/gantt.md |
| UI-H | Deviation center | docs/design/production-calendar/screens/risks-conflicts.md |

Planned index and final review: docs/design/production-calendar/README.md and review-checklist.md. Task descriptions and acceptance criteria: docs/tasks/integrate-production-calendar-v0.1-roadmap.md. Sequence: platform audit, navigation map, UI contract, one screen per iteration, cross-screen UX and owner approval. No application code is included in this phase.

### Read-only findings for PC-01

| Reuse candidate | Confirmed in code | Open decision |
|---|---|---|
| Model and sewing duration | backend/app/models/product_model.py has AssemblyOperationLine.duration_seconds (seconds, default 0) and quantity_per_item; backend/app/models/sewing_operation.py is a catalog without its own duration. | No model.sewing_time_per_unit_minutes field was found. Decide whether and how variant operation durations yield a norm for one item and one sewer. Zero cannot silently mean available capacity. |
| Technical card | backend/app/models/technical_card.py has standalone order_group_id, nullable SalesOrder links, quantity, model and variant references; backend/app/api/technical_cards.py exposes standalone creation and read endpoints. | Define calendar order linkage and manual number uniqueness without changing the card lifecycle. |
| Routing and section | backend/app/models/shop_routing.py has ShopRoutingTemplate, ShopRoutingStageLine, WorkCenter; backend/app/models/production_stage.py has ProductionStage; APIs exist for these catalogs. | WorkCenter is equipment or place, not the section. Dated shifts and sewer counts are not confirmed in these models. |
| UI and execution | frontend/lib/navigation.ts, frontend/components/navigation/ and docs/design-system/ define the platform; technical_cards.py has stage read and transition endpoints. | No Production Calendar API or UI was found. Confirm permissions, screen paths, and interaction with existing card execution in PC-01/PC-02. |

Open decisions: labor norm source, units and aggregation; missing-norm display; capacities for non-sewing sections; parallel route branches; card and status linkage. Until resolved, the formulas in section 3 are a proposal rather than an implemented contract.
