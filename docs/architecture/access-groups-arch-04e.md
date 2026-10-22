# ARCH-04E — Role-backed access groups; API для ARCH-04F

2026-10-21. Реализация [задачи ARCH-04E](../tasks/pc-arch-04e-access-groups-backend-codex.md)
по [ARCH-04D](unified-employee-access-navigation-arch-04d.md).

## Модель и совместимость

Группа доступа = существующий `Role`. M:N `platform_user_roles` и
`role_permissions` уже были реализованы; второй join table/RBAC store не создан.
Effective permissions = union role permissions. Нет deny, персональных grants,
автоматических групп по Employee.position/category или нового auth subject.

Миграция **arch04e_20261021**, parent **arch04a_20261021**, добавляет только
`roles.version` NOT NULL DEFAULT 1 для concurrency. Upgrade не меняет роли,
permission sets, memberships, аккаунты или employee_id. Downgrade удаляет только
version; существующие и новые custom groups и назначения сохраняются и читаются
прежним RBAC. При rollback использовать совместимый старый код и сбросить все
in-flight previews; откат не отменяет ранее подтверждённые назначения/аудит.
Защита writes относится к сервисам ARCH-04E: старый backend binary не получает
новые guards автоматически. Обновление/откат writers должен быть согласованным;
совместимость legacy HTTP-клиентов на новом backend сохранена. Автоматического
production rollout эта задача не выполняет.

Новые группы создаются с is_system=false; system roles и известные MVP role codes
нельзя переименовать/редактировать/удалить через group CRUD. Их членство по-прежнему
можно явно менять с administrator guards. Code группы неизменяемый, имя изменяемо;
code уникален, системные коды зарезервированы. Менеджеры/Дизайнеры не засеиваются
с выдуманным набором прав: администратор выбирает реальные Permission codes.

`ensure_rbac_seed` сохраняет прежний policy известных system roles и не затирает
custom groups. Новые read APIs и GET `/roles` не запускают seed/записи. Все writers
seed/legacy assignment/new group mutation используют общий PostgreSQL transaction
advisory lock 7040421. Прямой SQL вне сервисов не является поддерживаемым writer.

## Защита управления доступом

Все новые чтения и записи требуют существующего **admin.roles.assign**, с
проверкой текущего server state после получения mutation lock. Новый permission
code, admin wildcard, новая роль или frontend bypass не вводились.

Действующий администратор для guard — активный PlatformUser с invite_status=active,
effective admin.roles.assign и без restricted-sewer mode. Это способность
управлять доступом, а не только совпадение имени роли. Restricted mode остаётся
read_own без read_any; остальные бизнес/stage guards сохраняются.

Нельзя убрать последнего действующего администратора или лишить инициатора его
управления доступом, даже если другой администратор остаётся. Проверка применяется
к новым mutations, прежним assign/revoke и изменению is_active в существующем
profile API. Операция bootstrap без actor может создать первого администратора;
она не снимает guard последнего уже существующего. Запрещённый переход — 409
без изменения grants/active state. Нет автоматической блокировки, смены пароля,
отзыва сессии, HR/offboarding logic или изменения существующих активных аккаунтов.

## Чтение и матрица

| API | Ответ |
|---|---|
| GET `/permissions` | Полный реальный backend catalog: массив `{code,description}`, включая права без назначений |
| GET `/roles` | Совместимый `{items:[...]}`. RoleRead: прежние id/code/name/is_system/permissions + version/member_count |
| GET `/roles/{code}` | Один RoleRead |
| GET `/platform-users/{id}/roles` | EffectiveAccessRead |
| GET `/platform-users/{id}/effective-permissions` | Тот же EffectiveAccessRead |

EffectiveAccessRead = `{platform_user_id,role_codes,permissions,restricted,revision}`.
Для матрицы взять `/permissions` + `/roles` двумя bounded requests; не выводить
catalog как union назначенных групп. Нет per-role/member HTTP/SQL; список читает
permissions batch и агрегирует member counts. Member IDs/HR contacts не входят
в group list. Неизвестный label показывать исходным code, не выдумывать UI права.
`/auth/me` по-прежнему возвращает существующую форму roles/permissions, без revision.

## Создание и удаление

POST `/roles` (201):

```json
{"code":"managers","name":"Менеджеры","permissions":["audit.read"],"reason":"Утверждён набор прав"}
```

Permissions — полный явный список, может быть пустым; неизвестный/повторный code
отклоняется. Code pattern `[a-z][a-z0-9_]*`, max64; name max255; reason max500,
обязательные непустые строки после trim. Поля is_system/deny/overrides запрещены.

