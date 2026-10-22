# ARCH-04D — Единое управление сотрудниками и доступом; NAV-04

Дата аудита: 2026-10-21. [Исходная задача](../tasks/pc-arch-04-unified-access-navigation-contract.md).
**Статус:** аудит выполнен; ниже проект контракта реализации. Целевая концепция
согласована владельцем, детали API/миграции групп требуют отдельной задачи.
NAV-04 — ограниченный пилот, **не глобальное утверждённое UI-правило**.
Runtime, routes, permissions, данные и shell в этой задаче не меняются.

Последующая backend-реализация групп описана отдельно:
[ARCH-04E API/совместимость](access-groups-arch-04e.md). Таблица ниже фиксирует
состояние на момент аудита D; её gaps не являются утверждением об отсутствии
уже реализованного E. UI/NAV-04 по-прежнему требуют отдельных этапов.

## 1. Проверенное текущее состояние

Аудит ограничен Employee/PlatformUser, RBAC, их routes и используемыми modal
механизмами. Учитывает незакоммиченный ARCH-04A/B в рабочем дереве, не утверждает
production/визуальную готовность этих изменений.

| Область | Текущая реализация / подтверждение | Разрыв с целью |
|---|---|---|
| Человек / доступ | Employee — HR, PlatformUser — account; nullable UNIQUE employee_id, отдельные audited link/unlink. [ADR-036](decisions/ADR-036-employee-platform-user-link.md), [ARCH-04A API](employee-user-link-arch-04a.md) | Связь не означает единый экран, выдачу доступа или новую кадровую классификацию |
| HR routes | `/settings/organizations/employees`, `/[employeeId]`; `employees-workspace.tsx`, `employee-card.tsx` | Целевых `/settings/employees` routes ещё нет |
| Account routes | `/settings/users`; query `?user={PlatformUser.id}` и initialUserId открывают профиль в локальном drawer. `settings/users/page.tsx`, `platform-users-workspace.tsx` | Это самостоятельное администрирование; profile selection не поддерживается общей route stack |
| ARCH-04B WIP | EmployeeAccessSection / EmployeeUserLinkPanel связывают ID, ссылки ведут на старые Employee routes и `/settings/users?user=…` | Сохранить работу A/B; не выдавать её за выполненный единый NAV-04 workflow |
| Навигация | `frontend/lib/navigation.ts` содержит отдельные Employees и Users; settings hub также имеет свои ссылки | Заменить структуру в отдельной frontend-задаче; не менять JSX/визуалы shell |
| RBAC store | `roles`, `permissions`, `role_permissions`, `platform_user_roles`; несколько Role, effective codes = set union. `models/rbac.py`, `services/rbac.py` | Семантика access group уже помещается в Role; отдельная таблица-дубль не нужна |
| RBAC APIs | GET `/roles`; POST/DELETE `/platform-users/{id}/roles`; account/profile/invite/mapping admin APIs. Проверка `admin.roles.assign` в backend | Нет API CRUD группы или изменения её permission set; нет отдельного full permission catalog API |
| Seed / admin | `ensure_rbac_seed` восстанавливает permission sets **известных системных** MVP roles; вызывается в том числе GET roles/assign. `user_has_permission` проверяет реальные role codes, не универсальный wildcard admin | Нельзя просто разрешить правку system role: следующий seed отменит её. Нельзя потерять admin grants/связи |
| Матрица | PlatformAccessMatrix + `buildAccessMatrix` берут union кодов из переданных Role.permissions. Сейчас read-only таблица, toolbar toggle показывает её в workspace | Не покажет реальные catalog permissions, не назначенные ни одной роли. Редактор групп/назначений из неё ещё не следует |
| Account drawer | PlatformUserProfilePanel использует CreateDrawer overlay; local state сбрасывает draft при open/user change; close блокирует saving, но dirty-confirm отсутствует | Не гарантирует сохранение черновика при refresh/Back/вложенном переходе |
| Primitive | CreateDrawer имеет portal, aria-modal, Escape, body overflow и isolateEscape/elevated, но не общий router/history coordinator, focus trap или stack manager | Нельзя объявить все existing drawer соответствующими NAV-04 |
| Локальный пример guard | `tech-operation-edit-modal.tsx` имеет собственные dirty/close/beforeunload/focus guards | Это полезный reference, не готовый общий механизм маршрутизации |

