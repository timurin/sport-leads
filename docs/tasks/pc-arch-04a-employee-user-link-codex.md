# ARCH-04A — Employee ↔ PlatformUser: backend link

**Исполнитель:** Codex
**Источники истины:** `AGENTS.md`, `docs/architecture/decisions/ADR-036-employee-platform-user-link.md`, существующие модели/сервисы Employee, PlatformUser, RBAC. Сначала прочитать ADR и сверить его статус. При противоречии ADR или отсутствии одобрения на runtime-изменения — **остановиться на отчёте, миграцию не выполнять**.

## Цель
Безопасно добавить опциональную связь одной учётной записи платформы с одной карточкой сотрудника, без объединения сущностей и без изменения прав доступа или истории.

## Объём
1. После проверки утверждения ADR добавить `platform_users.employee_id` как nullable FK на `employees.id` с UNIQUE, индексами согласно принятой конвенции и обратимой Alembic-миграцией. Существующие записи оставлять с NULL, **без автоматического backfill**.
2. Добавить backend read/write связь в существующие схемы/сервисы/API по принятым контрактам; не создавать новые дублирующие справочники, не менять endpoint авторизации и текущие права доступа.
3. При привязке проверять существование сотрудника, уникальность связи и права инициатора. Дубликаты, несуществующий ID и конфликты обрабатывать предсказуемо, без 500. При отвязке исторические данные сохранять.
4. Покрыть регрессиями создание сотрудника без пользователя, создание пользователя без сотрудника, привязку, отвязку, конфликт двух пользователей на одного сотрудника, существующие RBAC/auth и откат миграции.
5. Обновить только затронутую документацию/контракты; другие незавершённые изменения не включать.

## Вне объёма
- Автоматическое сопоставление по ФИО, email или телефону; перенос/склейка записей.
- Редактор категорий, изменения оргструктуры, UX карточки, массовый backfill.
- Изменения производственной истории, ledger, author IDs, ACL/RBAC, активных пользователей.
- Commit, push, deploy — до отдельной приёмки.

## Проверки и результат
- Alembic upgrade/downgrade/check на тестовой БД; сохранность существующих записей.
- Целевые тесты + `python scripts/check_project.py` (10/10) + `git diff --check`.
- В ответе: кратко перечислить изменённые файлы, migration ID, сценарии тестов, границы совместимости, открытые вопросы и данные для ARCH-04B Cursor.

**Принцип категорий:** на данном этапе не задавать жёсткие категории в enum или миграциях. Политики категорий и жизненного цикла — отдельное решение владельца/следующая итерация, если ADR ещё не утверждён.

## Предварительная проверка — 2026-10-21

**Историческая запись:** блокер ниже снят последующим явным утверждением владельца;
актуальный результат реализации приведён в следующем разделе.

Статус: **остановлено до утверждения runtime-объёма ADR-036**.

Проверены task → project memory → ADR-036 и git status/branch (`main`).
В ADR фактически остаётся: «предложено, ожидает решения владельца».
Предыдущая ARCH-04 подготовила предложение, не утвердила его. В текущем
поручении нет отдельного утверждения ADR, а этот task явно требует сначала
проверить утверждение и при его отсутствии остановиться на отчёте.

Для продолжения нужно явное подтверждение владельца схемы nullable UNIQUE
`platform_users.employee_id → employees.id`, ON DELETE RESTRICT, и разрешение
реализовать ограниченный backend-объём ARCH-04A без backfill/изменений доступа.
При согласовании необходимо уточнить границу отвязки: ADR предлагает отдельное
аудируемое исправление mapping, а task требует backend-привязку/отвязку;
обычный profile PATCH не должен молча переназначать человека.
Категории и offboarding остаются за пределами этой реализации.

Изменён только этот task (отчёт о входной проверке). Существующие untracked
ADR-036 и ARCH-04 сохранены. Runtime/модели/схемы/API/UI и БД не изменялись;
миграция не создавалась и не запускалась, migration ID отсутствует.
Тесты и project check не запускались: реализация остановлена на обязательном
входном условии; результат 10/10 для ARCH-04A не заявляется.

Project memory: no changes required. Data-flow: no changes required.
Roadmap: changes not required. Project structure checklist: changes not required.
ERP-check: changes not required. HTML twins не затронуты.
Commit/push/deploy не выполнялись. ARCH-04A не закрыта; передача готового API
для ARCH-04B невозможна до реализации. Следующий шаг — подтверждение владельца.

## Реализация после утверждения владельца — 2026-10-21

Владелец явно утвердил ADR-036 для ARCH-04A: nullable UNIQUE FK, явные
аудируемые привязка/отвязка, обратимая миграция/API/регрессии. Backfill,
изменения RBAC/паролей/доступа/производственной истории запрещены;
commit/push/deploy не разрешены. ADR переведён в «Принято» именно в этом объёме;
категории/offboarding/широкий UX остаются отдельными решениями.

### Результат и API

- PlatformUser.employee_id nullable FK → Employee.id, UNIQUE, ON DELETE RESTRICT.
  PK и ссылки ledger/tasks/authorship/RBAC не менялись; обратного хранимого FK нет.
