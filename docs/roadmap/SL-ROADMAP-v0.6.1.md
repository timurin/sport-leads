# Sport-Lead Roadmap

**Platform version:** `v0.6.1` (локальная линия разработки, без release/tag)
**Roadmap code:** `SL-ROADMAP-v0.6.1`
**Structure code:** `SL-ERP-CHECK-v0.3.0`
**Previous roadmap codes:** `SL-ROADMAP-v0.3.0`, `SL-ROADMAP-v1`
**Baseline checkpoint:** `v0.5.0`
**Status source:** ветка `feature/v0.6.1-lead-persistence`, четыре локальных коммита после `origin/main` и проверенные незакоммиченные изменения текущей итерации

Актуальная архитектурная детализация: [SL-ERP-CHECK-v0.3.0](../architecture/SL-ERP-CHECK-v0.3.0.md). Исторический план: [SL-ROADMAP-v0.3.0](SL-ROADMAP-v0.3.0.md).

## Легенда

- `[x]` — подтверждено кодом и проверками;
- `[~]` — частично, frontend-only, demo-only или неполный backend-контур;
- `[ ]` — отсутствует;
- `[!]` — сломано или требует стабилизации.

## Текущая граница версии

`v0.6.1` развивает только этап CRM и продаж после checkpoint `v0.5.0`. Основной разрыв: список и числовая карточка лида уже читают backend, но создание лида, перемещения Kanban, действия convert/reject из списка и часть detail-сценариев остаются local/demo. Переход к сделкам, полноценным заказам, производству, складу или финансам не подтверждён.

## 0. Платформа

- `[x]` FastAPI backend, SQLAlchemy и OpenAPI;
- `[x]` Next.js frontend с TypeScript, ESLint, unit-тестами и production build;
- `[x]` PostgreSQL-конфигурация через Docker Compose;
- `[x]` Alembic и обратимые миграции;
- `[x]` комплексная проверка `scripts/check_project.py`;
- `[x]` backend pytest и frontend unit-тесты;
- `[x]` документация синхронизирована с локальной линией `v0.6.1`; ссылки и обязательные проверки подтверждены итерацией `v0.6.1-roadmap-sync`;
- `[~]` отдельный release/checkpoint `v0.6.1` ещё не создан;
- `[~]` существуют checkpoint `v0.3.0-demo`, recovery guide и release/checkpoint `v0.5.0`; production backup/restore не подтверждён;
- `[ ]` CI/CD, staging, production monitoring и централизованный observability-контур.

Подтверждения: `backend/app/main.py`, `backend/app/database`, `backend/alembic`, `frontend/app`, `frontend/package.json`, `compose.yaml`, `scripts/check_project.py`, `backend/tests`, `docs/releases/v0.5.0.md`.

## 1. Лиды

