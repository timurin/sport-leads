# ADR-036 — Employee: человек; PlatformUser: опциональный доступ

**Статус:** Принято владельцем 2026-10-21 для реализации ARCH-04A.
**Дата:** 2026-10-21.
Одобрены nullable UNIQUE FK, явные аудируемые привязка/отвязка, обратимая миграция,
API и регрессии. Автоматический backfill, изменение RBAC/паролей/доступа и
производственной истории запрещены. Категории, offboarding и HR-first UX остаются
отдельными решениями/задачами; их предложения ниже не считаются утверждёнными.
**Задача:** [ARCH-04](../../tasks/pc-arch-04-employee-platform-user-unification.md).
Связь внедряется отдельной задачей ARCH-04A в указанном ограниченном объёме.

## Контекст и фактическая карта до ARCH-04A

[Employee MVP](../../tasks/v1.00-stage-2.4.2-employees.md) явно отложил auth-связь;
[Users cabinet](../../tasks/v1.00-stage-21.1-users-cabinet.md) оставил HR отдельно.
[ADR-023](ADR-023-authentication-session.md),
[ADR-026](ADR-026-internal-collaboration-order-chat.md) и
[ADR-029](ADR-029-sewing-cabinet-work-ledger.md) закрепляют аккаунт как actor.
[ADR-028](ADR-028-unified-work-tasks.md) описывает текущий WorkTask-контур.
Объединение человека не означает замену этих идентификаторов.

| Контур сегодня | Таблицы и ссылки | API / UI; исходники |
|---|---|---|
| HR | `employees`: full_name, contacts, organization_id NOT NULL → organizations RESTRICT, position, department (текст), employment_date, is_active. Связи с аккаунтом/категорий нет | GET/POST `/employees`, GET/PATCH `/employees/{id}`; list active_only=true по умолчанию, без DELETE. `/settings/organizations/employees` и `/[employeeId]`; `models/sales.py`, `api/employees.py`, `services/employees.py`, `employees-workspace.tsx`, `employee-card.tsx` |
| Аккаунт | `platform_users`: login UNIQUE, password_hash, display_name, contacts, department/position, manager_platform_user_id SET NULL, language, invite_status, is_active; Employee FK отсутствует | GET `/platform-users`, POST `/platform-users/invite`, PATCH `/{id}`, POST `/{id}/set-password`, role assignment APIs; `/settings/users`, `platform-users-workspace.tsx`; `models/auth.py`, `api/platform_users_rbac.py`, `services/auth.py` |
| Вход и права | `auth_sessions.platform_user_id` CASCADE; `platform_user_roles` CASCADE → roles → permissions; `platform_user_stage_access` CASCADE → production_stages | `/auth/login`, `/auth/me`, `/auth/logout`; существующие RBAC/stage-executor guards. Кабинет пользователей требует `admin.roles.assign` |
| CRM | `platform_users.sales_user_id` SET NULL → `sales_users`; CRM responsible остаётся SalesUser | `ensure_sales_user_link` в `services/auth.py` может подобрать SalesUser **по имени**. Это не доказательство HR-identity и не алгоритм нового backfill |
| Пошив | `sewing_work_ledger_entries.platform_user_id` RESTRICT; identity швеи и цена/количество/факт ledger остаются прежними | `/sewing-cabinet`, `/queue`, `/sewers`, `/users/{platform_user_id}`, take/complete/release; UI `/production/sewing-cabinet`, `/sewers`, `/[platformUserId]`; `models/sewing_work_ledger.py`, `api/sewing_cabinet.py` |
| Задачи/сообщения | `work_tasks` creator/responsible/executor → PlatformUser SET NULL; `work_task_messages.author_platform_user_id` RESTRICT. Collaboration message author, microtask assignee/creator RESTRICT; mentions/notification recipient CASCADE; notification actor SET NULL | `/work-tasks`, order/lead/standalone collaboration, `/collaboration/mention-candidates`; `models/work_tasks.py`, `models/collaboration.py`, соответствующие API; `work-tasks-workspace.tsx` |
| ТК/аудит | `technical_cards.created_by_platform_user_id` и responsible SET NULL; `audit_events.actor_platform_user_id` SET NULL + actor_login snapshot | Card APIs и `/audit-events` (audit.read); `models/technical_card.py`, `models/audit.py`, `services/audit.py`. Не переписывать authorship/history |

Карта проверена по указанным файлам, не по production DB. Существующий HR API
не содержит permission dependency; выдачу доступа нельзя наследовать от него.
`Employee.is_active` сегодня архивирует HR-запись независимо от аккаунта.
`PlatformUser.is_active=false` блокирует login/session resolution; текущий PATCH
не гарантирует отзыв всех session rows — после реактивации непросроченная сессия
может снова разрешиться. Это существенная граница будущего offboarding.
Invite сейчас создаёт аккаунт/CRM-link/роли и commit внутри auth service;
первый успешный auth переводит invited/pending в active. Это не email invitation
и не готовая атомарная операция Employee → access.

