# Sport-Lead — Semantic Color Tokens

**Code:** `SL-COLOR-TOKENS-v1`  
**Date:** `2026-07-21`  
**Project version:** `v0.9.0`  
**Roadmap:** `5.2.1.2`  
**Decision:** **A** — portal primary adopts shell/reference `#1f5eff`  
**Source of truth:** `frontend/app/globals.css` (`:root` + `@theme inline`)  
**Typed mirror:** `frontend/lib/design-system/tokens.ts` (`colorTokens`)

Shell JSX hex in `app-sidebar.tsx` / protected DS-SHELL chrome is **not restyled** in this task; values now match the published portal primary. Gradual replacement of hardcoded hex is `5.2.2.5`.

## Surfaces

| Token | CSS variable | Value | Tailwind utility |
|---|---|---|---|
| Page | `--portal-page` | `#f6f8fc` | `bg-portal-page` |
| Surface | `--portal-surface` | `#ffffff` | `bg-portal-surface` |
| Surface secondary | `--portal-surface-secondary` | `#f8fafc` | `bg-portal-surface-secondary` |

## Text

| Token | CSS variable | Value | Tailwind utility |
|---|---|---|---|
| Text | `--portal-text` | `#101828` | `text-portal-text` |
| Muted | `--portal-text-muted` | `#667085` | `text-portal-muted` |
| Subtle | `--portal-text-subtle` | `#98a2b3` | `text-portal-subtle` |
| Inverse | `--portal-text-inverse` | `#ffffff` | `text-portal-inverse` |

Legacy aliases: `--background` → surface, `--foreground` → text.

## Border

| Token | CSS variable | Value | Tailwind utility |
|---|---|---|---|
| Border | `--portal-border` | `#dfe5ef` | `border-portal-border` |
| Border strong | `--portal-border-strong` | `#cfd7e6` | `border-portal-border-strong` |

## Primary (Decision A)

| Token | CSS variable | Value | Tailwind utility |
|---|---|---|---|
| Primary | `--portal-primary` | `#1f5eff` | `bg/text/border-portal-primary` |
| Primary hover | `--portal-primary-hover` | `#174bd8` | `bg-portal-primary-hover` |
| Primary soft | `--portal-primary-soft` | `#edf3ff` | `bg-portal-primary-soft` |
| On primary | `--portal-primary-on` | `#ffffff` | `text-portal-primary-on` |
| Gradient from | `--portal-primary-gradient-from` | `#3678ff` | (CSS only; logo) |
| Gradient to | `--portal-primary-gradient-to` | `#174bd8` | (CSS only; logo) |

Previous portal primary `#2563eb` / hover `#1d4ed8` are **deprecated**.

## Status

| Token | CSS variable | Value | Soft |
|---|---|---|---|
| Success | `--portal-success` `#059669` | `--portal-success-soft` `#eaf7ee` |
| Warning | `--portal-warning` `#d97706` | `--portal-warning-soft` `#fff7ed` |
| Danger | `--portal-danger` `#d92d20` | `--portal-danger-soft` `#fef3f2` |

Utilities: `bg/text-portal-success|warning|danger` and `*-soft` variants.

## Focus

| Token | CSS variable | Value | Tailwind utility |
|---|---|---|---|
| Focus ring | `--portal-focus-ring` | `#1f5eff` | `ring-portal-focus-ring` |

Full interaction-state vocabulary (disabled, selected, pressed): **`5.2.1.7`** — see `docs/design-system/interaction-tokens.md`.

## Module aliases

`.product-characteristics-page` `--pc-*` variables now alias portal semantic tokens (no second palette).

## Usage rules

1. New shared UI must use `--portal-*` / `portal-*` utilities, not raw Tailwind `blue-*` / `slate-*` for brand/neutrals.
2. Do not introduce a third primary (`#2563eb`, ad-hoc blues).
3. DS-SHELL-01/02 visual redesign still requires an explicit visual task; token alignment only.
4. StatusBadge and domain status maps migrate in later component work (`5.4` / `5.2.2.5`).

## Smoke consumers updated in this task

- `frontend/components/ui/button.tsx` — primary/danger/focus use portal tokens
- `frontend/components/dashboard/sales-dynamics-chart.tsx` — leads series `#1f5eff`
- `frontend/lib/design-system/tokens.ts` — color dictionary only