- `[x]` единая backend-модель `Lead`, Pydantic-схемы и API списка, чтения и частичного обновления;
- `[x]` числовая карточка лида загружает backend-данные без скрытой demo-подмены;
- `[x]` контакты хранятся в `LeadContact`; CRUD и атомарная смена primary подключены к числовой карточке;
- `[x]` коммерческое ядро и расширенные поля карточки лида хранятся в `Lead` через `Numeric`/`Decimal` для денежных и процентных значений и сохраняются существующим PATCH;
- `[x]` core-профиль клиента хранится в `Lead` и сохраняется числовой карточкой;
- `[~]` список `/sales/leads` загружает `GET /leads?limit=500` без скрытого fallback; ручной smoke с реальной PostgreSQL-записью ещё не зафиксирован;
- `[~]` явный идемпотентный dev-seed создаёт пять числовых лидов, контакты и коммерческие данные, но не является runtime-функцией и не запускается автоматически;
- `[x]` изменение рабочей стадии и перемещение числового API-лида в Kanban сохраняются через backend, включая пользовательские стадии;
- `[x]` конфигурация стадий хранится в `lead_stages`; создание, переименование, порядок, активность и атомарный перенос лидов подтверждены backend/frontend тестами;
- `[~]` convert/reject и завершение успешно/отказ подтверждены backend API, но действия списка остаются локальными;
- `[x]` backend выполняет транзакционную конвертацию `Lead → Client + SalesOrder` и защищает от повторной конвертации;
- `[~]` минимальный `SalesOrder` создаётся при конвертации; модели `Deal` нет;
- `[~]` frontend-аналитика лидов функциональна, но строится на demo-данных;
- `[~]` `lead-1`/`lead-2`, задачи, заметки, timeline, сообщения и коммуникации остаются demo/in-memory;
- `[~]` создание и архивирование лида через рабочий frontend/API сценарий — итерация `v0.6.1-lead-creation` завершила создание через `POST /leads` и frontend-форму; архивирование и восстановление остаются отдельной подзадачей;
- `[~]` постоянные настраиваемые стадии, Kanban persistence и синхронизация detail-карточки подтверждены итерациями `v0.6.1-lead-custom-stage-persistence` и `v0.6.1-lead-detail-custom-stages`; `lead_status_changed` записывается, но полный аудит конфигурации ещё не реализован;
- `[x]` постоянная конвертация/отказ доступны из списка и непосредственно из detail-шкалы через единый completion dialog и существующие backend-действия;
- `[~]` поиск и дедупликация лидов по телефону/email — итерация `v0.6.1-lead-duplicate-candidates`: добавлен read-only backend endpoint `GET /leads/duplicate-candidates`, который ищет кандидатов по email и нормализованному телефону в `Lead` и `LeadContact`; подтверждения: `backend/app/services/lead_duplicates.py`, `backend/app/api/leads.py`, `backend/tests/test_lead_duplicates.py`; проверки: backend pytest 36 и project check 9/9 с `PYTHONUTF8=1`; ограничение: создание лида пока не блокируется, UI-предупреждение и сценарий слияния дублей не реализованы.

Подтверждения: `backend/app/models/sales.py`, `backend/app/schemas/sales.py`, `backend/app/api/leads.py`, `backend/alembic/versions/f2a7c4d8e901_add_lead_card_commercial_fields.py`, `backend/app/services/lead_contacts.py`, `backend/app/services/lead_conversion.py`, `backend/tests/test_lead_contacts.py`, `backend/tests/test_lead_conversion.py`, `frontend/app/(workspace)/sales/leads`, `frontend/components/sales`, `frontend/lib/sales`, `frontend/lib/demo-data/sales.ts`.

## 2. Сделки и заказы покупателей

- `[ ]` модель и API `Deal`;
- `[~]` Kanban сделок существует только во frontend на demo-данных;
- `[x]` минимальные модели `Client` и `SalesOrder` создаются транзакционной конвертацией лида;
- `[x]` `SalesOrder` связан с исходным лидом и клиентом и доступен через read API;
- `[~]` список и read-only карточка заказов используют backend-данные; создание, редактирование и прочие изменения заказа через UI отсутствуют;
- `[~]` заказ хранит заголовок и основные поля из лида, но не является полноценным коммерческим документом;
- `[ ]` товарные позиции, размеры, персонализация, скидки, НДС и расчёты;
- `[ ]` полный жизненный цикл статусов, платежей и отгрузок;
- `[ ]` спецификации, техкарты и связь с производством.

Подтверждения: `backend/app/models/sales.py`, `backend/app/api/orders.py`, `backend/app/services/lead_conversion.py`, `backend/tests/test_lead_conversion.py`, `frontend/app/(workspace)/sales/deals`, `frontend/app/(workspace)/sales/orders`.

## 3. Остальные модули

- `[~]` продукция и материалы: модель, миграция и CRUD API материалов подтверждены; frontend каталога использует demo-data, единой номенклатуры нет;
- `[ ]` модели, лекала, спецификации и техкарты;
- `[ ]` дизайн и согласование;
- `[ ]` производство;
- `[~]` склад: у материала есть поля остатка и минимального остатка, но нет движений, партий, резервов и документов;
- `[ ]` закупки;
- `[ ]` логистика;
- `[ ]` финансы: суммы лидов/заказов используют `Numeric`, но оплат, расходов, себестоимости и учёта нет;
- `[~]` системное ядро: запуск, конфигурация, миграции и проверки работают; auth, RBAC, multi-organization isolation и production-эксплуатация отсутствуют;
- `[~]` интеграции: ingestion и communication connector core с mock-коннектором существуют; production-адаптеров, очереди и persistence сообщений нет;
- `[~]` аналитика: sales dashboard и фильтры существуют, но работают на demo-данных.