- Миграция `arch04a_20261021` (parent `j6k7l8m9n013`), upgrade/downgrade без
  backfill. UNIQUE создаёт поддерживающий btree, без дублирующего индекса.
- GET `/platform-users/{id}/employee-link`; POST того же path с employee_id/reason;
  отдельный POST `/platform-users/{id}/employee-unlink` с expected_employee_id/reason.
  Права — существующее admin.roles.assign, проверка в API и сервисе, без новых seed.
- Повтор той же пары/уже отвязанного аккаунта идемпотентен; занятая сторона,
  неявная замена и stale unlink → 409; отсутствие объекта → 404; 401/403/422
  для доступа/валидации. Непустая причина обязательна, лишние поля запрещены.
- Account + Employee row locks, DB UNIQUE и единая транзакция mapping/audit.
  Канонические employee_linked/unlinked AuditEvent содержат session actor,
  before/after employee ID и reason. Ошибка audit откатывает mapping; no-op без
  дублирующего audit. Отвязка не блокирует вход и не удаляет человека/аккаунт.
- Admin list `/platform-users` расширен employee_id как скаляром без per-row SQL.
  Public Employee и `/auth/*` DTO/endpoint не изменены; профиль не синхронизируется.

Передача ARCH-04B: [backend contract](../architecture/employee-user-link-arch-04a.md).
Документ содержит payloads, idempotency/expected ID/409, read permission,
refresh/cache рекомендации и пределы существующего invite. Frontend не изменялся.

### Файлы

Runtime: `backend/app/models/auth.py`, `schemas/rbac.py`, новый
`schemas/employee_user_link.py`, `services/employee_user_link.py`, существующий
`api/platform_users_rbac.py`. Migration:
`backend/alembic/versions/arch04a_20261021_platform_user_employee_link.py`.
Тесты: `test_employee_user_link_arch_04a.py`,
`test_employee_user_link_postgres_arch_04a.py`.
Документы: ADR-036, новый `employee-user-link-arch-04a.md`, этот task,
PM-SOT, DF-EMPLOYEE-USER + HTML twin; генератор дополнен новым ID цепочки.
Предшествующий untracked ARCH-04 task сохранён, в эту реализацию не переписывался.

### Проверки и сохранность

23 focused tests passed: 15 новых случаев + существующие auth/RBAC/sewing-access.
Включены independent Employee/account creation; link/unlink/reload/admin list;
not-found/permission/validation/conflicts/stale unlink/idempotency; audit payload
и rollback при инъекции ошибки; пароли/профиль/roles/permissions/сессии/auth contract
не меняются; raw UNIQUE/RESTRICT; history actors и защищённые production rows.

Изолированный PostgreSQL localhost:5432, UUID-owned schemas: два цикла
upgrade/downgrade сохраняют исходные значения всех account/Employee/audit строк,
все существующие mapping NULL, actual migrated UNIQUE/FK/delete RESTRICT работают;
Alembic compare_metadata соответствует модели. Реальный concurrent link двух
аккаунтов на одного Employee даёт одного победителя/один 409/один audit event.
Схемы создаются и удаляются только тестами, production/tunnel:5433 исключены.

Дополнительная проверка migrated UNIQUE/FK/delete-RESTRICT после уточнения теста:
2 PostgreSQL tests passed. Изменений runtime после запуска полного check нет.

Итоговый `python scripts/check_project.py`: **PROJECT CHECK PASSED, 10/10**,
exit code 0; 1078 backend / 500 frontend tests passed, lint/tsc/build,
OpenAPI/Alembic/Compose успешны. Один полный прогон после стабилизации runtime;
лог `logs/arch-04a-project-check.log` (ignored). `git diff --check` успешен,
Markdown links/whitespace проверены с учётом исходных Markdown hard breaks;
HTML twin check успешен. ARCH-04A backend выполнена, owner review pending.

Локальная основная БД также upgraded to arch04a_20261021; `alembic check` —
No new upgrade operations detected. Host/port проверены до запуска: только
localhost:5432. После upgrade 2 существующих аккаунта / 0 связанных; реальных
привязок, backfill, смены доступа или production apply не выполнялось.
Первый выбранный revision ID оказался занят исторической миграцией; Alembic
остановился до DDL. ID заменён на уникальный arch04a_20261021, граф с одним head
и успешный upgrade/check перепроверены. Это исправленный code/config failure,
не замаскированный пропуск миграции.

Project memory updated: PM-SOT. Data-flow updated: DF-EMPLOYEE-USER.
HTML twin synced; `generate_data_flow.py --check`: 15 flows.
Roadmap: changes not required. Project structure checklist: changes not required.
ERP-check: changes not required. Их MD/HTML diff отсутствует; старые milestones
2.4.2/21 остаются историей MVP, новое состояние описано ADR/PM/DF.
Production invariant guards не менялись; UI/shell и визуальные контракты не тронуты.

Остаток: owner review кода/миграции/результатов; затем отдельная ARCH-04B Cursor
по backend contract. Категории, HR-edit unification, offboarding и atomic grant
не включены. Новых P0/P1 не выявлено; P2/P3 вне задачи не исследовались.
Commit/push/deploy не выполнялись. Автоматического начала ARCH-04B нет.
