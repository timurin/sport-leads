# Структура Sport-Lead

**Platform version:** `v0.6.1` (локальная линия разработки)
**Checkpoint used for status:** `v0.5.0`
**Structure code:** `SL-ERP-CHECK-v0.3.0`
**Roadmap code:** `SL-ROADMAP-v0.6.1`
**Previous structure code:** `SL-ERP-CHECK-v1`
**Status:** актуализировано по состоянию локальной ветки `feature/v0.6.1-lead-persistence` после checkpoint `v0.5.0`

Связанный документ: [SL-ROADMAP-v0.6.1](../roadmap/SL-ROADMAP-v0.6.1.md). Исторический план: [SL-ROADMAP-v0.3.0](../roadmap/SL-ROADMAP-v0.3.0.md).

## Легенда

- `[x]` — подтверждено и работает;
- `[~]` — частично реализовано или demo-only;
- `[ ]` — не реализовано;
- `[!]` — требует проверки или стабилизации.

Статус `[x]` означает не просто наличие файла или интерфейса, а подтверждённую реализацию на соответствующем слое. Наличие frontend без API и persistence отмечается `[~]`. Наличие отдельных полей или навигации без рабочего бизнес-процесса не считается готовым модулем.

## Сводное состояние

- `[x]` базовые backend и frontend, FastAPI/OpenAPI, SQLAlchemy, Alembic, PostgreSQL-конфигурация и Docker Compose;
- `[x]` проверяемые API источников, импортов, спортивных событий, материалов и части sales-контура;
- `[x]` модель и транзакционная конвертация лида в клиента и заказ с защитой от повторной конвертации;
- `[~]` CRM, заказы покупателей, продукция, склад, сотрудники, задачи, интеграции, аналитика и администрирование;
- `[ ]` модели/лекала/техкарты, дизайн-согласование, производство, закупки, логистика и финансы как самостоятельные рабочие контуры;
- `[ ]` полная backend-интеграция CRM, persistence Kanban, авторизация, роли, realtime, CI/CD и production-развёртывание.

Причина частичных статусов: существуют интерфейсы, отдельные backend-модели и demo-сценарии, но нет полного backend-контура и постоянного хранения данных для сквозного процесса.

## 1. Системное ядро

**Назначение:** запуск, конфигурация, хранение данных и общая проверка backend/frontend платформы.
**Текущий статус:** `[~]` базовое ядро работает, промышленная эксплуатация не готова.

### Подтверждено

- `[x]` FastAPI-приложение, routers и OpenAPI;
- `[x]` SQLAlchemy Base, сессии и модели;
- `[x]` Alembic с последовательностью миграций;
- `[x]` PostgreSQL и Docker Compose описаны в конфигурации;
- `[x]` Next.js frontend, ERP-навигация, lint и production build;
- `[x]` конфигурация через settings и environment;
- `[x]` комплексная проверка `scripts/check_project.py`;
- `[x]` backend pytest и frontend unit-тесты checkpoint v0.5.0;
- `[x]` checkpoint `v0.3.0-demo`, recovery guide и release `v0.5.0`.

### Частично реализовано

- `[~]` логирование присутствует в отдельных backend-сервисах, но не образует централизованный observability-контур;
- `[~]` обработка ошибок реализована на уровне API и отдельных сервисов, но не унифицирована для всей платформы;
- `[~]` документация существует, но индекс и архитектурные документы развиваются постепенно;
- `[x]` итерация `v0.6.1-roadmap-sync` создала актуальный roadmap и индекс; подтверждения: `AGENTS.md`, `docs/roadmap/SL-ROADMAP-v0.6.1.md`, `docs/README.md`, `docs/reports/ROADMAP-SYNC-REPORT.md`; проверки: project check 9/9, backend pytest 28, frontend tests 32, TypeScript, lint, build, Compose и `git diff --check`; ограничение — release/checkpoint `v0.6.1` ещё не создан;
- `[~]` PostgreSQL-конфигурация и миграции проверяются, но production-эксплуатация не подтверждена.

### Осталось

- `[ ]` CI/CD, staging и production pipelines;
- `[ ]` централизованное логирование, мониторинг и alerting;
- `[ ]` полноценная тестовая PostgreSQL-база и расширенные integration/e2e тесты;
- `[ ]` резервное копирование и документированное восстановление production-данных.

**Подтверждения:** `backend/app/main.py`, `backend/app/database`, `backend/alembic`, `frontend/app`, `compose.yaml`, `scripts/check_project.py`, `backend/tests`, `frontend/components/kanban/kanban-state.test.mjs`, `frontend/lib/sales/*.test.mjs`.
**Критерий готовности:** чистое развёртывание проходит миграции и автоматические backend/frontend/integration проверки в CI, а staging/production имеют мониторинг и восстановление.

## 2. CRM и продажи

**Назначение:** вести лиды, сделки, клиентов, контакты и действия менеджеров до передачи результата в заказ.
**Текущий статус:** `[~]` лиды и конвертация имеют backend-основу, значительная часть CRM остаётся demo/local.

### Подтверждено

- `[x]` единая SQLAlchemy-модель `Lead` и таблица `leads`;
- `[x]` модели `Client`, `SalesOrder`, `LeadEvent`, `LeadTask`, `LeadRejectionReason`, `SalesUser`;
- `[x]` модель `LeadContact`, отдельная таблица и максимум один основной контакт на лид;
- `[x]` миграция sales-таблиц, ограничений и справочника причин отказа;
- `[x]` API списка, чтения и частичного обновления лида;
- `[x]` `/sales/leads` загружает список лидов из backend без скрытой demo-подмены при ошибке;
- `[x]` числовая detail-страница загружает и сохраняет поддерживаемые моделью коммерческие поля карточки через PATCH без demo fallback;
- `[x]` числовая detail-страница загружает и сохраняет core-профиль клиента через PATCH без demo fallback;
- `[x]` API создания, изменения, удаления дополнительного и атомарной смены основного контакта;
- `[x]` API конвертации, отказа, истории и чтения созданного заказа;
- `[x]` транзакционная конвертация Lead → Client + SalesOrder;
- `[x]` запрет повторной конвертации и конфликтующих результатов;
- `[x]` frontend списка, Kanban, карточки лида и форм;
- `[x]` drag-and-drop стабилизирован и покрыт unit-тестом.
- `[x]` общая Kanban-карточка использует всю свободную поверхность как pointer drag-область и защищает вложенные интерактивные элементы.
- `[x]` постоянная конфигурация `LeadStage`, API настройки и Kanban persistence поддерживают системные и пользовательские стадии со стабильными ID.
- `[x]` финальные действия detail-карточки отделены от `LeadStage` и переиспользуют транзакционные convert/reject сервисы вместо обычного PATCH статуса.

### Частично реализовано