## Принятая связь ARCH-04A

Добавляется отдельной обратимой миграцией nullable UNIQUE
`platform_users.employee_id → employees.id`, `ON DELETE RESTRICT`, без обратного
хранимого FK. У Employee 0..1 аккаунт, у аккаунта 0..1 Employee; UNIQUE запрещает
два аккаунта для одного Employee. Nullable нужен для legacy/служебных исключений
и совместимого rollout; не означает одобрения новых немаркированных исключений.

FK на стороне доступа выбран потому, что человек существует до выдачи доступа;
создание HR не должно требовать auth/RBAC. Обратный Employee.platform_user_id
технически возможен, но сделал бы аккаунт ссылочной целью HR и потребовал бы
дополнительной политики удаления. Два FK или ещё одна Person-таблица не нужны
для выбранной модели. Если владелец требует несколько аккаунтов/одновременных
employment в разных организациях, cardinality пересматривается **до** миграции.

| Данные после внедрения | Владелец и правило |
|---|---|
| ФИО, кадровые контакты, организация, должность, подразделение, employment state | Employee — единственный HR SoT. Для связанного человека UI читает их через Employee, не из редактируемой копии профиля |
| Login/hash, roles/permissions, stage access, sessions, invite/access status, language | PlatformUser; ни должность, ни HR-категория не дают permissions |
| Старые display_name/email/phone/department/position аккаунта | Сохранить на переходе для совместимости и unmapped users. Ввод связанных HR-полей направлять в Employee с HR-правом, не делать двустороннюю синхронизацию. Auth-контакты отдельно согласовать с владельцем; не терять старые значения |
| manager_platform_user_id, sales_user_id | Существующие отношения аккаунта/CRM. Не превращать автоматически в HR-руководителя/HR-identity |
| Категории сотрудника | **Pending owner classification**: нет списка, cardinality, enum, таблицы или автоматической роли. Даже будущая категория «швея» не заменяет RBAC кабинета |

Ни PlatformUser.id, ни Employee.id, ни существующие ledger/task/audit/role FK
не меняются. Историческое авторство продолжает означать аккаунт совершившего
действие; текущее HR-имя — дополнительное отображение, не перепись истории.

Связь создаётся явной привилегированной операцией с проверенными двумя ID,
блокировкой обеих строк, UNIQUE и audit actor/reason/before/after в одной
транзакции. Повтор той же пары идемпотентен; занятая сторона — конфликт, без
«перенести автоматически». Переназначение/отвязка не являются обычным PATCH:
только отдельное исправление подтверждённой ошибки с сохранением старой пары
в аудите и ревизией зависимостей. Hard-delete человека/аккаунта не включать в UX;
FK RESTRICT и сервисные guards сохраняют identity/history. Категории, mapping
и HR-архив не повышают права и не запускают replan/изменение production fact.

## Предлагаемый UX и доступ

Одна HR-карточка: создать Employee → сохранить → необязательное
«Предоставить доступ». Для уже связанного сотрудника показать существующий
аккаунт и его состояние, а не второй create. Можно явно выбрать существующий
аккаунт после сверки или пригласить новый. Для существующих пользователей —
отдельная сверка с Employee, без автоматического создания HR-записей на login.

HR-save не создаёт аккаунт. Выдача доступа — отдельная атомарная операция
account+link+approved roles+audit; при ошибке откатить её целиком, сохранив ранее
созданного Employee. Auth invite helper с внутренним commit потребуется
адаптировать отдельной задачей. После успешного commit обновить обе карточки,
списки и открытые pickers; list embeds делать batch, не per-row fetch.

Использовать текущую границу `admin.roles.assign` для выдачи доступа и назначения
ролей; отдельное HR read/write/mapping право и минимальный набор ролей утвердить
до реализации. Публичный HR PATCH не может менять login, link, access или роли.
Account manager не получает автоматически доступ ко всем HR-контактам.
Существующие `/settings/users` и прямые account ID ссылки сохраняются на переходе;
shell/навигация здесь не меняются. Команды link/unlink реализуются в ARCH-04A
отдельно от profile PATCH; invite/PATCH не принимают employee_id как записываемое
поле. Более широкие grant/offboarding-команды остаются за пределами этого одобрения.

Реализация и API для ARCH-04B: [ARCH-04A contract](../employee-user-link-arch-04a.md).

## Решения владельца, блокирующие соответствующие части внедрения

