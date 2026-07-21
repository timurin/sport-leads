# Sport-Lead — Breakpoint Tokens

**Code:** `SL-BREAKPOINT-TOKENS-v1`  
**Date:** `2026-07-21`  
**Roadmap:** `5.2.2.1`  
**Source:** `frontend/app/globals.css`  
**Related:** `docs/design-system/responsive-rules.md`, `responsive-audit.md`

## Product bands

| Band | Token / rule | CSS | Maps to Tailwind |
|---|---|---|---|
| Narrow mobile | `--portal-bp-narrow-mobile-max` | ≤600px | spot-check only |
| Mobile | `--portal-bp-mobile-max` | ≤767px | `max-md` |
| Tablet | `--portal-bp-tablet-min` | ≥768px | `md` |
| Laptop | `--portal-bp-laptop-min` | ≥1024px | `lg` (desktop section nav) |
| Desktop | `--portal-bp-desktop-min` | ≥1280px | `xl` |
| Wide | `--portal-bp-wide-min` | ≥1500px content band | custom / near `2xl` |

Runtime utilities stay Tailwind `sm`/`md`/`lg`/`xl`/`2xl`. Portal CSS vars document the **product** bands used in audits and shell contracts.

`@theme` aliases: `--breakpoint-portal-tablet|laptop|desktop|wide` (rem).

## Shell behaviour (locked)

| Breakpoint | Behaviour |
|---|---|
| `< md` (≤767) | Platform Sidebar hidden; topbar menu carries sections |
| `md+` | Sidebar expanded/compact modes |
| `lg+` | Desktop in-section topbar nav |
| `md+` | Topbar height 72px (64px below) |

## Container queries

Prefer CQ for nested workspaces (lead card, nomenclature). Viewport breakpoints are for shell/chrome only.

## Verification matrix (unchanged)

1920, 1600, 1440, 1280, 1024, 768, 390 — see `responsive-audit.md`.
