# ARCH-04A — Employee/account mapping: backend contract

2026-10-21; approved scope of [ADR-036](decisions/ADR-036-employee-platform-user-link.md).

## Storage and compatibility

Migration `arch04a_20261021`, parent `j6k7l8m9n013`: nullable
`platform_users.employee_id → employees.id`, FK `fk_platform_users_employee_id`
ON DELETE RESTRICT, UNIQUE `uq_platform_users_employee_id`. PostgreSQL's unique
constraint creates the supporting unique btree index; no redundant second index.
Existing accounts stay NULL; no backfill, matching or new Employee on login/invite.

Employee and PlatformUser retain their IDs. Binding changes only employee_id and
normal account updated_at metadata. It does not synchronize names/contacts,
change passwords/roles/permissions/stage access/is_active/invite state, revoke
sessions, or modify historical task/sewing/production/audit actors. Unlink is
mapping correction, not access revocation. No category or employment policy added.

## APIs for ARCH-04B

All mapping APIs and the existing account list require **existing**
`admin.roles.assign`; no new permission, role or seed change.

| Method/path | Body / result |
|---|---|
| GET `/platform-users` | Existing paginated `items`; each admin item now also has nullable employee_id. Scalar column, no per-user HR query |
| GET `/platform-users/{id}/employee-link` | `{ "platform_user_id": 42, "employee_id": 7 }` or null mapping |
| POST `/platform-users/{id}/employee-link` | `{ "employee_id": 7, "reason": "Подтверждены ID сотрудника и аккаунта" }` → same minimal mapping DTO |
| POST `/platform-users/{id}/employee-unlink` | `{ "expected_employee_id": 7, "reason": "Исправление подтверждённой ошибки" }` → DTO with employee_id=null |

Reason is trimmed, required, 1–500 characters; employee IDs are positive and
required. Unknown command fields are rejected (422). Empty body/null ID is not
an unlink command. Missing account/employee → 404; no session → 401; insufficient
permission → 403. Existing admin list schema adds only employee_id; `/auth/*`
response/endpoint contracts and public Employee DTO remain unchanged. No new
HR data is disclosed on auth/me or public Employee reads.

Link checks both IDs and existing ownership. Same pair is idempotent (200, no
duplicate event); occupied employee or already-mapped account pointing elsewhere
→ 409. No silent replacement: explicitly unlink the old pair first. Unlink
requires the expected old employee ID; another current mapping → 409. Already
unmapped account with an existing expected Employee is an idempotent 200.
If the expected Employee itself is missing, return 404 even on a retry.

Service rechecks the existing permission, locks the account then Employee row,
checks ownership and relies on DB UNIQUE for races. Unique violation is a 409,
not a 500. Mapping change and audit append are in one savepoint/transaction;
API commits together. Failure preserves the old mapping. Generic HR/profile
PATCH and invite do not provide a mapping write path.

## Audit and history

Existing AuditEvent, entity_type=`platform_user`, entity_id=account ID;
actions `platform_user.employee_linked` / `platform_user.employee_unlinked`.
Actor ID/login come from the session, never request JSON. Payload contains
`before.employee_id`, `after.employee_id`, `reason`; occurred_at and source use
canonical audit defaults. No copied HR contacts or credentials in audit payload.
Idempotent no-op does not invent another historical event.

No hard-delete endpoint or account merge is added. Employee deletion while
linked is restricted by FK; unlink retains both records and all actor references.
Downgrade drops only the new constraint/FK/column, not accounts/employees/history.
Before production downgrade preserve the mapping manifest/audit as ADR-036
requires; migration itself does not export confidential data or undo work facts.

## Cursor handoff

Use existing Employee directory and users cabinet, never a new person store.
Employee may exist without access; an account may remain unmapped. Read mapping
from the admin list or dedicated GET. Use existing `/employees` read API for
selection (default active_only=true; explicit false for correction involving an
archived record). Backend mapping does not equate HR archive with access state.

Provide explicit verified selection/reason and a distinct correction unlink
action. Pass expected_employee_id from the loaded DTO; on 409 refresh mapping
and show the conflict. Do not retry with a different ID automatically. Refresh
the account list, selected account/Employee surface and mounted form state after
success. Avoid per-row Employee fetches: load a bounded directory request or use
IDs already available in the opened card. No automatic matching by name/email.

Existing invite is still a separate operation and does not create a mapping;
if a future UI creates an account first, a failed link must preserve that
account and show a retry/correction action, not invite a duplicate. Atomic
Employee→grant-access orchestration, HR profile display/edit unification,
offboarding, categories and new HR ACL are future scopes, not ARCH-04A readiness.

## Evidence

`test_employee_user_link_arch_04a.py`: commands, reload/admin list, validation,
permission/not-found/conflicts/idempotency, independent creation, auth/session/
profile/RBAC compatibility, FK guards, audit rollback, historical production/
ledger/task/audit preservation. `test_employee_user_link_postgres_arch_04a.py`:
two upgrade/downgrade cycles, old values preserved, no backfill, Alembic metadata
comparison, actual concurrent link with one winner and one audit event.
PostgreSQL tests use only UUID-owned schemas on localhost:5432; production and
tunnel:5433 are excluded. Existing local schema upgraded separately; no local
account was linked. No UI/visual verification is claimed.