Подтверждения: `backend/app/models/material.py`, `backend/app/api/materials.py`, `backend/app/communications`, `backend/app/collectors`, `frontend/app/(workspace)`, `frontend/components/dashboard`, `frontend/lib/demo-data`.

## Правила развития

- Выполнять только следующий незавершённый пункт текущего этапа CRM и продаж.
- Не переходить к следующему этапу без завершения текущего, успешных проверок, отсутствия P0/P1 и явного подтверждения владельца.
- Не повышать demo/local/frontend-only функциональность до `[x]` без API, persistence и проверок.
- Сохранять разделение API, schemas, services, repositories, database models, frontend data layer и UI.
- После каждой итерации обновлять этот roadmap и `SL-ERP-CHECK-v0.3.0` только по факту.

## Следующая рекомендуемая итерация

После завершения и ручной проверки текущей `v0.6.1-lead-list-backend-load` — сохранить изменение статуса/перемещение лида в Kanban через существующий backend-контур, не меняя дизайн и не переходя к следующему этапу. При отсутствии архитектурного решения остановить спорную часть и зафиксировать блокер для владельца.

## Итерация v0.6.1-lead-kanban-stage-persistence

- `[x]` перемещение числового API-лида между активными Kanban-стадиями отправляет изменение через существующий `PATCH /leads/{lead_id}` и server action;
- `[x]` optimistic UI откатывается к предыдущей стадии при ошибке backend, без подмены demo-лидами;
- `[x]` после перезагрузки список снова получает сохранённую стадию из `GET /leads`/PostgreSQL;
- `[x]` добавлены focused frontend tests для выбора API-лида и rollback-правила; таблица и detail-страница не изменялись;
- `[~]` настраиваемые стадии по-прежнему хранят конфигурацию в `localStorage`, а полная история статусов и операции convert/reject из списка остаются следующими задачами.

Подтверждения: `frontend/components/sales/lead-workspace.tsx`, `frontend/lib/sales/lead-stage-persistence.ts`, `frontend/lib/sales/lead-stage-persistence.test.mjs`, `frontend/app/(workspace)/sales/leads/[leadId]/lead-header-actions.ts`, существующий `PATCH /leads/{lead_id}` в `backend/app/api/leads.py`.

## Итерация v0.6.1-lead-convert-list-persistence

- `[x]` конвертация числового API-лида из существующего списка отправляет данные диалога через server action в существующий `POST /leads/{lead_id}/convert`;
- `[x]` локальное состояние завершённого лида обновляется только после подтверждённого ответа backend с сохранённым заказом;
- `[x]` ошибка backend остаётся видимой и не создаёт локальный успешный fallback;
- `[x]` добавлен focused frontend test для преобразования payload диалога в контракт backend;
- `[~]` отказ из списка и полный combined-сценарий convert/reject остаются отдельной следующей подзадачей.

Подтверждения: `frontend/app/(workspace)/sales/leads/[leadId]/lead-header-actions.ts`, `frontend/lib/sales/lead-details.ts`, `frontend/lib/sales/lead-conversion.ts`, `frontend/lib/sales/lead-conversion.test.mjs`, `frontend/components/sales/lead-workspace.tsx`, существующий `POST /leads/{lead_id}/convert` в `backend/app/api/leads.py`.

## Итерация v0.6.1-lead-reject-list-persistence

- `[x]` reason code из диалога сопоставляется с активной backend-причиной через `GET /lead-rejection-reasons?is_active=true`;
- `[x]` числовой API-лид отправляет отказ через существующий `POST /leads/{lead_id}/reject` с найденным `rejection_reason_id` и комментарием;
- `[x]` локальный статус меняется только после успешного ответа backend;
- `[x]` при ошибке backend диалог остаётся открытым с сохранёнными reason code и комментарием, а успешный fallback не создаётся;
- `[x]` добавлен focused frontend test сопоставления reason code с backend id;
- `[~]` полный combined-сценарий convert/reject и постоянная история переходов остаются незавершёнными.

Подтверждения: `frontend/app/(workspace)/sales/leads/[leadId]/lead-header-actions.ts`, `frontend/lib/sales/lead-details.ts`, `frontend/lib/sales/lead-rejection.ts`, `frontend/lib/sales/lead-rejection.test.mjs`, `frontend/components/sales/lead-completion-dialog.tsx`, `frontend/components/sales/lead-workspace.tsx`, существующие endpoints в `backend/app/api/leads.py` и `backend/app/api/lead_rejection_reasons.py`.

