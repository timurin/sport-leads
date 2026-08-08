# Platform user password change + login handle display

**Date:** 2026-08-08  
**Status:** Approved (owner)  
**Scope:** `/settings/users` cabinet

## Goals

1. Fix login display when login is an email (`lm@mosmade.ru` must not become `@lm@mosmade.ru`).
2. Allow password change in user cabinet:
   - **Self** (viewer opens own card): current + new + confirm → `POST /auth/change-password`
   - **Admin** (viewer opens another user): new + confirm → `POST /platform-users/{id}/set-password` (`admin.roles.assign`)

## Non-goals

- Session revoke on password change (MVP keeps sessions)
- Top-nav / self-service outside Settings Users
- New RBAC permission codes
- 2FA

## Login display

Helper `formatLoginHandle(login)`:

- empty → `""`
- contains `@` → raw login
- else → `@` + login

Use in cabinet header / subtitle / manager line. Field «Логин» always shows raw `user.login`.

## API

### `POST /auth/change-password`

Auth: session (`get_current_platform_user`).

Body: `{ current_password, new_password }` (new ≥ 8).

Errors: 422 wrong current / weak new. Session unchanged. No password in response (`204`).

### `POST /platform-users/{platform_user_id}/set-password`

Auth: `admin.roles.assign`.

Body: `{ new_password }` (≥ 8).

Errors: 404 user / 422 weak. Sessions of target not revoked. `204`.

## UI

Security section of `PlatformUserProfilePanel`: password form mode from `viewerUserId === user.id`.

## Tests

- BE: self change OK / wrong current; admin set OK / forbidden without perm
- FE: `formatLoginHandle` + password draft validation