- `[~]` `lead-1` и `lead-2` вместе с контактами и расширенными коммерческими данными загружаются из явно выбранного demo-источника;
- `[~]` core-профиль клиента и коммерческие параметры числовой карточки хранятся в `Lead`; заметки, timeline и задачи живут в состоянии страницы;
- `[x]` Kanban и числовая detail-карточка загружают общую конфигурацию стадий через backend и сохраняют системные/custom переходы одним PATCH-контрактом;
- `[~]` список/Kanban лидов строится из `GET /leads`, а convert/reject подключены в списке и числовой detail-карточке; demo detail-лиды и локальные рабочие разделы ещё не образуют полный backend workflow;
- `[~]` формы контактов числовой detail-страницы используют `LeadContact` API через Server Actions без fallback; demo-маршруты и messenger остаются локальными;
- `[x]` коммерческая форма числовой detail-страницы сохраняет полный поддерживаемый набор полей в `Lead`: source, direction, sport, category, product type, description, quantities, budget/amount/discount/probability, order/ready/event dates, delivery fields, campaign, UTM и priority;
- `[~]` `Client` по-прежнему хранит один плоский контакт и пока не связан с общим справочником контактов;
- `[~]` backend `LeadTask` минимален и не подключён к функциональности detail-страницы;
- `[~]` backend события покрывают конвертацию, отказ и статус, но frontend timeline шире и локален;
- `[~]` поиск кандидатов-дубликатов по телефону/email доступен как read-only backend endpoint поверх существующих `Lead` и `LeadContact`;
- `[~]` защита от дублей подтверждена для повторной конвертации, но не для создания CRM-сущностей.

### Осталось

- `[ ]` полноценная модель клиента, реквизиты beyond INN, история и связи;
- `[ ]` модель `Deal`, API сделок и persistence Kanban;
- `[ ]` полное подключение detail-страницы, списка и Kanban к единому backend API без local-only операций;
- `[~]` CRUD лидов/клиентов/контактов и архивирование: создание лида, чтение, частичное обновление и contact CRUD подтверждены; архивирование и восстановление отсутствуют;
- `[~]` поиск и дедупликация по телефону/email: backend lookup кандидатов реализован, но блокировка создания, UI-предупреждение и слияние дублей отсутствуют;
- `[ ]` постоянные комментарии, файлы, задачи и активности;
- `[ ]` авторизация и права менеджеров.

**Подтверждения:** `backend/app/models/sales.py`, `backend/app/schemas/sales.py`, `backend/app/api/leads.py`, `backend/app/api/orders.py`, `backend/app/services/lead_contacts.py`, `backend/app/services/lead_conversion.py`, `backend/app/services/lead_duplicates.py`, `backend/alembic/versions/9c47a12e6b02_add_lead_conversion.py`, `backend/alembic/versions/b6c4e2f91a07_add_lead_contacts.py`, `backend/alembic/versions/c12f0f2d0f4b_add_lead_customer_profile.py`, `backend/alembic/versions/f2a7c4d8e901_add_lead_card_commercial_fields.py`, `backend/tests/test_lead_contacts.py`, `backend/tests/test_lead_conversion.py`, `backend/tests/test_lead_duplicates.py`, `docs/architecture/lead-contacts.md`, `docs/architecture/lead-commercial-persistence.md`, `frontend/app/(workspace)/sales/leads/page.tsx`, `frontend/app/(workspace)/sales/leads/[leadId]/lead-contact-actions.ts`, `frontend/app/(workspace)/sales/leads/[leadId]/lead-commercial-actions.ts`, `frontend/app/(workspace)/sales/leads/[leadId]/lead-customer-actions.ts`, `frontend/components/sales/lead-workspace.tsx`, `frontend/components/sales/lead-customer-details.tsx`, `frontend/components/sales/lead-commercial-details.tsx`, `frontend/lib/sales/lead-list-api.ts`, `frontend/lib/sales/lead-list-mapping.ts`, `frontend/lib/sales/lead-contact-api.test.mjs`, `frontend/lib/sales/lead-commercial-api.test.mjs`, `frontend/lib/sales/lead-customer-api.test.mjs`, `frontend/lib/sales/lead-list-api.test.mjs`, `frontend/lib/demo-data/sales.ts`.
**Критерий готовности:** менеджер создаёт и редактирует лид, клиента, контакты и сделку через API; Kanban и формы сохраняются в PostgreSQL после перезагрузки, а конвертация не требует повторного ввода.

## 3. Заказы покупателей

**Назначение:** хранить коммерческий документ с клиентом, позициями, расчётами, оплатами и связью с производством.
**Текущий статус:** `[~]` существует минимальный заказ результата конвертации и read-only карточка; полноценный коммерческий документ и изменение заказа отсутствуют.

### Подтверждено

- `[x]` таблица и SQLAlchemy-модель `SalesOrder`;
- `[x]` создание одного заказа из лида в транзакции;
- `[x]` связь заказа с исходным лидом и клиентом;
- `[x]` read API списка, карточки, исходного лида и общей истории;
- `[x]` уникальность заказа на один лид покрыта ограничением и тестом;
- `[x]` frontend-страница списка заказов и dashboard-сводка существуют.
- `[x]` итерация `v0.7.0-sales-order-foundation`: `/sales/orders/[orderId]` загружает существующий `GET /orders/{order_id}`, показывает номер, дату, статус, клиента, ответственного, сумму и ссылку на исходный лид; loading, not-found и API error обработаны без demo fallback.

### Частично реализовано

- `[~]` заказ хранит заголовок, описание, категорию, спорт, количество, сумму, срок и источник;
- `[~]` dashboard использует demo-данные; список и read-only карточка заказов используют backend API. Связь `SalesOrder → Organization` постоянная, но settings UI организаций пока использует demo-data.
- `[x]` смена `SalesOrder.status` сохраняется из Kanban через `PATCH /orders/{order_id}/status`, проверяет переходы и записывает `order_status_changed` в общую историю заказа (итерация `v0.7.1-sales-order-status-workflow-history`); полный жизненный цикл ещё не реализован.

### Осталось

- `[~]` read-only карточка готова, status workflow и история подключены, но прочие API и UI изменения заказа отсутствуют;
- `[ ]` товарные позиции, размеры, персонализация, цены, скидки и НДС;
- `[ ]` план и факт оплат;
- `[ ]` файлы, версии и печатные формы;
- `[ ]` спецификации и связь с производством;
- `[ ]` частичные поставки и возвраты.

**Подтверждения:** `backend/app/models/sales.py`, `backend/app/api/orders.py`, `backend/app/services/lead_conversion.py`, `backend/tests/test_lead_conversion.py`, `frontend/app/(workspace)/sales/orders`, `frontend/components/dashboard/orders-summary.tsx`.
**Критерий готовности:** заказ содержит постоянные позиции и расчёты, редактируется через API, формирует документы и передаётся в производство с неизменяемой связью с источником.

## 4. Продукция

**Назначение:** вести номенклатуру готовых изделий, материалов, услуг, полуфабрикатов и комплектов.
**Текущий статус:** `[~]` материал реализован как отдельный каталог, общая номенклатура отсутствует.

### Подтверждено

- `[x]` модель, схема, миграция и CRUD API материалов;
- `[x]` поля артикула, категории, единицы измерения, остатков и минимального остатка;
- `[x]` страница каталога материалов и общий entity UI.

### Частично реализовано

- `[~]` frontend каталога материалов использует demo records, а не backend API;
- `[~]` ERP-каталоги организаций и сотрудников представлены интерфейсами без полного backend-контура.

### Осталось

- `[ ]` единая номенклатура и категории;
- `[ ]` готовые изделия, услуги, полуфабрикаты и комплекты;
- `[ ]` характеристики, изображения и версии;
- `[ ]` подключение frontend каталога к API.