## Критерий завершения текущего этапа

Менеджер создаёт лид, редактирует его основные данные и контакты, меняет статус в Kanban, завершает лид успешно или отказом и после перезагрузки видит состояние из PostgreSQL; конвертация создаёт постоянный коммерческий результат без повторного ввода, а dashboard использует фактические данные.
## Итерация v0.6.1-lead-history-reload

- `[x]` числовая detail-страница использует существующие `LeadEvent` и `GET /leads/{lead_id}/history`, без дублирующего контура или миграции;
- `[x]` переходы стадии, конвертация, отказ и создание заказа отображаются в единой timeline после загрузки из PostgreSQL;
- `[x]` ошибка history не подменяется demo/local данными, demo-лиды остаются отдельным локальным контуром;
- `[x]` добавлены frontend mapping-тест и backend endpoint-тест для status/convert/reject истории; backend pytest, frontend tests, typecheck, lint, build, check_project, Alembic check и diff check прошли;
- `[~]` комментарии, задачи и сообщения числового лида пока остаются локальными и не входят в эту итерацию.

Подтверждения: `frontend/lib/sales/lead-history.ts`, `frontend/lib/sales/lead-history.test.mjs`, `frontend/lib/sales/lead-details.ts`, `backend/tests/test_lead_conversion.py`, существующие `backend/app/models/sales.py` и `backend/app/api/leads.py`.
## Итерация v0.6.1-sales-orders-backend-list

- `[x]` список заказов использует существующий `GET /orders?limit=500` и не подменяет API-ошибки demo-данными;
- `[x]` `SalesOrder` после конвертации загружается после reload с номером, клиентом, статусом, суммой, ответственным и ссылкой на исходный lead;
- `[x]` сохранён текущий Kanban-дизайн списка, добавлены mapping/frontend и backend reload-тесты;
- `[x]` backend pytest, frontend tests, typecheck, lint, build, check_project, Alembic check и diff check прошли; миграция не потребовалась;
- `[~]` создание и редактирование заказов через UI остаются отдельным незавершённым сценарием.

Подтверждения: `backend/app/api/orders.py`, `backend/app/schemas/sales.py`, `backend/tests/test_lead_conversion.py`, `frontend/lib/sales/order-list-api.ts`, `frontend/lib/sales/order-list-api.test.mjs`, `frontend/app/(workspace)/sales/orders/page.tsx`.

## Итерация v0.7.0-sales-order-foundation

- `[x]` существующий `GET /orders/{order_id}` обогащён теми же `client_name` и `responsible_name`, что и список, и возвращает Pydantic-контракт, а не ORM-объект;
- `[x]` добавлен маршрут `/sales/orders/[orderId]` с read-only header и основными полями заказа, ссылкой на исходный лид, состояниями loading/not-found/API error и возвратом к списку;
- `[x]` Kanban-список открывает карточку заказа, а не карточку исходного лида; frontend не использует demo fallback;
- `[x]` добавлены backend-проверки существующего заказа, 404, связей и nullable-полей, а также frontend mapping- и URL-тесты;
- `[~]` это foundation v0.7.0: товарные позиции, редактирование, оплаты, производство и склад не реализованы; workflow статусов продолжен отдельной итерацией `v0.7.1-sales-order-status-workflow-history`.

Подтверждения: `backend/app/api/orders.py`, `backend/tests/test_lead_conversion.py`, `frontend/app/(workspace)/sales/orders/[orderId]/page.tsx`, `frontend/app/(workspace)/sales/orders/[orderId]/loading.tsx`, `frontend/app/(workspace)/sales/orders/[orderId]/not-found.tsx`, `frontend/app/(workspace)/sales/orders/[orderId]/error.tsx`, `frontend/components/sales/sales-order-page.tsx`, `frontend/lib/sales/order-details.ts`, `frontend/lib/sales/order-details.test.mjs`, `frontend/lib/sales/order-list-api.ts`, `frontend/lib/sales/order-list-api.test.mjs`.

## Итерация v0.7.1-sales-order-status-workflow-history

