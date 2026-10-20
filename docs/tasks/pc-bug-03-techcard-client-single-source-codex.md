# BUG-03A — Контрагент ТК: один Client SoT и контракт (Codex)

## Цель
ТК должна выбирать существующего и создавать нового контрагента через единую текущую сущность; один выбор/изменение должен совпадать во всех связанных представлениях ТК, заказа и группы ТК.

## Важный обнаруженный конфликт
Сейчас `backend/app/services/tech_card_client.py` записывает `SalesOrder.client_id` для заказной ТК или `TechnicalCardOrderGroup.client_id` для standalone. Данные владельца: «справочник контрагентов создан». Но `docs/architecture/platform-directories.md` описывает `contractors` как planned stub и `Client` как текущий CRM SoT. НЕ создавать новую таблицу Contractors и НЕ переключать на Supplier/Organization без выяснения фактического runtime-контракта. Сначала подтвердить текущие работающие `/sales/clients` и `/settings/catalogs/contractors` маршруты/эндпоинты.

## Работа
1. Проверить client CRUD API, `tech_card_client.py`, group/order inheritance и техкарточный create/update API: сохранение ID, join display name, reload, изменение на одной поверхности и устаревший кэш на другой.
2. Утвердить в коде единственный `Client.id` как SoT, если реальный работающий справочник не доказывает иное. ТК должна иметь один серверный путь разрешения клиента: SalesOrder.client_id или OrderGroup.client_id; не хранить второй независимый клиент на ТК.
3. При создании нового Client через существующий POST client API возвращать id и обновлять связанные серверные DTO; при редактировании имени через существующий PATCH всегда read/join по id, без копирования устаревшего имени в независимое поле. Не каскадировать смену клиента без проверки связанных документов и явной операции пользователя.
4. Добавить контракт и targeted backend regression tests для создания standalone/заказной ТК, изменения клиента, нескольких ТК в одной группе/заказе, обновления данных клиента, reload и unauthorized/not-found.
5. Передать Cursor конкретные API, поля, формы и cache invalidation для модальных select/create; не делать здесь UI.

## Границы
Не объединять Client/Supplier/Organization; без массовой миграции, перепривязки существующих ТК и производственных фактов. В случае конфликтов SoT — документировать выбор и остановить рискованную миграцию, не выполнять её молча. Только local DB tests, project 10/10; commit/deploy отдельно после совместной проверки.

## BUG-03A — результат Codex, 2026-10-20

Выбран явно назначенный владельцем BUG-03A. Работа ограничена текущим Client,
parent-owned привязкой и read/rename контрактом; стадии roadmap не менялись.

### Подтверждённые причины и решение SoT

1. `/sales/clients` работает через существующий `/clients`. Local frontend GET
   перенаправляет анонимного пользователя на login. Страница
   `/settings/catalogs/contractors` и backend `/contractors` возвращают 404.
   `/clients?limit=1` возвращает 200. `/platform-directories` анонимно — 401;
   authenticated regression подтверждает `contractors.status=planned` и пустой
   api_prefix. Runtime не доказывает существования второго справочника.
2. Деталь ТК уже читала Client по SalesOrder/OrderGroup, но slim mapper обоих
   списков принудительно возвращал `client_name=null`; client_id списка отсутствовал.
3. PATCH `/clients/{id}` не принимал contact_name/company_name — существующее
   редактирование реквизитов не обеспечивало переименование Client.
4. Дополнительная зависимость выявлена regression на смене клиента в заказе:
   `sales_order_client.py` обращался к отсутствующему `Client.is_active` и падал
   с AttributeError. Проверена конкретная модель Client: такого поля нет.
   Существующий writer исправлен и переиспользован из заказной ТК.

SoT утверждён: `Client.id`; привязка хранится только в SalesOrder.client_id либо
TechnicalCardOrderGroup.client_id. Никаких Contractors, Supplier/Organization
подмен, новых таблиц, миграций, backfill или массовой смены привязок.

### Что реализовано

- Общий `technical_card_clients` разрешает ID и живое имя одним SQL join для
  детали и обоих списков; slim list embeds client_id/client_name, без per-row SQL.
- Единый company-or-contact display helper используется также DTO заказа.
- Существующий PATCH Client принимает company_name/contact_name, нормализует
  строки, разрешает очистку компании и запрещает очистку обязательного контакта.