**Подтверждения:** `backend/app/models/material.py`, `backend/app/schemas/material.py`, `backend/app/api/materials.py`, `backend/alembic/versions/3f0f4f14ef0f_create_materials_table.py`, `frontend/app/(workspace)/settings/catalogs/materials`, `frontend/lib/demo-data/catalogs.ts`.
**Критерий готовности:** все типы номенклатуры управляются через единые API и постоянное хранение и используются заказами и производственными спецификациями.

## 5. Модели, лекала, спецификации и техкарты

**Назначение:** описывать конструкцию изделия, размерные ряды, операции, нормы материалов и технологию заказа.
**Текущий статус:** `[ ]` рабочий модуль не реализован.

### Подтверждено

Подтверждённо реализованных функций модуля нет. Пункты навигации и проектная документация не считаются реализацией.

### Частично реализовано

- `[~]` материалы и product category могут использоваться как будущие входные данные, но не образуют модель изделия.

### Осталось

- `[ ]` модели и версии;
- `[ ]` лекала и размерные ряды;
- `[ ]` спецификации, операции, нормы материалов и стоимость пошива;
- `[ ]` технологические карты и связь с позицией заказа.

**Подтверждения:** в `backend/app/models`, `backend/app/api` и `frontend/app` нет моделей, API и рабочих страниц этого контура.
**Критерий готовности:** утверждённая версия модели, лекала и спецификации формирует зафиксированную техкарту конкретной позиции заказа.

## 6. Дизайн и согласование

**Назначение:** управлять заданиями дизайнеров, версиями макетов и утверждением клиентом.
**Текущий статус:** `[ ]` не реализовано.

### Подтверждено

Подтверждённо реализованных функций модуля нет.

### Частично реализовано

- `[~]` frontend лида умеет показывать демонстрационные метаданные вложений, но постоянного файлового и approval-контура нет.

### Осталось

- `[ ]` задания дизайнеру и очередь;
- `[ ]` версии макетов и комментарии;
- `[ ]` внутреннее и клиентское согласование;
- `[ ]` публичная ссылка;
- `[ ]` запрет печати без утверждённой версии.

**Подтверждения:** отсутствуют соответствующие модели, миграции, API и routes; mock-вложения находятся в `frontend/components/sales`.
**Критерий готовности:** производство принимает только утверждённую версию макета, а версии, решения и комментарии сохраняются в истории.

## 7. Производство

**Назначение:** планировать и отслеживать изготовление заказа по участкам.
**Текущий статус:** `[ ]` не реализовано.

### Подтверждено

Подтверждённо реализованных функций модуля нет. Навигационные пункты не считаются рабочим производственным контуром.

### Частично реализовано

- `[~]` в статусах заказа предусмотрено значение `production`, но производственных сущностей за ним нет.

### Осталось

- `[ ]` заказ на производство и планирование;
- `[ ]` печать, крой, пошив, контроль качества и упаковка;
- `[ ]` исполнители, прогресс, сроки, брак и переделки;
- `[ ]` производственный dashboard.

**Подтверждения:** `frontend/lib/navigation.ts` содержит будущие разделы; в backend нет производственных моделей/API/миграций.
**Критерий готовности:** по каждой позиции заказа видны маршрут, исполнитель, план/факт, количество, брак и прогноз завершения.

## 8. Склад

**Назначение:** учитывать движения и доступные остатки материалов, незавершённого производства и готовой продукции.
**Текущий статус:** `[~]` есть поля остатков материалов, складского документооборота нет.

### Подтверждено

- `[x]` `Material` хранит balance, minimum balance и текстовое поле warehouse;
- `[x]` API материалов поддерживает CRUD.

### Частично реализовано

- `[~]` остаток хранится как значение карточки материала без регистра движений и партий;
- `[~]` frontend материалов demo-only;
- `[~]` складские разделы обозначены в ERP-навигации.

### Осталось

- `[ ]` склады и зоны хранения;
- `[ ]` поступления, перемещения, резервы, списания и выпуск;
- `[ ]` партии, характеристики и незавершённое производство;
- `[ ]` инвентаризация и достоверный расчёт доступного остатка.

**Подтверждения:** `backend/app/models/material.py`, `backend/app/api/materials.py`, `frontend/lib/navigation.ts`.
**Критерий готовности:** остаток вычисляется из проверяемых движений по складам и партиям, учитывает резервы и сходится по инвентаризации.

## 9. Закупки

**Назначение:** рассчитывать дефицит и управлять заказами поставщикам.
**Текущий статус:** `[ ]` не реализовано.

### Подтверждено

Подтверждённо реализованных функций модуля нет. Поле minimum balance само по себе не образует закупочный процесс.

### Частично реализовано

- `[~]` минимальный остаток может стать входом будущего расчёта дефицита;
- `[~]` пункты закупок присутствуют только в навигационной структуре.

### Осталось

- `[ ]` расчёт потребности и дефицита;
- `[ ]` поставщики и заказы поставщикам;
- `[ ]` поставки, расхождения и возвраты;
- `[ ]` история цен и рейтинг поставщиков.

**Подтверждения:** `backend/app/models/material.py`, `frontend/lib/navigation.ts`; моделей/API закупок нет.
**Критерий готовности:** система рассчитывает дефицит с учётом заказов, остатков и резервов и прослеживает закупку до поступления.

## 10. Логистика

**Назначение:** управлять упаковкой, перевозчиками, отгрузками, доставкой и возвратами.
**Текущий статус:** `[ ]` не реализовано.

### Подтверждено

Подтверждённо реализованных функций модуля нет. Статус заказа `shipped` сам по себе не образует логистический контур.

### Частично реализовано

- `[~]` отдельные demo-поля адреса и доставки представлены в frontend коммерческих данных лида.

### Осталось

- `[ ]` готовность к отгрузке и упаковочные места;
- `[ ]` перевозчики, адреса и трек-номера;
- `[ ]` частичные отгрузки и статусы доставки;
- `[ ]` возвраты и документы.

**Подтверждения:** `frontend/components/sales/lead-commercial-details.tsx`, `frontend/types/sales.ts`; постоянных моделей/API логистики нет.
**Критерий готовности:** каждая отгрузка имеет постоянные места, перевозчика, документы, tracking и историю доставки/возврата.

## 11. Финансы

**Назначение:** учитывать оплаты, задолженность, расходы, себестоимость и маржу.
**Текущий статус:** `[ ]` самостоятельный финансовый контур не реализован.

### Подтверждено

- `[x]` денежные значения лидов и заказов хранятся как `Numeric`, а не float;
- `[x]` отдельные суммы не считаются фактическим финансовым учётом.

### Частично реализовано

- `[~]` demo-dashboard показывает коммерческие KPI;
- `[~]` Lead и SalesOrder содержат estimated amount/amount.

### Осталось

- `[ ]` оплаты, задолженность и возвраты;
- `[ ]` расходы и банковские операции;
- `[ ]` плановая и фактическая себестоимость;
- `[ ]` маржа, план-факт и управленческие отчёты.

**Подтверждения:** `backend/app/models/sales.py`, `frontend/components/dashboard`, `frontend/lib/demo-data/sales-dashboard.ts`; финансовых моделей/API нет.
**Критерий готовности:** оплаты и расходы сверяются с документами, а фактическая себестоимость и маржа рассчитываются по каждому заказу.

## 12. Сотрудники

