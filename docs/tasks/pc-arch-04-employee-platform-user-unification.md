# ARCH-04 — Employee ↔ PlatformUser: единый человек, отдельно доступ (Codex: архитектура сначала)

## Постановка
Владелец считает Employee и PlatformUser двумя представлениями одного сотрудника: HR-карточка человека vs учётная запись, роли и доступы. В сообщении упомянуты «категории», но их конкретная классификация пока не указана — НЕ изобретать её и не кодировать enum заранее.

## Существующие контракты
`docs/tasks/v1.00-stage-2.4.2-employees.md` закрепляет Employee как HR SoT и **явно откладывает** связь `platform_user_id`; `PlatformUser` — отдельный auth/RBAC SoT. `docs/tasks/v1.00-stage-21.1-users-cabinet.md`, ADR-023, ADR-026, ADR-029; работа швей и аудит ссылаются на `platform_user_id`. Не переписывать первичные ключи, ledger, authorship и RBAC.

## Предложение для архитектурного решения (без миграции/кода)
- `Employee`: один человек, ФИО/контакты/организация/должность/подразделение/трудовой статус, общие категории сотрудника по утверждённому бизнес-списку.
- `PlatformUser`: опциональный аккаунт для входа; идентификаторы авторства, роли/permissions, логин, состояние доступа; сотрудник может не иметь доступа, но пользователь без employee mapping считается legacy/служебным исключением до сверки.
- Кандидат: nullable UNIQUE `platform_users.employee_id` или обратный FK (выбрать после анализа существующих ссылок/жизненного цикла), модель связи 0..1 и необратимые операции защиты; не создавать два независимых человека.
- Отдельно сравнить «категория сотрудника» (HR/производство) и «роль пользователя» (RBAC): не отождествлять. Политика множественных организаций, увольнения/блокировки доступа, реактивации, legacy users, service accounts, invitation, возможных дублей — оформить решением владельца.

## Deliverable
Короткий ADR: фактическая карта таблиц/API/UI и ссылок на users/employees/sewing/tasks/audit; безопасная схема связи, миграция/backfill только с достоверным match и без автообъединения по ФИО; единый UX создания Employee → «Предоставить доступ» (опционально); категории — pending owner classification; этапы внедрения, rollback, regression checklist. Никаких runtime/DB изменений в этой задаче. `PROJECT CHECK` только если меняются документы/генераторные twins.

## Результат ARCH-04 — 2026-10-21

Подготовлен [ADR-036 — Employee: человек; PlatformUser: опциональный доступ](../architecture/decisions/ADR-036-employee-platform-user-link.md).
Статус ADR: **предложено, ожидает решения владельца**; это не принятое изменение
контрактов Employee/Users MVP и не разрешение начать внедрение.

Выбран явно назначенный ARCH-04: архитектура до кода. Изменены только этот task
и новый ADR. Модели, API, UI, RBAC, auth, миграции, ledger, авторство и данные
не изменялись. Production DB не читалась и не изменялась.

### Фактическая основа

- Проверены исходные контракты 2.4.2/21.1, ADR-023/026/029 и модели/API/UI
  Employee, PlatformUser, auth sessions, RBAC/stage access, sewing ledger,
  WorkTask/collaboration, TechnicalCard и AuditEvent.
- Ключи пошива, авторов, исполнителей, адресатов и аудита уже PlatformUser;
  смена PK или замена actor FK на Employee разрушила бы существующий контракт.
- Выявленная зависимость: `ensure_sales_user_link` подбирает CRM SalesUser по
  имени. Это существующая совместимость, не доказательство Employee identity;
  в новый matching/backfill этот алгоритм не переносится.
- HR archive и access block сейчас независимы. Session resolution проверяет
  PlatformUser.is_active, но profile PATCH не отзывает все сессии. ADR явно
  разделяет текущее поведение и предлагаемую будущую offboarding-команду.
- Invite helper commit-ит account/CRM/roles внутри сервиса; это не готовая
  атомарная операция account+employee mapping. Требуется отдельная реализация,
  а не вызов старого invite с дописыванием FK после commit.

### Предложение и границы решения

Nullable UNIQUE `platform_users.employee_id → employees.id`, ON DELETE RESTRICT,
без второго FK. Employee существует без аккаунта; PlatformUser сохраняет все
существующие ID/actors/RBAC и nullable legacy/service exceptions до сверки.
Сравнён обратный FK; причина выбора и предел 0..1 изложены в ADR.

HR-поля принадлежат Employee, доступ — PlatformUser; категории не равны ролям.
Ни enum категорий, ни фиктивные HR-записи не создаются. Предложены единый UX
Employee → необязательное «Предоставить доступ», привилегированная явная link/grant
операция, batch display и переходная совместимость существующих users URL.

Владельцу оставлены решения о категориях, нескольких организациях/employment,
offboarding/reactivation, legacy/service accounts, invitation/контактах/HR ACL,
дублях и исправлении ошибочной связи. Они блокируют только соответствующее
внедрение; подготовка архитектурного результата выполнена без выдуманных политик.

Описаны отдельные будущие этапы: утверждение → additive DDL без backfill →
owner-verified mapping manifest/dry-run/atomic apply → commands/DTO → UX →
отдельный cleanup. Backfill по ФИО/email/телефону/login/SalesUser имени запрещён;
без доказательства пара остаётся unmapped. Rollback сохраняет mapping evidence
и audit, не удаляет аккаунты и не переписывает накопленные факты.
Regression checklist включает гонки/UNIQUE, auth/ACL/sessions, sewing/tasks/CRM/
audit, production preservation, upgrade/downgrade и batch/read/reload.

### Проверки и статус документов

`python scripts/check_project.py`: **PROJECT CHECK PASSED, 10/10**, exit code 0;
1063 backend / 500 frontend tests passed, lint/tsc/build, OpenAPI/Alembic/Compose
успешны. Один полный прогон; лог `logs/arch-04-project-check.log` (ignored).
Ссылки обоих новых Markdown проверены: missing links=0, trailing whitespace=0;
`git diff --check` успешен. Новых runtime regression tests не добавлялось:
здесь поставлен checklist будущей реализации, а не реализована связь.

Project memory: no changes required — подтверждённый runtime не изменился,
предложение не объявлено действующим SoT.
Data-flow: no changes required — persistence/consumers/формулы не менялись.
Roadmap: changes not required. Project structure checklist: changes not required.
ERP-check: changes not required. Их MD/HTML diff отсутствует; HTML twins не
затронуты. ADR не требует HTML twin. Production invariant guards не менялись.

P0/P1 runtime-изменений нет; архитектурные риски и решения владельца перечислены
в ADR. P2/P3 вне этой задачи не исследовались. Следующая рекомендуемая итерация:
review ADR владельцем и фиксация политик, затем отдельная реализационная задача;
автоматический переход к ней не выполняется. Commit/push/deploy не выполнялись.