Read-only SELECT локального PostgreSQL `:5432`: **12 permissions, 7 roles**;
каталог без пользовательских/кадровых данных сохранён в ignored
`logs/arch-04d-rbac-inventory.json`. Не выполнялись GET `/roles` ради инвентаризации
(он вызывает seed), изменения назначений, production запросы или migration.

Дополнительные guards остаются значимыми: restricted sewer = read_own без
read_any ограничивает API middleware и навигацию независимо от остальных grants;
stage-executor и бизнес-проверки не заменяются матрицей. Добавление группы может
изменить restricted mode. Текущие HR APIs не имеют той же permission dependency,
что account admin API; UI-скрытие вкладки не создаёт серверную HR ACL.

## 2. Целевые сущности и серверный контракт

Employee владеет кадровыми данными; PlatformUser — credential/access identity;
их PK, authored/ledger/audit references и связь ARCH-04A сохраняются. Категория/
должность Employee не является access group и не назначает права автоматически.

**Проект:** использовать существующий Role как access group. Имена «Менеджеры»,
«Дизайнеры» — примеры пользовательских групп, не новые заранее утверждённые роли
или permission presets. Несколько групп на account; effective permissions —
объединение, без deny и индивидуальных overrides. Group module labels — только
представление, не новые permission codes.

Системные roles/admin на первом этапе неизменяемы; новые управляемые группы —
отдельные Role с is_system=false, без переписывания существующих codes/ID и
назначений. Seed не должен затирать пользовательские группы. До реализации
проверить все seed вызовы и отдельно утвердить, будут ли system roles когда-либо
редактироваться; сейчас это не разрешено. Не переключать старые роли массово
на новые группы и не менять состав доступа молча.

Предлагаемое расширение **существующей** RBAC API, не реализовано в этом аудите:

| Операция | Проект поведения |
|---|---|
| Полный permission catalog | Добавить отдельный backend read catalog (предлагаемый GET `/permissions`), только реальные зарегистрированные code/description; роли и effective grants читать с сервера |
| Группы | Расширить `/roles`: создание пользовательской Role, переименование, явное изменение её permission set. Только существующие catalog codes, неизвестный → validation error |
| Назначения | Переиспользовать role assignment/revoke. Нужны server preview/effective before-after, concurrency revision, atomic audit и защита от stale сохранения — не серия незаметных optimistic toggles |
| Удаление группы | На первом этапе запретить для system/назначенной группы; отдельное явное снятие назначений, без cascade потери доступа |
| Изменение shared группы | Показывать область воздействия/число аккаунтов и effective delta, подтверждать; mutation и actor/reason/before-after audit атомарны. Member IDs/HR contacts не раскрывать лишним читателям |

Для пилота предлагается текущий server gate `admin.roles.assign`; расширение его
смысла до group editing и защита последнего администратора/self-lockout должны
быть явно приняты в backend-задаче. Новых кодов прав или admin-bypass этот
документ не вводит. Изменение grants не должно сломать право самого оператора
управлять доступом, bootstrap/recovery или действующий restricted shell.

Матрица показывает весь **серверный** каталог, включая неназначенные права.
Неизвестные UI labels выводить с исходным code; не придумывать `.read/.write`
для каждого экрана. Не защищённый permission-guard действующий сценарий нельзя
обозначать фиктивной permission ячейкой. Если данных нет/401/403 — явная ошибка,
а не mock/default grants. Просмотр матрицы не выполняет запись.