- `[x]` `SalesOrder.status` принимает только последовательные переходы вперёд (с пропуском промежуточных стадий), отмену незавершённого заказа или повторное сохранение текущего значения; возврат назад и изменения финальных статусов отклоняются через `409`;
- `[x]` успешная смена статуса создаёт `LeadEvent` типа `order_status_changed`, а существующий `GET /orders/{order_id}/history` возвращает историю конвертации, создания и смены статуса после reload;
- `[x]` read-only карточка заказа загружает историю из backend и показывает её без demo fallback; добавлены backend и frontend focused-тесты;
- `[~]` товарные позиции, редактирование заказа, оплаты, документы, производство и склад остаются за пределами этой итерации.

Подтверждения: `backend/app/models/sales.py`, `backend/app/services/sales_order_status.py`, `backend/app/api/orders.py`, `backend/alembic/versions/a91d6e3f4b20_add_order_status_changed_event.py`, `backend/tests/test_lead_conversion.py`, `frontend/lib/sales/order-details.ts`, `frontend/lib/sales/order-details.test.mjs`, `frontend/app/(workspace)/sales/orders/[orderId]/page.tsx`, `frontend/components/sales/sales-order-page.tsx`.
## Итерация v0.6.1-navigation-remove-deals

- `[x]` активная CRM-навигация разделена на отдельные ссылки `Лиды` → `/sales/leads` и `Заказы покупателей` → `/sales/orders`;
- `[x]` пункт и ссылка `Сделки` удалены только из активной навигационной конфигурации, demo-страница `/sales/deals` не удалялась;
- `[x]` добавлен regression-тест навигации; TypeScript, ESLint, production build и `git diff --check` прошли.

Подтверждения: `frontend/lib/navigation.ts`, `frontend/lib/navigation.test.mjs`, `docs/tasks/v0.6.1-navigation-remove-deals.md`.

## Итерация v0.6.1-lead-creation

- `[x]` `POST /leads` использует существующие `Lead`, `LeadContact` и `LeadEvent`, всегда создаёт стадию `new`, один основной контакт и событие `lead_created` в общей транзакции;
- `[x]` отдельная `LeadCreate` не принимает result/completed/archive-состояния, проверяет обязательное имя, email, размеры и неотрицательные денежные значения; активный ответственный проверяется service-слоем;
- `[x]` список лидов открывает рабочую форму создания через Server Action, повторно проверяет недоверенный ввод и добавляет карточку только после ответа backend без successful fallback;
- `[x]` backend pytest — 32, frontend tests — 41, TypeScript, ESLint, production build, project check 9/9, OpenAPI, Alembic current/upgrade/check и HTTP-smoke — успешно; миграция не потребовалась;
- `[~]` интерактивный browser-smoke не выполнен: встроенная browser-среда не предоставила доступный backend; архивирование, восстановление и фильтрация архива остаются следующей отдельной подзадачей.

Подтверждения: `backend/app/schemas/sales.py`, `backend/app/services/lead_creation.py`, `backend/app/api/leads.py`, `backend/tests/test_lead_creation.py`, `frontend/app/(workspace)/sales/leads/lead-create-actions.ts`, `frontend/components/sales/lead-create-dialog.tsx`, `frontend/components/sales/lead-workspace.tsx`, `frontend/lib/sales/lead-create-api.ts`, `frontend/lib/sales/lead-creation.ts`, `frontend/lib/sales/lead-creation.test.mjs`.

## Итерация v0.6.1-lead-city-autocomplete

- `[x]` создан переиспользуемый `CityAutocomplete` для текущих и будущих форм без обязательного справочника и без изменения модели данных;
- `[x]` компонент подключён к созданию лида, профилю клиента и городу доставки коммерческой формы;
- `[x]` поиск начинается с двух символов, приоритет отдаётся совпадениям по началу названия, доступны мышь, ArrowUp/ArrowDown, Enter и Escape;
- `[x]` отсутствие совпадения не блокирует форму: введённый город остаётся обычной строкой и проходит существующий backend-контракт;
- `[x]` backend pytest — 32, frontend tests — 43, TypeScript, ESLint, production build, project check 9/9 и diff check прошли;
- `[~]` интерактивный browser-smoke недоступен; persistence пользовательских стадий, синхронизация карточки, финальные действия и расширенная drag-область остаются следующими частями патча.

