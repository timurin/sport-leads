# ARCH-04E — Группы доступа и множественное членство (Codex)

## Источники истины
- `docs/architecture/unified-employee-access-navigation-arch-04d.md` — утверждённый проектный контракт ARCH-04D.
- `docs/architecture/decisions/ADR-036-employee-platform-user-link.md` и `docs/architecture/employee-user-link-arch-04a.md`.
- Текущий код RBAC, API, миграции, тесты и `AGENTS.md`. При противоречии или неутверждённом изменении модели доступа — остановиться и описать решение, не внедрять молча.

## Цель
Реализовать backend групп доступа на основе существующего `Role` с возможностью назначать **несколько групп одной учётной записи**, без дублирования сотрудников, пользователей и прав. Кадровая категория/должность не назначает права автоматически.

## Объём
1. Аудитировать фактическую схему `PlatformUser`–`Role`–permissions, существующие проверки авторизации и контракты API. Опираясь на ARCH-04D, добавить минимальную M:N связь пользователей с группами (Role) и обратимую миграцию. Не создавать параллельный движок RBAC.
2. Определить эффективные разрешения как **объединение** разрешений назначенных групп (аддитивная модель, без deny/индивидуальных исключений в этой итерации). Сохранить роль/доступ существующих пользователей, особенно `admin`, при upgrade, в период совместимости и при downgrade. Если автоматическое сохранение невозможно безопасно — остановиться с отчётом о блокере.
3. Реализовать/адаптировать защищённые API: список и CRUD групп, чтение матрицы доступных разрешений из реально существующих backend permissions, управление составом групп пользователя, чтение эффективных прав. Конкретные маршруты и формы ответов — по контракту ARCH-04D; не вводить новые разрешения только для UI.
4. Проверки администраторских действий **на сервере**: запрет неавторизованного чтения/изменения, защита от лишения последнего действующего администратора доступа, валидация несуществующих IDs, конфликтов и повторных назначений. Ошибки 403/404/409 должны быть однозначны для UI.
5. Не менять `Employee`/связь ARCH-04A, пароли, производственные факты, историю и существующий вход в систему. Не выполнять автоматический backfill `employee_id`.
6. Добавить тесты upgrade/downgrade, старого и нового RBAC, объединения прав 2+ групп, существующего `admin`, API авторизации, конфликтов и совместимости старых клиентов. Обновить canonical data-flow / project memory и HTML twin **только если действительно затронуты**.

## Проверки и итог
- `python scripts/check_project.py` — 10/10; `git diff --check`; тесты миграции upgrade/downgrade; regression действующих логинов и RBAC.
- Краткий отчёт: файлы, миграция, API для ARCH-04F, гарантии совместимости, тесты, оставшиеся ограничения.
- **Без commit, push, deploy**. Не изменять ARCH-04B / frontend и не захватывать посторонний WIP.
- NAV-04 остаётся локальным контрактом ARCH-04; глобально в `AGENTS.md` не закреплять до E2E и утверждения владельцем.

## Реализация ARCH-04E — 2026-10-21

Выбран явно назначенный backend ARCH-04E после утверждённого ARCH-04D.
Перед реализацией подтверждено: M:N пользователей/Role и Role/Permission уже
существует. Поэтому join tables не дублировались. Необходимая обратимая миграция
`arch04e_20261021` (parent `arch04a_20261021`) добавляет только Role.version
default1 для concurrency; никакого переноса/сброса ролей, memberships или прав.

### Результат и контракт

- Пользовательские группы на Role с is_system=false; code уникален и неизменяем,
  system/MVP role codes read-only. Категории/должности Employee не дают прав.
- Effective permissions = union всех Role.permissions. Без deny и индивидуальных
  overrides, без новых permission codes для UI, без параллельного RBAC.
- GET `/permissions` — полный настоящий каталог, в том числе неназначенные права.
  GET `/roles` совместимо расширен version/member_count; detail/create/preview/
  update/delete используют тот же Role. Чтение групп больше не вызывает seed.
- Shared группы и полный membership имеют read-only preview, revision и
  actor/target/body fingerprint; apply повторяет проверку под transaction lock,
  stale409. Отдельны group permission delta и фактический overlap-aware effective
  delta; impact — число всех members, без раскрытия HR данных в list.
- Все API защищены существующим admin.roles.assign. Неактивный/неподтверждённый/
  restricted инициатор не получает management через новую форму.
- Общая PostgreSQL advisory transaction lock сериализует seed/legacy/new writes.
  Защита последнего действующего admin и self-lockout применяется также к старым
  assign/revoke и существующему profile is_active PATCH. Новая запись active flags
  или смена пароля/сессий автоматически не выполняется.
- Системные role sets и admin не переопределены; seed оставляет custom groups
  нетронутыми. Назначенную группу нельзя удалить каскадно. Legacy endpoints и
  ответы сохранены; повторное assignment/removal — no-op без лишнего audit.