- Card PATCH требует явный ключ client_id, положительный ID либо standalone null;
  пустой объект больше не может случайно очистить shared group.
- Заказная ТК использует существующий locked order writer; standalone writer
  блокирует строку группы. Shared-parent семантика и существующие запреты сохранены.
- Контракт + конкретная передача Cursor:
  [technical-card-client-bug-03.md](../architecture/technical-card-client-bug-03.md).
  Включены реальные API/поля, scope Save, drawer onCreated vs persistent PATCH,
  sibling/order/Client invalidation и обработка неуспешной привязки после create.

### Изменённые файлы и контракты

Runtime: `backend/app/services/tech_card_client.py`, `sales_order_client.py`,
`technical_cards.py`; `backend/app/api/technical_cards.py`, `orders.py`;
`backend/app/schemas/technical_card.py`, `client_requisites.py`.
Тесты: `backend/tests/test_techcard_client_bug_03.py` (12 новых случаев).
Документы: этот task, `technical-card-client-bug-03.md`, `platform-directories.md`,
PM-SOT в project memory, DF-TK-CLIENT в data-flow и его HTML twin.
Генератор `scripts/generate_data_flow.py` знает 14 цепочек; сообщения используют
число ожидаемых ID вместо устаревшей константы 13.

Модели БД и миграции: без изменений. API обратно совместимо расширен для имён
Client и list embed; намеренное ужесточение card PATCH: ключ обязателен,
нулевой/отрицательный ID не принимается. DTO detail не меняет форму.

### Проверки и ограничения

15 focused tests passed: 12 BUG-03A + существующие client/card list/requisites.
Итоговый `python scripts/check_project.py`: PROJECT CHECK PASSED, 10/10,
exit code 0; 1063 backend tests / 494 frontend tests, lint/tsc/build,
OpenAPI/Alembic/Compose успешны. Один полный прогон после стабилизации runtime.
Лог: `logs/bug-03-project-check.log` (ignored). `git diff --check` успешен;
генерация и `--check` data-flow twin успешны после финального изменения документа.
API regression выполняет POST standalone, POST Client → PATCH card/client,
повторные GET детали и списка, создание sibling после выбора, PATCH Client
company/contact и reload, очистку/перевыбор и сохранение unrelated group.
Для заказа: POST order/items → generate двух ТК → GET detail/global/order list;
смена из ТК и заказа, переименование и reload дают одинаковые ID/имя.

Проверены 401 card mutation, 404 card/client/rename, 422 пустой ключ/невалидный ID/
обязательный контакт/cancelled/null у заказной ТК; group null допустим. Batch
resolver выполняет один SELECT для одного и нескольких ID. Набор list DTO slim.

Проверены зависимости SalesQuotation/SalesInvoice и Specification: новый каскад
не добавлялся. Сохранённые КП/счёт и их snapshot-позиции после явной смены
клиента неизменны. Контракт не обещает неизменного исторического покупателя для
рендеринга, который и ранее читал текущий заказ; это отдельно указано Cursor.
Тест сохраняет защищённые TechnicalCard/StageResult/CalendarAssignment/Allocation/
AuditEvent при смене клиента группы; production fact/plan не меняются.

Проверки только на изолированных SQLite fixtures с FK ON; production DB и
постоянные local business data не изменялись. Local HTTP-проверки read-only.
Frontend, shell и визуальные контракты не изменялись, browser UI не проверялся.
Существующая access policy `/clients` и `/orders` не переписывалась; 401
подтверждён именно для card mutation, не выдуман для legacy CRUD.

Project memory updated: PM-SOT. Data-flow updated: DF-TK-CLIENT.
`python scripts/generate_data_flow.py --check`: HTML twin synced, 14 flows.
Roadmap: changes not required. Project structure checklist: changes not required.
ERP-check: changes not required. Их MD/HTML diff отсутствует; HTML twin изменён
только для data-flow. Матрица production invariants не затронута: их guards
не менялись. Commit/push/deploy не выполнялись.

Остаток/следующая итерация: Cursor select/create/save + bounded cache invalidation
и UI/reload проверка по переданному контракту. BUG-03A не закрывает frontend BUG-03B.
Статус: backend BUG-03A выполнен, owner review pending. Обнаруженный P1
(падение существующей смены клиента заказа) исправлен; новых P0/P1 не внесено.
Не относящиеся к задаче P2/P3 не исследовались и не исправлялись.