## 3. Routes и совместимость (проект, не существующие endpoints)

| Назначение | Целевая URL / правило |
|---|---|
| Единый вход | `/settings/employees`; фильтры q/status/organization_id в query, выбранная Employee определяется URL карточки |
| Employee / доступ | `/settings/employees/{employeeId}`; `?tab=access` — вкладка «Доступ к платформе», без отдельного слоя только ради вкладки |
| Настройка общей группы | Предлагается `/settings/employees/access-groups/{roleCode}`; shareable standalone page + contextual modal |
| Матрица выбранного доступа | Предлагается `/settings/employees/{employeeId}/access-matrix`; read/edit mode и права проверяются сервером |
| Unmapped/служебный account | Режим общего workspace и предлагаемая `/settings/employees/accounts/{platformUserId}`; показывает честное исключение, не фиктивную Employee |
| Старый Employee list/card | Серверный compatibility redirect/adapter на canonical Employee routes; сохранить поддерживаемые query keys, не внешние return URLs |
| `/settings/users?user={accountId}` | Сначала разрешить account→employee с server permission; linked → Employee access, unmapped → account exception. Это **разные** ID, запрещено подставить accountId как employeeId |
| `/settings/users` без selection | Alias общего workspace; нет второй самостоятельной admin-реализации |

Поддерживать реально существующие deep links; `/settings/users/{id}` сейчас не
подтверждён как page route, не объявлять его старым контрактом. Missing/inaccessible
entity — корректная 404/403 без угадывания HR identity. Unauthorized не должен
узнать mapping через redirect. Ссылки из ARCH-04B переводятся на общие helpers
в отдельной задаче. Основное меню ведёт на полноценную страницу, не modal.

## 4. NAV-04: ограниченный контекстный переход

Область пилота: Employees list A → Employee card B → access group/matrix C.
Та же сущность/компонент и server authorization используются в full page и modal.
Прямой URL, reload, новая вкладка, login и основное меню — полноценная страница,
без синтетического фонового списка, вымышленного origin или history.back наружу.

Предпочтительный механизм — App Router intercepting + parallel routes в узком
settings/workspace scope; локальные установленные Next guides подтверждают soft
interception/hard navigation semantics. Он **сам по себе не решает** вложенность,
dirty Back и сохранение drafts. Для пилота нужен явный context/overlay coordinator,
не глобальный перехват всех Link и не второй независимый router.

Контракт состояния:

- A остаётся mounted при soft A→B; его tab/filter/search/scroll/selection и безопасный
  draft сохраняются в memory по устойчивому context key. Refresh данных не должен
  сбрасывать dirty draft через новый user object. URL содержит entity/tab/filter,
  но не пароль, токен, контакты или содержимое черновика.
- Каждый слой хранит layer key, canonical URL, parent context, focus opener и dirty/
  pending state. Повтор открытия той же сущности не добавляет дубликат. Видимым/
  интерактивным является верхний слой; underlying layers inert для keyboard/AT.
- Практический предел пилота: **два overlay уровня** B/C. Более глубокий контекстный
  переход заменяет C, сохраняя его breadcrumb/return frame; X сначала возвращает
  предыдущий C-контекст, затем B, затем A. Не увеличивать число DOM dialogs без
  границы. Этот предел — проект пилота для UX проверки, не глобальный стандарт.
- Push создаёт один history entry на реальный переход; Close/Escape/Back проходят
  одну close policy. Forward восстанавливает соответствующий слой, пока origin
  существует; иначе открывает standalone. Нельзя слепо вызывать back() при hard
  entry. Standalone имеет явный внутренний «К сотрудникам», не фиктивное «закрыть фон».
- Dirty на затрагиваемом слое требует «Остаться / Отбросить»; подтверждение закрытия
  не сохраняет данные. Pending mutation блокирует повторную запись и уход до
  согласованного завершения; ошибка сохраняет draft. Дубликат Save предотвращается.
  Logout/утрата прав уничтожают чувствительный draft; пароль никогда не сохраняется.