## Итерация v0.6.1-lead-custom-stage-persistence

- `[x]` добавлена таблица `lead_stages` со стабильным строковым ID, названием, цветом, активностью, порядком и признаком системной стадии;
- `[x]` `Lead.status` расширен до строкового ID и остаётся единственным источником текущей рабочей стадии или финального `completed`;
- `[x]` `GET/PUT /lead-stages` и service-слой атомарно сохраняют конфигурацию и переводят лиды из отключаемых/удаляемых стадий;
- `[x]` Kanban загружает стадии вместе со списком на сервере и сохраняет custom-стадии через прежний `PATCH /leads/{lead_id}` без local successful fallback;
- `[x]` backend pytest — 34, frontend tests — 45, TypeScript, ESLint, production build, OpenAPI, Alembic upgrade/downgrade/upgrade/check и project check 9/9 прошли;
- `[~]` browser-smoke недоступен; подключение detail-карточки подтверждено следующей итерацией ниже.

Подтверждения: `backend/app/models/sales.py`, `backend/app/services/lead_stages.py`, `backend/app/api/lead_stages.py`, `backend/alembic/versions/e4b8a2c91d7f_add_persistent_lead_stages.py`, `backend/tests/test_lead_stages.py`, `frontend/lib/sales/lead-stage-api.ts`, `frontend/app/(workspace)/sales/leads/lead-stage-actions.ts`, `frontend/components/sales/lead-workspace.tsx`, `frontend/components/sales/lead-stage-settings-dialog.tsx`.

## Итерация v0.6.1-lead-detail-custom-stages

- `[x]` числовая detail-страница загружает `GET /lead-stages` параллельно с данными лида и показывает ошибку backend без local fallback;
- `[x]` custom status не преобразуется в `new`: стабильный ID сохраняется в `LeadDetails.stageId` и восстанавливается после reload;
- `[x]` dropdown и шкала карточки используют тот же активный список стадий и тот же `PATCH /leads/{lead_id}`, что и Kanban;
- `[x]` фиксированный allowlist пяти стадий удалён; demo-лиды остаются отдельным явно локальным контуром;
- `[x]` backend pytest — 34, frontend tests — 47, TypeScript, ESLint, production build и project check 9/9 прошли;
- `[~]` browser-smoke недоступен; финальные действия карточки и расширенная drag-область не входят в итерацию.

Подтверждения: `frontend/app/(workspace)/sales/leads/[leadId]/page.tsx`, `frontend/components/sales/lead-page.tsx`, `frontend/components/sales/lead-header.tsx`, `frontend/lib/sales/lead-details.ts`, `frontend/lib/sales/lead-detail-stage.ts`, `frontend/lib/sales/lead-detail-stage.test.mjs`.

## Итерация v0.6.1-lead-detail-final-actions

- `[x]` два финальных действия добавлены после активных рабочих стадий и хранятся отдельно от редактируемой конфигурации `LeadStage`;
- `[x]` «Оформить заказ» и «Закрыть с отказом» открывают существующий диалог сразу в нужном режиме и не используют обычный PATCH стадии;
- `[x]` подтверждённый backend-результат переводит detail-карточку в `completed`, показывает заказ со ссылкой либо сохранённую причину отказа; ошибка остаётся видимой в диалоге;
- `[x]` backend pytest — 34, frontend tests — 48, TypeScript, ESLint, production build и project check 9/9 прошли;
- `[~]` browser-smoke недоступен; расширение drag-области Kanban остаётся последним пунктом патча.

Подтверждения: `frontend/components/sales/lead-header.tsx`, `frontend/components/sales/lead-page.tsx`, `frontend/components/sales/lead-completion-dialog.tsx`, `frontend/app/(workspace)/sales/leads/[leadId]/lead-header-actions.ts`, `frontend/lib/sales/lead-details.ts`, `frontend/lib/sales/lead-final-actions.ts`, `frontend/lib/sales/lead-final-actions.test.mjs`.

## Итерация v0.6.1-kanban-full-card-drag