**Назначение:** вести сотрудников, подразделения, роли, права и учёт труда.
**Текущий статус:** `[~]` есть минимальный sales user и demo-интерфейсы сотрудников.

### Подтверждено

- `[x]` `SalesUser` хранит идентификатор, имя и активность;
- `[x]` ответственный и исполнитель связаны с частью sales-моделей;
- `[x]` frontend-страницы организаций и сотрудников существуют.

### Частично реализовано

- `[~]` записи организаций и сотрудников поступают из demo-data;
- `[~]` текущий пользователь и менеджеры detail-страницы заданы demo-данными.

### Осталось

- `[ ]` полноценные сотрудники и подразделения в backend;
- `[ ]` авторизация, роли и права;
- `[ ]` производственные операции и квалификации;
- `[ ]` табель и сдельная оплата.

**Подтверждения:** `backend/app/models/sales.py`, `frontend/app/(workspace)/settings/organizations`, `frontend/lib/demo-data/catalogs.ts`, `frontend/lib/demo-data/sales.ts`.
**Критерий готовности:** аутентифицированные сотрудники имеют постоянные профили, подразделения и проверяемые права, а трудовые операции учитываются по факту.

## 13. Задачи и уведомления

**Назначение:** планировать работу, контролировать дедлайны и доставлять уведомления.
**Текущий статус:** `[~]` задачи лида функциональны локально, backend-модель минимальна, уведомлений нет.

### Подтверждено

- `[x]` detail-страница поддерживает создание, изменение, завершение, открытие, перенос и удаление задач;
- `[x]` frontend-валидация и сортировка задач покрыты unit-тестами;
- `[x]` backend `LeadTask` хранит название, статус и даты;
- `[x]` конвертация/отказ корректно обрабатывают связанные открытые задачи.

### Частично реализовано

- `[~]` frontend-задачи сохраняются только в состоянии открытой карточки;
- `[~]` backend-задачи не имеют CRUD API, исполнителя, приоритета и полного дедлайна;
- `[~]` dashboard задач использует demo-данные.

### Осталось

- `[ ]` постоянный CRUD задач и связи с CRM-сущностями;
- `[ ]` постановщик, исполнитель, дедлайн, приоритет и комментарии;
- `[ ]` уведомления, согласования и журнал доставки;
- `[ ]` история изменений.

**Подтверждения:** `backend/app/models/sales.py`, `backend/app/services/lead_conversion.py`, `backend/tests/test_lead_conversion.py`, `frontend/components/sales/lead-tasks.tsx`, `frontend/lib/sales/lead-task.ts`, `frontend/lib/sales/lead-task.test.mjs`.
**Критерий готовности:** задачи сохраняются в backend, имеют ответственных и дедлайны, а уведомления доставляются и фиксируются в истории.

## 14. Интеграции

**Назначение:** связывать платформу с источниками лидов, коммуникациями, учётными и логистическими системами.
**Текущий статус:** `[~]` ingestion и контракт коммуникаций существуют, реальные CRM-коммуникации не подключены.

### Подтверждено

- `[x]` источники, импорты, collectors и parsers спортивных событий;
- `[x]` mock collector и проверки нормализации;
- `[x]` communication connector contract, registry, service и normalized message;
- `[x]` mock communication connector и backend-тесты;
- `[x]` frontend коммуникационная панель с mock-сообщениями.

### Частично реализовано

- `[~]` website/import контур собирает события, но не является полной CRM-интеграцией;
- `[~]` коммуникации frontend локальны и не вызывают backend connector core;
- `[~]` mock-коннектор не открывает внешние соединения и не сохраняет сообщения.

### Осталось

- `[ ]` реальные website, email, телефония, Telegram, WhatsApp и VK адаптеры;
- `[ ]` webhook/polling API, очередь, retry и постоянное хранение;
- `[ ]` Google Sheets, Excel, 1С и банковские интеграции;
- `[ ]` интеграции служб доставки.

**Подтверждения:** `backend/app/collectors`, `backend/app/parsers`, `backend/app/api/imports.py`, `backend/app/communications`, `backend/tests/test_collector.py`, `backend/tests/test_communications.py`, `docs/architecture/communication-connectors.md`, `frontend/components/sales/lead-communication-panel.tsx`.
**Критерий готовности:** production-коннекторы безопасно принимают и отправляют данные, сохраняют идемпотентные события и имеют retry, мониторинг и тестовые контуры.

## 15. Аналитика

**Назначение:** показывать продажи, производство, склад, финансы и показатели руководителя на фактических данных.
**Текущий статус:** `[~]` sales dashboard функционален как UI, но использует demo-данные.

### Подтверждено

- `[x]` dashboard продаж, KPI, воронка, динамика и источники;
- `[x]` фильтры периода, менеджера, источника, статуса, региона и категории;
- `[x]` сводки заказов, задач, статусов, причин отказа и активностей;
- `[x]` вычислительные frontend-функции отделены от представления.

### Частично реализовано

- `[~]` все основные показатели строятся по `getSalesDashboardDemoData`;
- `[~]` backend sales API не предоставляет аналитические агрегации.

### Осталось

- `[ ]` подключение фактических CRM и заказов;
- `[ ]` серверные агрегации и права доступа;
- `[ ]` производственная, складская и финансовая аналитика;
- `[ ]` прибыль, себестоимость, задолженность и панель руководителя.

**Подтверждения:** `frontend/components/dashboard`, `frontend/lib/dashboard`, `frontend/lib/demo-data/sales-dashboard.ts`, `frontend/app/(workspace)/sales/dashboard`.
**Критерий готовности:** показатели воспроизводимо рассчитываются из постоянных backend-данных, учитывают права и сходятся с операционными документами.

## 16. Администрирование

**Назначение:** управлять пользователями, организациями, справочниками и эксплуатацией платформы.
**Текущий статус:** `[~]` настройки и отдельные справочники есть, административный backend неполон.

### Подтверждено

- `[x]` раздел настроек и ERP-навигация;
- `[x]` CRUD API источников и материалов;
- `[x]` frontend-интерфейсы материалов, организаций и сотрудников;
- `[x]` конфигурация приложения и Compose.

### Частично реализовано

- `[~]` организации и сотрудники используют demo-data;
- `[~]` справочники реализованы точечно;
- `[~]` recovery guide описывает восстановление checkpoint, но не production backup.

### Осталось

- `[ ]` пользователи, роли, права и ограничения по организациям;
- `[ ]` постоянные организации, подразделения и склады;
- `[ ]` аудит действий и журнал входов;
- `[ ]` backup/restore, monitoring, staging и production-развёртывание.

**Подтверждения:** `frontend/app/(workspace)/settings`, `frontend/lib/entity/definitions`, `backend/app/api/sources.py`, `backend/app/api/materials.py`, `backend/app/config`, `compose.yaml`, `docs/checkpoints/v0.3.0-demo.md`.
**Критерий готовности:** администратор управляет постоянными пользователями, правами, организациями и справочниками, а эксплуатация имеет аудит, резервирование и мониторинг.

## Сквозной процесс Sport-Lead

`Лид → Сделка → Заказ покупателя → Модель/лекало/техкарта → Дизайн → Производство → Склад → Отгрузка → Оплата → Себестоимость и аналитика`

