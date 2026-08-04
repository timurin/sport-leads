# ADR-023 — Authentication strategy and session contract

**Status:** принято (`2026-08-01`)  
**Date:** `2026-08-01`  
**Roadmap:** Stage `17.1.1.1` (contract); feeds `17.1.1.2`–`17.1.1.4`, `17.1.2`, Stage `19` access  
**Depends on:** none (opens Stage 17 access contour)  
**Evidence:** `docs/tasks/v0.9.0-stage-17.1.1-authentication.md`

## Контекст

Сегодня:

- API и workspace **открыты без входа** (dev MVP).
- `SalesUser` — справочник ответственных CRM (`responsible_id`), **не** учётка входа.
- Карточка лида / заметки / задачи берут «текущего актёра» из `GET /sales-users` (client-picked) — interim до `17.1.1`.
- Frontend `:3001` и backend `:8000` — разные origin в локальной разработке.
- Роли/права (`17.1.2`) и audit (`17.1.3`) ещё не определены как сущности.

Нужно зафиксировать стратегию входа и контракт сессии **до** реализации API/UI, без смешения с CRM-справочником и без OAuth/SSO в MVP.

## Решение

### 1. Identity (кто логинится)

| Понятие | Роль |
|---------|------|
| **PlatformUser** | Учётка входа в ERP (login + password hash + display name + `is_active`). SoT аутентификации. |
| **SalesUser** | CRM-справочник ответственных; **не** пароль, **не** session subject. |
| Optional link | `PlatformUser.sales_user_id` (nullable FK) — для подстановки responsible / display continuity; не обязателен для login. |

Правила:

- `17.1.1.2` **может** ввести минимальную таблицу `platform_users` (auth fields only), если `17.1.2` ещё не начат.
- `17.1.2` **расширяет** ту же сущность ролями/permissions; не создаёт параллельный login store.
- Не использовать `SalesUser` как таблицу паролей.

### 2. Session strategy (MVP)

**Opaque server-side session** (не JWT access в localStorage).

| Элемент | Контракт |
|---------|----------|
| Cookie | `sl_session` — HttpOnly, Secure (prod), Path=/ |
| SameSite | `Lax` when FE and API share site via Next rewrite/proxy; `None`+Secure only if cross-site cookies are unavoidable |
| Value | random opaque token (≥32 bytes); store **hash** server-side |
| Store | `auth_sessions`: `id`, `platform_user_id`, `token_hash`, `created_at`, `expires_at`, `revoked_at`, `user_agent`/`ip` optional |
| TTL | default **12h** absolute; optional sliding refresh on `/auth/me` (extend ≤24h cap) — exact constants in `17.1.1.2` settings |
| Transport | Browser → cookie; Next RSC/server actions **forward** `Cookie` to API |

**Rejected for MVP:** JWT in `localStorage` / non-HttpOnly JS-readable tokens; third-party IdP; magic links.

**Optional later (not MVP):** short-lived JWT access + refresh rotation — only if proxy/cookie model proves insufficient.

### 3. Local / production origin model

| Environment | Preferred |
|-------------|-----------|
| Production | Next.js reverse-proxy / rewrite so browser talks **same origin**; API sets host-only cookie |
| Local (`3001`↔`8000`) | Same rewrite in `next.config` **or** CORS `allow_credentials` + explicit `SPORT_LEADS_CORS_ORIGINS`; document chosen path in `17.1.1.2` |

Public (no session): `/health`, `/health/ready`, OpenAPI docs may stay open in dev; production docs exposure is ops (`17.2`).

### 4. API surface (`17.1.1.2`)

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| `POST` | `/auth/login` | public | body `{ login, password }` → set `sl_session` cookie; 401 on bad credentials / inactive user |
| `POST` | `/auth/logout` | session | revoke session; clear cookie |
| `GET` | `/auth/me` | session | current `PlatformUser` summary (`id`, `login`, `display_name`, `sales_user_id?`); 401 if missing/expired |

Password hashing: **Argon2id** (or bcrypt if argon2 dependency blocked — pick one in implement and stick). Never store plaintext.

Rate-limit / lockout: soft MVP (log + optional simple delay); hard lockout policy can follow in `17.1.2` / ops.

### 5. Frontend gate (`17.1.1.3`)

- Unauthenticated visit to `(workspace)/*` → redirect `/login`.
- `/login` page (PT-simple form); no shell chrome required beyond minimal layout.
- After login → last intended path or `/`.
- Server components / actions must not silently invent a demo actor; use `/auth/me`.
- Replace client-picked «current SalesUser» actor on lead notes/tasks/messages with authenticated platform user (display name; `author_id` → platform user or linked sales_user per implement choice — document in `17.1.1.3`).

### 6. Authorization boundary (defer detail to `17.1.2`)

Until roles ship:

- **Authenticated** = may use ERP surfaces that today are open (broad allow after login).
- **Unauthenticated** = 401 on protected API (after gate wires).

After `17.1.2`:

- Deny-by-default on sensitive writes (size-grid mutations, shop kanban DnD, admin).
- Auth middleware only establishes **who**; permission checks establish **what**.

### 7. Actor / audit hooks

| Concern | Rule |
|---------|------|
| Lead notes / tasks / messages | Prefer authenticated user as author; stop trusting client-supplied actor id once gate is live |
| Design comments `author_name` | May remain free-text until wired; not a substitute for session |
| Stage `19` chat | Requires authenticated staff (`17.1.1`); finer ACLs → `17.1.2` |
| Audit `17.1.3` | Session `platform_user_id` is the actor key for critical mutations |

### 8. Out of scope (this ADR)

- OAuth2 / OIDC / SSO / LDAP
- 2FA / WebAuthn
- Per-tenant multi-company login
- Customer/portal accounts (client-facing)
- Full RBAC schema (→ `17.1.2`)
- Production reverse-proxy install (→ `17.2.1`)

## Последствия

- `17.1.1.2` implements login/logout/me + session table + minimal `platform_users`.
- `17.1.1.3` adds `/login` + workspace gate + actor demix from sales-users picker.
- `17.1.2` attaches roles to the same `PlatformUser`.
- CRM `SalesUser` directory remains; optional link only.
- OpenAPI and tests must cover 401 without cookie and happy-path `/auth/me`.

## Evidence

- Roadmap: `17.1.1.1`
- Task: `docs/tasks/v0.9.0-stage-17.1.1-authentication.md`
- Related: Stage `19` deps; CRM actor notes in `1.2.5` / `1.3.3`