- `[x]` pointer drag активируется со всей свободной поверхности общей Kanban-карточки с прежним порогом 6 px;
- `[x]` кнопка завершения и служебные интерактивные потомки исключены из activator; заголовочная ссылка сохраняет обычный click и поддерживает drag после порога 6 px;
- `[x]` click по свободной области открывает `card.href`, но состоявшийся drag подавляет последующий click;
- `[x]` reusable-логика находится в общем `components/kanban`, без привязки к лидам;
- `[x]` backend pytest — 34, frontend tests — 50, TypeScript, ESLint, production build и project check 9/9 прошли;
- `[~]` browser-smoke недоступен; программно проверяемый объём UX-патча завершён.

Подтверждения: `frontend/components/kanban/kanban-board.tsx`, `frontend/components/kanban/kanban-card.tsx`, `frontend/components/kanban/kanban-interaction.ts`, `frontend/components/kanban/kanban-interaction.test.mjs`.

Подтверждения: `frontend/components/ui/city-autocomplete.tsx`, `frontend/lib/city-suggestions.ts`, `frontend/lib/sales/city-suggestions.test.mjs`, `frontend/components/sales/lead-create-dialog.tsx`, `frontend/components/sales/lead-customer-details.tsx`, `frontend/components/sales/lead-commercial-details.tsx`, `docs/tasks/patch-0.6-lead-ux-custom-stages.md`.

## Итерация v0.6.1-lead-duplicate-candidates

- `[x]` backend повторно использует существующие `Lead` и `LeadContact` как источники контактов, без новой таблицы, миграции или дублирующей CRM-модели;
- `[x]` `GET /leads/duplicate-candidates` возвращает `LeadRead` кандидатов по email и телефону, поддерживает `exclude_lead_id` и требует хотя бы один критерий поиска;
- `[x]` email сравнивается без учёта регистра, телефон нормализуется до цифр с приведением российского префикса `8` к `7`;
- `[x]` focused backend tests подтверждают совпадения по полям лида и контактам, отсутствие критериев и исключение текущего лида;
- `[x]` backend pytest — 36 и project check 9/9 с `PYTHONUTF8=1` прошли; миграция не потребовалась;
- `[~]` это read-only слой поиска кандидатов: создание лида не блокируется, frontend-предупреждение и слияние дублей остаются следующими подзадачами.

Подтверждения: `backend/app/services/lead_duplicates.py`, `backend/app/api/leads.py`, `backend/tests/test_lead_duplicates.py`.

## Итерация v0.6.1-lead-card-save-fix

- `[x]` существующий `PATCH /leads/{lead_id}` теперь принимает и возвращает полный набор редактируемых коммерческих полей карточки: направление, тип изделия, количество комплектов, размеры, предварительный бюджет, скидку, вероятность, плановую дату заказа, дату мероприятия, доставку, campaign, UTM и priority;
- `[x]` город доставки отделён от города клиента: `delivery_city` больше не перезаписывает `Lead.city`, а миграция заполняет новое поле из старого `city` только для совместимости существующих записей;
- `[x]` frontend Server Action отправляет полный snake_case payload, передаёт очистку через явные `null` и после успешного сохранения обновляет state только из ответа backend;
- `[x]` `responsible_id` поддержан в PATCH с backend-валидацией active `SalesUser`; UI числового лида больше не применяет demo-менеджеров как локально сохранённый backend-результат;
- `[x]` backend pytest — 37, frontend tests — 50, TypeScript, ESLint, production build, Alembic upgrade/check, project check 9/9 и `git diff --check` прошли;
- `[~]` полноценный frontend-список backend-пользователей для выбора ответственного не реализован; demo-лиды, задачи, заметки, сообщения и локальная timeline остаются вне этой итерации.

Подтверждения: `backend/app/models/sales.py`, `backend/app/schemas/sales.py`, `backend/app/api/leads.py`, `backend/alembic/versions/f2a7c4d8e901_add_lead_card_commercial_fields.py`, `backend/tests/test_lead_conversion.py`, `frontend/app/(workspace)/sales/leads/[leadId]/lead-commercial-actions.ts`, `frontend/app/(workspace)/sales/leads/[leadId]/lead-header-actions.ts`, `frontend/components/sales/lead-commercial-details.tsx`, `frontend/components/sales/lead-header.tsx`, `frontend/lib/sales/lead-commercial-api.ts`, `frontend/lib/sales/lead-commercial-api.test.mjs`, `frontend/lib/sales/lead-details.ts`, `docs/tasks/patch-0.6-lead-card-save-fix.md`.