На checkpoint v0.5.0 подтверждён только фрагмент `Лид → Client + минимальный SalesOrder`. Сделка, полноценный заказ и все последующие этапы ещё не образуют сквозной постоянный процесс.

## Текущий главный разрыв

`demo UI → backend CRM → persistence → реальные бизнес-процессы`

Backend уже содержит часть sales-моделей, API, постоянные `LeadContact`, коммерческое ядро и core-профиль клиента в `Lead`; список лидов и числовая detail-страница читают backend без fallback. Frontend CRM всё ещё использует смешанную модель: `lead-1`/`lead-2`, локальные операции Kanban, messenger, расширенные коммерческие поля, задачи, заметки, timeline и сообщения остаются demo/local. Ближайшая архитектурная задача — сохранить перемещения Kanban или следующий основной сценарий лида через backend без скрытой demo-подмены.

## Подтверждение checkpoint v0.5.0

По release-документу `docs/releases/v0.5.0.md` выполнены:

- `[x]` backend pytest — 21 тест;
- `[x]` FastAPI import и OpenAPI без дублирующихся operationId;
- `[x]` frontend unit tests — 22 теста;
- `[x]` TypeScript typecheck;
- `[x]` ESLint;
- `[x]` production build;
- `[x]` HTTP-smoke списка лидов и detail routes;
- `[!]` интерактивный browser-smoke не выполнен из-за отсутствия browser backend в среде checkpoint.

Эти результаты подтверждают текущие технические слои, но не повышают demo/local функциональность до `[x]` без API и persistence.

## Итерация v0.6.1-lead-contact-persistence

- `[x]` `LeadContact` хранится отдельно от лида в PostgreSQL;
- `[x]` частичный unique index гарантирует максимум один primary на лид;
- `[x]` смена primary выполняется сервисом в одной транзакции под блокировкой лида;
- `[x]` GET лида возвращает контакты, а POST/PATCH/DELETE/set-primary имеют отдельные схемы ответа;
- `[x]` legacy `Lead.contact_name/phone/email` синхронизируются как совместимая проекция, конвертация читает primary-контакт;
- `[x]` migration upgrade/downgrade/upgrade и `alembic check` прошли;
- `[x]` focused tests — 7, полный backend pytest — 24, project check — 9/9;
- `[x]` backend-итерация завершена без скрытого frontend fallback; подключение числовой detail-страницы подтверждено следующей отдельной итерацией ниже.

## Итерация v0.6.1-lead-contact-frontend

- `[x]` числовая detail-страница отображает `LeadRead.contacts`, а не синтетический контакт из плоских полей лида;
- `[x]` добавление, изменение, удаление и смена primary вызывают существующий API через Server Actions;
- `[x]` API URL и реализация мутаций не попадают в client bundle, входные идентификаторы и имя валидируются на серверной границе;
- `[x]` ошибка backend оставляет форму открытой и не подменяется локальным успешным изменением;
- `[x]` актуальный primary синхронизирует `LeadHeader`, коммуникации и действия страницы через единое состояние `LeadPage`;
- `[x]` frontend tests — 24, включая 2 теста API mapping/payload; typecheck, lint и production build прошли;
- `[~]` `lead-1`/`lead-2` остаются явно demo/local; профиль клиента и messenger не входят в backend-модель этой итерации.

## Итерация v0.6.1-lead-commercial-frontend

- `[x]` числовая detail-страница загружает source, sport, category, description, quantity, amount, desired date и city из `LeadRead`;
- `[x]` коммерческая форма сохраняет это ядро через существующий `PATCH /leads/{lead_id}` и Server Action;
- `[x]` пустые nullable-поля очищаются явным `null`, а подтверждённый ответ API возвращается в состояние страницы;
- `[x]` недоверенные значения повторно проверяются на server boundary, включая лимиты `Integer` и `Numeric(14, 2)`;
- `[x]` ошибка backend оставляет форму открытой и не создаёт локальный successful fallback;
- `[x]` integration test проверяет фактическое хранение `Decimal`, даты и очистку; frontend tests проверяют mapping, payload и валидацию;
- `[x]` backend pytest — 25, frontend tests — 27, typecheck, lint, production build и project check 9/9 прошли;
- `[~]` расширенные поля формы, demo-лиды, список и Kanban остаются local/demo.

## Итерация v0.6.1-lead-customer-profile-persistence

- `[x]` `Lead` расширен nullable-полями core-профиля клиента: `customer_type`, `tax_id`, `website`, `region`, `address`, `customer_comment`; `company_name` и `city` остаются существующими источниками истины;
- `[x]` добавлена обратимая миграция `c12f0f2d0f4b_add_lead_customer_profile.py`;
- `[x]` `LeadRead` и `LeadUpdate` возвращают и принимают профиль клиента через существующий `PATCH /leads/{lead_id}`;
- `[x]` числовая detail-страница читает профиль клиента из `LeadRead` и сохраняет его через Server Action без client-side API URL;
- `[x]` пустые nullable-поля очищаются явным `null`, а ошибка backend оставляет форму открытой и не создаёт локальный successful fallback;
- `[x]` backend integration tests проверяют сохранение, очистку и валидацию INN; frontend tests проверяют mapping, payload и server-boundary validation;
- `[x]` backend pytest — 27, frontend tests — 30, typecheck, lint, production build, Alembic current/upgrade/downgrade/upgrade/check и project check 9/9 с `PYTHONUTF8=1` прошли;
- `[~]` demo-лиды `lead-1`/`lead-2`, messenger, список/Kanban, расширенные коммерческие поля, задачи, заметки и timeline остаются local/demo.

## Итерация v0.6.1-lead-list-backend-load

- `[x]` `/sales/leads` стал server-rendered route и загружает начальный список через `GET /leads?limit=500` с `cache: "no-store"`;
- `[x]` API URL и fetch находятся в server-only data layer, client component получает только сериализуемые лиды и статус загрузки;
- `[x]` API-лиды мапятся в существующую модель `Lead` для Kanban без создания второй frontend-сущности;
- `[x]` при ошибке backend список показывает явное сообщение и пустой набор, demo-данные не подставляются скрыто;
- `[~]` диагностическая доработка `v0.6.1-lead-list-dev-seed`: добавлена явная идемпотентная development seed-команда `SPORT_LEADS_ALLOW_DEV_SEED=1 .\.venv\Scripts\python.exe scripts\seed_sales_dev.py`, которая создаёт или обновляет 5 числовых backend-лидов, контакты и коммерческие данные минимум для двух лидов; команда не запускается автоматически и блокируется для `APP_ENV=production` или `ENVIRONMENT=production`;
- `[x]` focused frontend tests проверяют mapping активного, конвертированного и отклонённого лида;
- `[x]` focused seed pytest `backend/tests/test_sales_dev_seed.py` подтверждает идемпотентность seed и отсутствие дублей; полные проверки выполняются перед завершением диагностики;
- `[~]` создание лида, перемещения Kanban, convert/reject из списка, demo detail-лиды, задачи, заметки, timeline и сообщения остаются local/demo.

## Итерация v0.6.1-roadmap-sync

