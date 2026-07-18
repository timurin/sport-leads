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
- `[x]` коммерческое ядро лида хранится в `Lead` через `Numeric`/`Decimal` и сохраняется существующим PATCH;
- `[x]` core-профиль клиента хранится в `Lead` и сохраняется числовой карточкой;
- `[~]` список `/sales/leads` загружает `GET /leads?limit=500` без скрытого fallback; ручной smoke с реальной PostgreSQL-записью ещё не зафиксирован;
- `[~]` явный идемпотентный dev-seed создаёт пять числовых лидов, контакты и коммерческие данные, но не является runtime-функцией и не запускается автоматически;
- `[~]` изменение статуса и перемещение Kanban работают только в состоянии frontend;
- `[~]` стадии Kanban настраиваются в `localStorage`, общего backend persistence нет;
- `[~]` convert/reject и завершение успешно/отказ подтверждены backend API, но действия списка остаются локальными;
- `[x]` backend выполняет транзакционную конвертацию `Lead → Client + SalesOrder` и защищает от повторной конвертации;
- `[~]` минимальный `SalesOrder` создаётся при конвертации; модели `Deal` нет;
- `[~]` frontend-аналитика лидов функциональна, но строится на demo-данных;
- `[~]` `lead-1`/`lead-2`, расширенные коммерческие поля, задачи, заметки, timeline, сообщения и коммуникации остаются demo/in-memory;
- `[ ]` создание и архивирование лида через рабочий frontend/API сценарий;
- `[ ]` постоянные настраиваемые стадии, Kanban persistence и полная история изменения статуса;
- `[ ]` frontend-сценарий постоянной конвертации/отказа из списка без повторного ввода;
- `[ ]` поиск и дедупликация лидов по телефону/email.

Подтверждения: `backend/app/models/sales.py`, `backend/app/schemas/sales.py`, `backend/app/api/leads.py`, `backend/app/services/lead_contacts.py`, `backend/app/services/lead_conversion.py`, `backend/tests/test_lead_contacts.py`, `backend/tests/test_lead_conversion.py`, `frontend/app/(workspace)/sales/leads`, `frontend/components/sales`, `frontend/lib/sales`, `frontend/lib/demo-data/sales.ts`.

## 2. Сделки и заказы покупателей

- `[ ]` модель и API `Deal`;
- `[~]` Kanban сделок существует только во frontend на demo-данных;
- `[x]` минимальные модели `Client` и `SalesOrder` создаются транзакционной конвертацией лида;
- `[x]` `SalesOrder` связан с исходным лидом и клиентом и доступен через read API;
- `[~]` frontend заказов существует, но использует demo-данные и не сохраняет изменения;
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

## Когда просить переключение модели

Codex должен остановиться и попросить владельца вручную выбрать более сильную модель до реализации архитектуры, безопасности, RBAC, сложных миграций, изоляции организаций, финансов, склада, себестоимости или изменений нескольких бизнес-модулей.

Для CRUD, документации, UI, тестов и реализации уже утвержденной архитектуры используется экономичная модель.

После двух неудачных обоснованных попыток исправления одной ошибки Codex прекращает догадки и просит переключить модель.

## Следующая рекомендуемая итерация

После завершения и ручной проверки текущей `v0.6.1-lead-list-backend-load` — сохранить изменение статуса/перемещение лида в Kanban через существующий backend-контур, не меняя дизайн и не переходя к следующему этапу. Перед реализацией проверить, является ли это расширением утверждённой архитектуры или требует model escalation.

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

## Критерий завершения текущего этапа

Менеджер создаёт лид, редактирует его основные данные и контакты, меняет статус в Kanban, завершает лид успешно или отказом и после перезагрузки видит состояние из PostgreSQL; конвертация создаёт постоянный коммерческий результат без повторного ввода, а dashboard использует фактические данные.