- Browser Back/popstate сложнее локального onClose: сначала проверить его отдельно
  на текущем Next runtime. Beforeunload защищает только hard unload и не заменяет
  soft navigation guard. Если Back не удерживает draft корректно, NAV-04 не проходит
  приёмку; нельзя объявить ready на основании X/Escape.
- Верхний dialog: accessible name, focus trap, Escape только верхнему слою, возврат
  фокуса opener либо логичному элементу A/B; stack-owned scroll lock восстанавливается
  только при закрытии последнего слоя. Не доверять нескольким независимым window
  Escape/overflow effects в CreateDrawer как общему stack manager.

Нужны `@slot/default.tsx` и null catch-all для unmatched/закрытых modal slots:
Next сохраняет активные slots на soft nav, а hard reload без fallback может дать
404 или лишний overlay. Точную folder tree определить в frontend microtask и
проверить на установленной версии, включая route groups (не часть URL).

На 320 px modal может занять viewport; не создавать horizontal page overflow.
Широкая матрица — локальная прокрутка/адаптивное представление с доступными
именами колонок, не сжатые нечитабельные чекбоксы. Сохранить портал tokens,
PT-02 для списка, PT-05 для Employee, существующие modal primitives после проверки
их consumers. Persistent entity create остаётся CreateDrawer по ADR-013;
NAV-04 не отменяет запрет centered create и не меняет shell spacing/frames.

## 5. Гейты внедрения и приёмка

| Отдельная итерация | Результат / гейт |
|---|---|
| ARCH-04D (эта) | Audit + проект; без внедрения и объявления global NAV-04 |
| Backend groups | Утвердить API/permission scope/system/admin/seed policy; реализовать catalog/group mutation/preview/concurrency/audit с сохранением effective access и тестами |
| Unified frontend pilot | Canonical routes + legacy adapters, общий Employee/access экран, modal управления правами, reuse реальных backend grants; не менять shell visual contract |
| Local E2E / owner UX | Матрица ниже на реальном API; только после успеха согласовать расширение |
| Отдельное global approval | Отдельно разрешённое изменение AGENTS.md/UI context/project rules. До этого NAV-04 не глобальный и не основание массово менять остальные modules |

Обязательная E2E-матрица: 1440/768/390/320 px, keyboard-only, long/empty/error
content. Доказать A(filters/search/scroll/selection/draft)→B→Access→C и возврат
по шагам, duplicate open, replacement-C, Back/Forward/X/Escape/backdrop (если
поддержан), hard reload/new tab/direct link, отсутствующий opener и null slots.

Отдельно: dirty cancel/discard, pending/double-save, server validation/409,
различающиеся Employee/account IDs и unmapped legacy URL, 401/403 на прямых
страницах и командах, потеря права во время редактирования, отсутствие записи от
Close. Regression старых форм/invite/profile/link/roles/sewing restricted mode,
system/admin grants, no data/authorship change и отсутствие N+1 обязательны.

Пока этот workflow не реализован, **UI/E2E не пройдены**, контекст NAV-04 не
проверен в браузере и глобальная готовность не заявляется. Статический аудит
выявляет gaps, но не заменяет эти доказательства.

Основные источники: `backend/app/{models,services}/rbac.py`,
`api/platform_users_rbac.py`, `api/deps_auth.py`, `services/sewing_cabinet_access.py`;
`frontend/lib/{navigation,platform-users}.ts`, settings users/Employee pages и
компоненты из таблицы; `components/ui/create-drawer.tsx`;
Next bundled `intercepting-routes.md` / `parallel-routes.md`.
Связанные контракты: [ADR-024](decisions/ADR-024-roles-permissions.md),
[create/modal boundaries](../design-system/create-modal-drawer-boundaries.md),
[protected shell](../design-system/shell-contracts.md).