- `[x]` локальная линия разработки определена как `v0.6.1` по ветке, task-документу и реализованным итерациям после `v0.5.0`;
- `[x]` создан единый актуальный `SL-ROADMAP-v0.6.1`, а `SL-ROADMAP-v0.3.0` сохранён как исторический;
- `[x]` корневой `AGENTS.md` содержит правила выбора модели владельцем и фиксации архитектурных блокеров;
- `[x]` индекс документации связывает актуальный roadmap, структуру, checkpoint/release, инструкции и исторический roadmap;
- `[x]` project check 9/9, backend pytest 28, frontend tests 32, TypeScript, lint, production build, Compose и проверка diff прошли;
- `[~]` отдельного release-документа, checkpoint и тега `v0.6.1` пока нет.

## Итерация v0.6.1-lead-kanban-stage-persistence

- `[x]` frontend Kanban для числовых API-лидов использует существующий server action и `PATCH /leads/{lead_id}` для изменения стадии;
- `[x]` ошибка backend возвращает карточку к снимку предыдущей стадии и показывает явное сообщение, без успешного локального fallback;
- `[x]` источник истины после перезагрузки остаётся `GET /leads` из PostgreSQL; demo-идентификаторы не участвуют в persistence-контуре;
- `[~]` конфигурация стадий и полный журнал переходов остаются local/следующими задачами.

Подтверждения: `frontend/components/sales/lead-workspace.tsx`, `frontend/lib/sales/lead-stage-persistence.ts`, `frontend/lib/sales/lead-stage-persistence.test.mjs`, `frontend/app/(workspace)/sales/leads/[leadId]/lead-header-actions.ts`, `backend/app/api/leads.py`.

## Итерация v0.6.1-lead-convert-list-persistence

- `[x]` completion dialog числового API-лида использует существующий server action и `POST /leads/{lead_id}/convert`;
- `[x]` карточка списка получает состояние completed/converted только после подтверждённого backend-ответа с заказом;
- `[x]` ошибки конвертации не маскируются локальным успешным состоянием;
- `[x]` payload mapping покрыт focused frontend test;
- `[~]` reject из списка и единый полный convert/reject workflow ещё не подключены.

Подтверждения: `frontend/app/(workspace)/sales/leads/[leadId]/lead-header-actions.ts`, `frontend/lib/sales/lead-details.ts`, `frontend/lib/sales/lead-conversion.ts`, `frontend/lib/sales/lead-conversion.test.mjs`, `frontend/components/sales/lead-workspace.tsx`, `backend/app/api/leads.py`.

## Итерация v0.6.1-lead-reject-list-persistence

- `[x]` frontend reason code разрешается в активный backend reason id через существующий read API справочника причин;
- `[x]` reject числового лида использует существующий `POST /leads/{lead_id}/reject`;
- `[x]` подтверждённый ответ обновляет карточку списка, а ошибка сохраняет диалог и введённые значения;
- `[x]` demo-лиды не участвуют в persistence-контуре, новый endpoint не создавался;
- `[x]` mapping reason code → id покрыт focused frontend test;
- `[~]` полный backend workflow CRM и история активности остаются частичными.

Подтверждения: `frontend/app/(workspace)/sales/leads/[leadId]/lead-header-actions.ts`, `frontend/lib/sales/lead-details.ts`, `frontend/lib/sales/lead-rejection.ts`, `frontend/lib/sales/lead-rejection.test.mjs`, `frontend/components/sales/lead-completion-dialog.tsx`, `backend/app/api/leads.py`, `backend/app/api/lead_rejection_reasons.py`.
## Итерация v0.6.1-lead-history-reload

- `[x]` frontend data layer повторно использует backend-модель `LeadEvent` и существующий `GET /leads/{lead_id}/history`;
- `[x]` status change, conversion, rejection и order creation преобразуются в единую `LeadActivity` timeline и восстанавливаются после reload из PostgreSQL;
- `[x]` отсутствует local-only successful fallback для API-истории, а demo IDs явно обслуживаются прежним demo-контуром;
- `[x]` подтверждены endpoint/mapping тесты и полный набор обязательных проверок, миграция не потребовалась;
- `[~]` persistence комментариев, задач и сообщений для числовых лидов остаётся отдельным незавершённым контуром.

Подтверждения: `backend/app/models/sales.py`, `backend/app/api/leads.py`, `backend/tests/test_lead_conversion.py`, `frontend/lib/sales/lead-history.ts`, `frontend/lib/sales/lead-details.ts`.
## Итерация v0.6.1-sales-orders-backend-list

- `[x]` frontend data layer повторно использует существующий read endpoint `/orders`, без нового API-контура;
- `[x]` list endpoint обогащает `SalesOrderRead` именами клиента и ответственного через существующие `Client`/`SalesUser`, сохраняя связь `lead_id`;
- `[x]` числовой заказ, созданный конвертацией, появляется в списке после reload из PostgreSQL; demo-заказы не используются в API-сценарии;
- `[x]` подтверждены backend/frontend тесты и обязательные проверки, миграция не нужна;
- `[~]` order mutations и отдельная detail-страница заказа остаются вне этой итерации.

Подтверждения: `backend/app/models/sales.py`, `backend/app/schemas/sales.py`, `backend/app/api/orders.py`, `backend/tests/test_lead_conversion.py`, `frontend/lib/sales/order-list-api.ts`, `frontend/app/(workspace)/sales/orders/page.tsx`.

## Итерация v0.7.0-sales-order-foundation

- `[x]` detail read API `GET /orders/{order_id}` повторно использует `SalesOrderRead` и возвращает сериализованный заказ с именами `Client` и `SalesUser`;
- `[x]` карточка `/sales/orders/[orderId]` получает только backend-данные, показывает обязательный header, nullable поля и сохранённую связь с исходным лидом;
- `[x]` список заказов ведёт на карточку заказа; отдельные loading, not-found и error UI не скрывают ошибки API;
- `[x]` API-контракт подтверждён `backend/tests/test_lead_conversion.py`, UI mapping и URL — `frontend/lib/sales/order-details.test.mjs` и `frontend/lib/sales/order-list-api.test.mjs`;
- `[~]` мутации заказа, позиции, финансы, производство, склад и расширенный workflow остаются вне foundation; миграция не создавалась.

Подтверждения: `backend/app/api/orders.py`, `backend/app/schemas/sales.py`, `backend/tests/test_lead_conversion.py`, `frontend/lib/sales/order-details.ts`, `frontend/lib/sales/order-details.test.mjs`, `frontend/lib/sales/order-list-api.ts`, `frontend/lib/sales/order-list-api.test.mjs`, `frontend/components/sales/sales-order-page.tsx`, `frontend/app/(workspace)/sales/orders/[orderId]`.

## Итерация v0.7.1-sales-order-status-workflow-history

- `[x]` service-слой разрешает только переходы вперёд, отмену незавершённого заказа и повторное сохранение текущего статуса; возврат назад и изменение финальных статусов возвращают `409`;
- `[x]` статусные изменения сохраняются как `LeadEvent(order_status_changed)` в существующей таблице `lead_events`, без второй модели истории;
- `[x]` добавлена обратимая миграция `a91d6e3f4b20`, расширяющая `event_type` до 20 символов; downgrade нормализует новые события;
- `[x]` `/orders/{order_id}/history` и detail UI показывают backend-историю после reload, проверки: backend pytest 42, frontend tests 52, typecheck, lint, build и project check 9/9;
- `[~]` сложные переходы, роли, платежи, позиции заказа и полный коммерческий workflow ещё не реализованы.