- Новые mutations и canonical AuditEvent before/after/reason/actor/impact
  атомарны; audit failure откатывает изменение. Unknown/inaccessible/stale cases
  имеют 401/403/404/409/422 по описанным API-контрактам.

API, payloads и данные для ARCH-04F:
[access-groups-arch-04e.md](../architecture/access-groups-arch-04e.md).
Legacy POST/DELETE ролей сохранены; новые protected GET/preview/PUT полного
membership и effective-permissions не меняют `/auth/me` JSON shape.

### Файлы этой итерации

Новые: `backend/app/api/access_groups.py`, `schemas/access_groups.py`,
`services/access_groups.py`, `services/rbac_guard.py`,
`alembic/versions/arch04e_20261021_access_group_version.py`,
`tests/test_access_groups_arch_04e.py`, `tests/test_access_groups_postgres_arch_04e.py`.
Изменены: `models/rbac.py`, `schemas/rbac.py`, `services/rbac.py`, `services/auth.py`,
`api/platform_users_rbac.py` (точечные hunks поверх сохранённого ARCH-04A), `main.py`.
Документы: этот task, новый API-contract, pointer в ARCH-04D, PM-SOT,
DF-ACCESS-GROUPS + HTML twin; генератор знает новый DF ID.

Frontend/ARCH-04B, Employee model/link/password logic, payroll/production/ledger/
historical author IDs не менялись. Существующий посторонний WIP сохранён.

### Проверки и сохранность

20 новых тестов ARCH-04E passed: 19 в основном целевом наборе + дополнительная
PostgreSQL compatibility regression. 29 focused с выбранными auth/RBAC/sewing-access
прошли до дополнительной проверки, затем она прошла отдельно на том же runtime.
Проверены 2+ группы/перекрытие, полный catalog, CRUD/seed/system guards,
read/write401/403/404/409/422, повторные legacy assignments, формы старых ответов,
stale/altered preview, self/last-admin/restricted transition и profile guard.
Read-only preview, audit rollback, bounded query budget и неизменность
Employee mapping/profile/password/production ledger/historical audit проверены.

PostgreSQL только localhost:5432, UUID-owned schemas:
две пары upgrade/downgrade сохраняют accounts, Employee, роли (system+custom),
permission sets, assignments и audit. Прежние RBAC joins после downgrade читают
оба типа групп. Concurrent shared-group apply — один winner/один stale conflict/
один audit. Concurrent legacy взаимное снятие admin — один apply/один отказ;
минимум один действующий admin сохранён. Прямой SQL вне writers не объявляется
защищённым новой service policy.

Дополнительная compatibility regression проверяет stale ORM cache старого
assignment writer после изменения общей группы другой транзакцией: возвращаются
свежие effective permissions. Проверка прошла, runtime-fix не потребовался.

Итоговый `python scripts/check_project.py`: **PROJECT CHECK PASSED, 10/10**,
exit code 0; 1097 backend / 506 frontend tests passed, lint/tsc/build,
OpenAPI/Alembic/Compose успешны. Один полный прогон после стабилизации runtime;
лог `logs/arch-04e-project-check.log` (ignored). Дополнительная PG regression
добавлена/запущена после сбора полного набора: текущий suite содержит на один
тест больше; результат полного прогона не переименован в 1098. После старта
полного check runtime не менялся. `git diff --check`, links/whitespace новых
документов и HTML twin check успешны.

Локальная основная схема upgraded до arch04e_20261021 после проверки host/port;
Alembic check: No new upgrade operations detected. Production/tunnel:5433 не
использовались; реальные group/membership изменения не запускались.

Project memory updated: PM-SOT. Data-flow updated: DF-ACCESS-GROUPS.
HTML twin synced, generator --check: 16 flows. Roadmap: changes not required.
Project structure checklist: changes not required. ERP-check: changes not required.
Их MD/HTML diff отсутствует. Production invariant matrix не затронута; новые
access guards и доказательства описаны в соответствующем DF/API contract.
NAV-04 не объявлен глобальным; AGENTS.md, UI rules и shell не редактировались.

Ограничения: revision намеренно глобален для RBAC и может отклонить preview
после несвязанной access mutation; system roles immutable; assigned group delete
запрещён; group permission edit и role-code rename не одно и то же. Полный состав
в PUT требует сохранения остальных выбранных memberships. Frontend/E2E — ARCH-04F,
не заявлены готовыми. Owner review ожидается; следующая итерация — ARCH-04F по
backend contract, автоматически не начата. Commit/push/deploy не выполнялись.
Статус: backend ARCH-04E выполнен, owner review pending. Новых P0/P1 не выявлено;
остальные P2/P3 вне выбранной задачи не исследовались и не исправлялись.