DELETE `/roles/{code}` (204) принимает JSON `{version,reason}`. Удаление system
или назначенной группы запрещено; сперва отдельно и явно снять membership.
Удаление не каскадирует снятие доступа. Устаревшая version — 409.

## Preview → apply

Группа: POST `/roles/{code}/preview` с полным `{version,name,permissions,reason}`.
Состав аккаунта: POST `/platform-users/{id}/roles/preview` с
`{role_codes:[...],reason}`. Это полная замена состава, включая system roles:
клиент должен сохранить выбранные неизменяемые назначения в списке, а не отправить
только добавленную группу. Пустой список — явное снятие всех, проверяемое guards.

Preview — read-only и возвращает:

```json
{"revision":"sha256…","preview_fingerprint":"sha256…","can_apply":true,"blocker":null,"affected_count":2,"granted":["audit.read"],"removed":[],"group_granted":["audit.read"],"group_removed":[]}
```

`affected_count` для группы — число всех её members, включая inactive accounts.
`granted/removed` — union **реальных per-account effective deltas**, с учётом
перекрывающихся grants. `group_granted/group_removed` отдельно показывают изменение
самого permission set; для membership preview эти поля пусты. Это не список
персональных HR данных и не утверждение, что все members теряют одно право.

Apply: PATCH `/roles/{code}` или PUT `/platform-users/{id}/roles` с **тем же body**
плюс `revision` и `preview_fingerprint`. Fingerprint привязан к actor/target/body,
включая reason. Изменение body, state или версии требует нового preview.
На can_apply=false UI показывает blocker и не вызывает apply.

Revision консервативно охватывает все RBAC group versions/names/permissions,
memberships и active/invite state, но не password, employee_id или activity time.
Даже несвязанное изменение доступа может дать stale 409; безопасно обновить экран
и подтвердить снова. Это явное ограничение первой версии, не cache fallback.
Apply повторно проверяет current actor, state/revision/fingerprint/guards под lock,
атомарно меняет grants+audit. No-op не добавляет аудит и не увеличивает version.
Повтор старого успешно применённого preview после изменения — 409.

## Ошибки и audit

- 401 без сессии, 403 без действующего права управления.
- 404 отсутствующий account/group; неизвестный permission code — 422.
- 422 неполный/лишний body, повторные codes, пустое имя/причина.
- 409 detail prefixes: `group_code_exists`, `system_group_read_only`,
  `group_has_members`, `access_changed`, `last_active_administrator`,
  `administrator_self_lockout`. Клиент сохраняет draft, обновляет preview,
  не заменяет конфликт успешным локальным состоянием.

Canonical AuditEvent: `access_group.created/updated/deleted`, entity_type=role,
entity_id=Role.id; `access_group.membership_updated`, entity_type=platform_user.
Session actor + before/after + reason и effective delta/impact записываются в одной
транзакции с mutation. Ошибка audit откатывает mutation. Пароли/HR контакты не
логируются. Существующие role.assign/role.revoke сохраняют свои event contracts.

## Старые клиенты и ARCH-04F

POST `/platform-users/{id}/roles` с `{role_code}` и DELETE
`/platform-users/{id}/roles/{role_code}` сохранены: прежние 200 и PlatformUserMeRead,
не замещают остальные membership, повторное назначение/снятие — no-op. Unknown
role в этом legacy API остаётся 422 по прежнему контракту. Эти команды теперь
также сериализованы и защищены от последнего admin/self-lockout; profile disable
имеет тот же guard. Старый простой API не требует preview tokens.

ARCH-04F должен читать реальные catalog/groups/effective responses, показывать
shared impact и delta перед Save, сохранять весь membership при PUT, обрабатывать
409 обновлением preview; refresh matrices/группы/затронутые account views после
успеха. Проверять доступ сервером независимо от modal/full-page entry.
Employee mapping ARCH-04A/B и frontend этой итерацией не меняются.
NAV-04 остаётся локальным проектом, не правилом AGENTS.md.

Tests: `test_access_groups_arch_04e.py`, `test_access_groups_postgres_arch_04e.py`;
локальные UUID schemas на PostgreSQL :5432. Проверены union/overlap, CRUD/seed,
auth/errors, legacy compatibility, audit rollback, bounded reads, сохранность
Employee/profile/производственной истории, downgrade grants и реальные гонки
shared group apply/взаимного legacy admin revoke. Production apply не выполнялся.