Подтверждения: `backend/app/services/sales_order_status.py`, `backend/app/api/orders.py`, `backend/alembic/versions/a91d6e3f4b20_add_order_status_changed_event.py`, `backend/tests/test_lead_conversion.py`, `frontend/lib/sales/order-details.ts`, `frontend/components/sales/sales-order-page.tsx`.
## Итерация v0.7.2-sales-order-organization-foundation

- `[x]` persistent `Organization` хранит название и базовые реквизиты, а `SalesOrder.organization_id` использует nullable FK с `SET NULL` для обратной совместимости;
- `[x]` service конвертации лида создаёт или переиспользует организацию по ИНН/названию и связывает её с новым заказом;
- `[x]` `GET /organizations`, `GET /orders`, `GET /orders/{id}` и `PATCH /orders/{id}/organization` используют Pydantic-контракты и не возвращают ORM напрямую;
- `[x]` миграция `b7c8d9e0f123` прошла downgrade/upgrade/check; backend pytest 44, frontend tests 52, typecheck, lint, build и project check 9/9 прошли;
- `[~]` административный CRUD UI организаций и автоматическое заполнение связи для исторических заказов остаются отдельными задачами.

Evidence: `backend/app/models/sales.py`, `backend/app/services/lead_conversion.py`, `backend/app/services/sales_order_organization.py`, `backend/app/api/organizations.py`, `backend/app/api/orders.py`, `backend/alembic/versions/b7c8d9e0f123_add_organizations_to_sales_orders.py`, `frontend/components/sales/sales-order-page.tsx`.

## Итерация v0.6.1-navigation-remove-deals

## Итерация v0.7.3-sales-order-items

- `[x]` `SalesOrderItem` хранит snapshot-наименование, единицу, количество, цену и рассчитанную сумму строки; `order_id` удаляется каскадно;
- `[x]` item API разделён на route/service/schema-слои и пересчитывает `SalesOrder.amount` после каждой записи;
- `[x]` миграция `c8d9e0f1a234` обратима, а тесты подтверждают CRUD, reload и корректный пересчёт Decimal-сумм;
- `[~]` необязательная связь с `Material` не заменяет будущий Product-каталог; production, склад и документы не затронуты.

Evidence: `backend/app/models/sales.py`, `backend/app/services/sales_order_items.py`, `backend/app/schemas/sales.py`, `backend/app/api/orders.py`, `backend/alembic/versions/c8d9e0f1a234_add_sales_order_items.py`, `backend/tests/test_lead_conversion.py`, `frontend/components/sales/sales-order-items.tsx`.

- `[x]` навигация CRM больше не предлагает отдельную сущность `Сделка`;
- `[x]` прямые ссылки на лиды и заказы покупателей сохранены, backend и маршруты не изменялись;
- `[x]` demo route `/sales/deals` оставлен только для исторического/тестового контура и недоступен из активного меню.

Подтверждения: `frontend/lib/navigation.ts`, `frontend/lib/navigation.test.mjs`, `frontend/app/(workspace)/sales/deals/page.tsx`.

## Итерация v0.6.1-lead-creation

- `[x]` новая операция создания не вводит вторую CRM-сущность: `Lead` остаётся источником состояния и коммерческого ядра, `LeadContact` — источником основного контакта, а плоские contact-поля `Lead` сохраняются как совместимая проекция;
- `[x]` service-слой атомарно создаёт `Lead` в стадии `new`, один primary `LeadContact` и `LeadEvent(lead_created)`; API возвращает `LeadRead`, а не ORM-объект;
- `[x]` frontend data layer и Server Action отделены от UI, валидируют вход на серверной границе и не создают локальный успешный результат при ошибке backend;
- `[x]` контракт подтверждён backend/frontend тестами, OpenAPI и полным project check; схема БД не менялась, Alembic сообщает head `c12f0f2d0f4b` и отсутствие новых операций;
- `[~]` архивное состояние, восстановление и правила включения архива в список/Kanban не определены этой подзадачей; интерактивный browser-smoke недоступен в текущей среде.

Подтверждения: `backend/app/schemas/sales.py`, `backend/app/services/lead_creation.py`, `backend/app/api/leads.py`, `backend/tests/test_lead_creation.py`, `frontend/app/(workspace)/sales/leads/lead-create-actions.ts`, `frontend/components/sales/lead-create-dialog.tsx`, `frontend/components/sales/lead-workspace.tsx`, `frontend/lib/sales/lead-create-api.ts`, `frontend/lib/sales/lead-creation.ts`.

## Итерация v0.6.1-lead-city-autocomplete

- `[x]` город остаётся строковым полем существующего `Lead`; новый справочник, foreign key, API или дублирующий источник истины не создавались;
- `[x]` единый frontend-компонент отделяет UX-подсказки от форм и пригоден для будущих форм заказов;
- `[x]` создание лида, профиль клиента и коммерческая доставка используют одинаковую логику подсказок и сохраняют выбранное или ручное значение через прежние контракты;
- `[x]` pure-фильтрация покрыта тестами, полный frontend и project check прошли;
- `[~]` browser-smoke недоступен; backend persistence конфигурации стадий и остальные части UX-патча ещё не реализованы.

Подтверждения: `frontend/components/ui/city-autocomplete.tsx`, `frontend/lib/city-suggestions.ts`, `frontend/lib/sales/city-suggestions.test.mjs`, `frontend/components/sales/lead-create-dialog.tsx`, `frontend/components/sales/lead-customer-details.tsx`, `frontend/components/sales/lead-commercial-details.tsx`.

## Итерация v0.6.1-lead-custom-stage-persistence

- `[x]` `LeadStage` является постоянным источником метаданных рабочих стадий; системные строки создаются миграцией, custom ID остаются стабильными при переименовании и сортировке;
- `[x]` `Lead.status` хранится как `String(64)` и остаётся единственным источником текущей рабочей стадии либо финального `completed`, поэтому отдельная дублирующая FK-колонка не создавалась;
- `[x]` service-слой проверяет активность стадии, защищает зарезервированные IDs и атомарно переносит лиды перед отключением/удалением стадии с записью `LeadEvent`;
- `[x]` `GET/PUT /lead-stages` возвращают Pydantic-схемы, Kanban читает конфигурацию server-side и сохраняет изменения через Server Action без скрытого local fallback;
- `[x]` обратимая миграция `e4b8a2c91d7f` прошла upgrade/downgrade/upgrade и `alembic check`; downgrade переводит лиды из неизвестных старой схеме custom-стадий в `new` перед сужением поля;
- `[x]` backend pytest — 34, frontend tests — 45, TypeScript, lint, build, OpenAPI и project check 9/9 прошли;
- `[~]` browser runtime не предоставил браузер; detail-карточка подключена следующей итерацией, аудит самих изменений конфигурации стадий остаётся незавершённым.

Подтверждения: `backend/app/models/sales.py`, `backend/app/schemas/sales.py`, `backend/app/services/lead_stages.py`, `backend/app/api/lead_stages.py`, `backend/alembic/versions/e4b8a2c91d7f_add_persistent_lead_stages.py`, `backend/tests/test_lead_stages.py`, `frontend/lib/sales/lead-stage-api.ts`, `frontend/lib/sales/lead-stage-api-mapping.ts`, `frontend/app/(workspace)/sales/leads/lead-stage-actions.ts`, `frontend/components/sales/lead-workspace.tsx`.