| Вопрос | Предлагаемая безопасная граница до решения |
|---|---|
| Категории, одна/несколько на человека; отличаются ли они по организациям | Ничего не кодировать; не использовать RBAC roles как категории |
| Несколько организаций, совместительство, перевод/повторный найм, дубли HR | Сохранить текущую одну organization_id; не объявлять глобальную уникальность человека по ФИО. Если нужны несколько employment, пересмотреть схему до backfill |
| Увольнение/архив и доступ; реактивация | Предложение: явная подтверждённая offboarding-команда блокирует доступ и отзывает все сессии атомарно; сессии не оживают, возврат доступа и состав ролей требуют явного решения. Это **не принятое правило** и не новый смысл текущего HR PATCH |
| Legacy users, service accounts, внешние лица | Сверка + явно утверждённый список исключений; не создавать фиктивных Employee/организаций. Способ хранения исключения ещё согласовать |
| Invitation, минимум ролей, HR/auth contacts, HR ACL | Согласовать отдельно; без автоматических ролей/паролей из HR. Проверить восстановление доступа и защиту последнего администратора до включения команд |
| Ошибочная связь, дубли аккаунтов, повторное использование login | Не объединять/удалять ID и ledger; исправлять только подтверждённую mapping-ошибку отдельной операцией. Identity аккаунта другому человеку не переиспользовать |

Документ можно рассмотреть без ответов сейчас. Неразрешённые строки блокируют
зависимую реализацию, а не подготовку этой архитектуры.

## Этапы внедрения, сверка и rollback (будущие отдельные задачи)

1. Владелец утверждает ADR и политики выше; фиксируются API, ACL и микрозадачи.
   Read-only инвентаризация конкретных пользователей/Employee/зависимостей:
   duplicates, unmapped, service exceptions, impact на sewing/tasks/audit/CRM.
2. Additive миграция nullable FK + UNIQUE/RESTRICT, без data backfill в DDL.
   Upgrade/downgrade сначала на изолированном local PostgreSQL; старое приложение
   должно продолжать работать с null. Никакого production apply из этой задачи.
3. Backfill отдельной явной командой: owner-approved manifest Employee.id ↔
   PlatformUser.id с источником доказательства/проверившим/датой; dry-run, конфликты,
   контроль revision, locked atomic apply и audit. Не матчить по ФИО, login,
   email/телефону или существующему SalesUser по имени; они лишь кандидаты на ручную
   сверку. Нет доказательства — null, не guessed match. Результат повторяемый.
4. Команды link/grant/offboarding и совместимые batch DTO; затем HR-first UX и
   запрет независимого редактирования HR-копий связанного пользователя. Отдельно
   проверить own/manager sewing, mentions, work tasks, CRM и legacy entrypoints.
5. После owner review и regression перейти на новый UX. Не закрывать legacy
   исключения и не удалять старые profile columns массово; cleanup — другой этап.

Rollback: сначала отключить новые команды/UX, вернуть совместимый старый reader;
связь может остаться nullable. Откат назначения не отменяет выполненную человеком
работу и не меняет actors. До downgrade экспортировать проверенные пары и audit
в защищённое хранилище с утверждённой retention; затем убрать только новый FK/
UNIQUE/column. Не удалять Employee, аккаунты, роли, сессии или ledger для обхода
ограничений. Для неверного backfill — explicit audited correction, не SQL reset.
Полное восстановление из backup затёрло бы новые факты и не является обычным rollback.

## Regression checklist перед будущим выпуском

- [ ] Employee без доступа; новый/существующий account; legacy/service null;
  уникальность обеих сторон, concurrent grant (один победитель), повтор и rollback.
- [ ] Нет auto-match по имени/контактам; ambiguity/занятая связь/отсутствующий ID
  дают явную ошибку; не создаются дубли и скрытые связи через SalesUser.
- [ ] HR-only пользователь не выдаёт доступ; account-only администратор не читает
  лишние HR-поля; 401/403, отмена invite и отказ транзакции не оставляют аккаунт/роли.
- [ ] Archive/offboard/reactivate и все сессии соответствуют утверждённой политике;
  восстановление администратора и pending/invited/active проверены отдельно.
- [ ] PlatformUser ID, author/assignee/recipient, stage access/RBAC, ledger qty/status/
  unit_price, production fact/plan и audit provenance неизменны после link/HR rename.
- [ ] Sewing own/read_any/restricted shell, mentions, задачи, CRM responsible,
  history старых и unmapped аккаунтов работают; категории не дают прав.
- [ ] Profile readers не расходятся; list embed/query budget, reload/invalidation,
  сохранённые URL, upgrade/downgrade и восстановление manifest проверены.

Цена решения: сохраняются два технических ID и переходные профильные поля,
нужна ручная сверка. Это позволяет связать одного человека с доступом, сохранив
производственную историю. Автослияние по имени, замена actor на Employee и две
независимые редактируемые HR-карточки отвергнуты.