## Итерация v0.6.1-lead-detail-custom-stages

- `[x]` detail route числового лида получает конфигурацию через существующий server-only `getLeadStages`, без нового API и без передачи API URL в client bundle;
- `[x]` `LeadDetails.stageId` сохраняет произвольный валидный backend stage ID, а `LeadHeader` использует его для badge, dropdown и шкалы после reload;
- `[x]` API-лиды не читают `localStorage` и не используют фиксированный enum/allowlist; demo-лиды сохраняют прежнюю локальную совместимость;
- `[x]` изменение стадии использует существующий Server Action и `PATCH /leads/{lead_id}`, поэтому backend остаётся единственным владельцем валидации активности;
- `[x]` frontend mapping покрыт focused-тестами, backend pytest — 34, frontend tests — 47, TypeScript, lint, build и project check 9/9 прошли;
- `[~]` интерактивный browser-smoke недоступен; финальные действия и drag-область остаются следующими частями UX-патча.

Подтверждения: `frontend/app/(workspace)/sales/leads/[leadId]/page.tsx`, `frontend/components/sales/lead-page.tsx`, `frontend/components/sales/lead-header.tsx`, `frontend/lib/sales/lead-details.ts`, `frontend/lib/sales/lead-detail-stage.ts`, `frontend/lib/sales/lead-detail-stage.test.mjs`.

## Итерация v0.6.1-lead-detail-final-actions

- `[x]` определения финальных действий являются отдельным неизменяемым frontend-контрактом и не входят в persistent-конфигурацию рабочих `LeadStage`;
- `[x]` detail-карточка переиспользует существующие `LeadCompletionDialog`, Server Actions и backend endpoints convert/reject без новой модели, миграции или API;
- `[x]` обычный PATCH статуса продолжает запрещать `completed`, поэтому завершение возможно только через бизнес-сервис с созданием заказа либо обязательной причиной отказа;
- `[x]` подтверждённый ответ обновляет состояние карточки и даёт переход в созданный заказ; backend `LeadEvent` сохраняет conversion/rejection history для reload;
- `[x]` backend pytest — 34, frontend tests — 48, TypeScript, lint, build и project check 9/9 прошли;
- `[~]` интерактивный browser-smoke недоступен; расширение drag-области Kanban остаётся последней частью UX-патча.

Подтверждения: `frontend/components/sales/lead-header.tsx`, `frontend/components/sales/lead-page.tsx`, `frontend/components/sales/lead-completion-dialog.tsx`, `frontend/app/(workspace)/sales/leads/[leadId]/lead-header-actions.ts`, `frontend/lib/sales/lead-details.ts`, `frontend/lib/sales/lead-final-actions.ts`, `frontend/lib/sales/lead-final-actions.test.mjs`, `backend/app/services/lead_conversion.py`, `backend/tests/test_lead_conversion.py`.

## Итерация v0.6.1-kanban-full-card-drag

- `[x]` reusable pointer sensor общего Kanban-слоя разрешает drag из свободной части и специально из заголовочной ссылки, но отказывает для кнопок, form controls, служебных ссылок, contenteditable и явного `data-kanban-no-drag`;
- `[x]` sortable listeners размещены на контейнере карточки, поэтому заголовок, сумма и свободные информационные области являются activator surface;
- `[x]` порог активации 6 px отделяет обычный click от drag, а локальный флаг состоявшегося drag блокирует ошибочную навигацию после drop;
- `[x]` click по свободной области использует существующий `card.href`; собственные обработчики ссылок и action-кнопок не перехватываются;
- `[x]` изменение не связано с моделями, API или миграциями и автоматически применимо к будущим Kanban-доскам;
- `[x]` backend pytest — 34, frontend tests — 50, TypeScript, lint, build и project check 9/9 прошли;
- `[~]` интерактивный browser-smoke недоступен; автоматизированные критерии UX-патча подтверждены.

Подтверждения: `frontend/components/kanban/kanban-board.tsx`, `frontend/components/kanban/kanban-card.tsx`, `frontend/components/kanban/kanban-interaction.ts`, `frontend/components/kanban/kanban-interaction.test.mjs`, `frontend/components/kanban/kanban-state.ts`, `frontend/components/kanban/kanban-state.test.mjs`.

## Итерация v0.6.1-lead-duplicate-candidates

- `[x]` API поиска кандидатов-дубликатов размещён в существующем sales leads router и возвращает `LeadRead`, поэтому API не отдаёт ORM-объекты напрямую;
- `[x]` service-слой `lead_duplicates` нормализует email и телефон и проверяет совпадения в `Lead` и связанных `LeadContact`, без новой таблицы, миграции или второго источника истины;
- `[x]` endpoint является read-only и не меняет правила создания лида, чтобы не вводить неутверждённую блокировку CRM-сущностей;
- `[x]` backend pytest — 36 и project check 9/9 с `PYTHONUTF8=1` прошли;
- `[~]` frontend warning, ручное слияние дублей и запрет создания дубля остаются незавершёнными бизнес-сценариями.

Подтверждения: `backend/app/services/lead_duplicates.py`, `backend/app/api/leads.py`, `backend/tests/test_lead_duplicates.py`.

## Итерация v0.6.1-lead-card-save-fix

- `[x]` расширение карточки выполнено без параллельной CRM-модели: `Lead` остаётся источником истины для клиентского профиля, source, стадии, ответственного и коммерческих параметров;
- `[x]` добавлены nullable-колонки `Lead` и обратимая миграция `f2a7c4d8e901`; денежные и процентные значения используют `Numeric`/`Decimal`, даты заказа/готовности/мероприятия остаются `Date`;
- `[x]` `LeadUpdate` и `LeadRead` синхронизированы с моделью, а существующий `PATCH /leads/{lead_id}` возвращает обновлённый `LeadRead` после commit/refresh;
- `[x]` frontend data layer сохраняет camelCase ↔ snake_case mapping в `frontend/lib/sales/lead-commercial-api.ts`, отправляет очистку как `null` и после успешного save берёт состояние из backend-ответа;
- `[x]` `delivery_city` отделён от `city`, поэтому коммерческий город доставки больше не затирает город клиента;
- `[x]` `responsible_id` в PATCH валидируется как active `SalesUser`; frontend больше не показывает demo-менеджеров как локально сохранённое изменение API-лида;
- `[x]` backend pytest — 37, frontend tests — 50, TypeScript, lint, build, Alembic upgrade/check, project check 9/9 и `git diff --check` прошли;
- `[~]` отдельный backend-список пользователей/назначений, persistent tasks, notes, messages и расширенная timeline не входят в эту итерацию.

Подтверждения: `backend/app/models/sales.py`, `backend/app/schemas/sales.py`, `backend/app/api/leads.py`, `backend/alembic/versions/f2a7c4d8e901_add_lead_card_commercial_fields.py`, `backend/tests/test_lead_conversion.py`, `frontend/lib/sales/lead-commercial-api.ts`, `frontend/lib/sales/lead-commercial-api.test.mjs`, `frontend/lib/sales/lead-details.ts`, `frontend/components/sales/lead-commercial-details.tsx`, `frontend/components/sales/lead-header.tsx`, `frontend/app/(workspace)/sales/leads/[leadId]/lead-commercial-actions.ts`, `frontend/app/(workspace)/sales/leads/[leadId]/lead-header-actions.ts`.
