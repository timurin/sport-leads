# Sport-Lead — Borders, Radius, and Shadows

**Code:** `SL-SURFACE-CHROME-TOKENS-v1`  
**Date:** `2026-07-21`  
**Project version:** `v0.9.0`  
**Roadmap:** `5.2.1.5`  
**Source of truth:** `frontend/app/globals.css` (`:root` + `@theme inline`)  
**Typed mirror:** `frontend/lib/design-system/tokens.ts` (`radiusTokens`, `shadowTokens`, `borderTokens`)

Border **colors** remain in `color-tokens.md` (`--portal-border`, `--portal-border-strong`). This document covers width, radius, and elevation.

## Border width

| Token | CSS variable | Value | Use |
|---|---|---|---|
| Default | `--portal-border-width` | `1px` | Cards, inputs, dividers (`border`) |
| Strong | `--portal-border-width-strong` | `2px` | Emphasis outlines, active tabs |

Style: solid by default; dashed allowed for empty/drop targets (`border-dashed` + `border-portal-border`).

Tailwind: `--border-width-portal` / `--border-width-portal-strong` in `@theme`.

## Radius

| Token | CSS variable | px | Tailwind | Typical use |
|---|---|---|---|---|
| None | `--portal-radius-none` | 0 | `rounded-portal-none` | Flush edges |
| SM | `--portal-radius-sm` | 6 | `rounded-portal-sm` | Compact controls |
| MD | `--portal-radius-md` | 8 | `rounded-portal-md` | Default controls, tabs |
| LG | `--portal-radius-lg` | 12 | `rounded-portal-lg` | Cards, menus |
| XL | `--portal-radius-xl` | 16 | `rounded-portal-xl` | Large panels |
| Full | `--portal-radius-full` | 9999 | `rounded-portal-full` | Pills, avatars |

**Exceptions (do not invent new steps):** DS-SHELL may keep legacy `9px` / reference `14px` until an explicit shell visual task. New shared UI must use this scale.

## Shadows

| Token | CSS variable | Tailwind | Use |
|---|---|---|---|
| SM | `--portal-shadow-sm` | `shadow-portal-sm` | Info/metric tiles |
| Card | `--portal-shadow-card` | `shadow-portal-card` | Section cards |
| Overlay | `--portal-shadow-overlay` | `shadow-portal-overlay` | Dropdowns, popovers |
| Modal | `--portal-shadow-modal` | `shadow-portal-modal` | Dialogs / heavy overlays |

Prefer one elevation per surface. Do not stack card + overlay on the same element.

## Usage rules

1. Cards: `rounded-portal-lg` + `border-portal-border` + `shadow-portal-card` (or `sm` for dense tiles).
2. Controls: `rounded-portal-sm` / `md`, not ad-hoc `rounded-lg` for new work.
3. Overlays: `shadow-portal-overlay` or `modal`; keep z-index for `5.2.2.3`.
4. No new module-local radius/shadow CSS variables.

## Smoke consumers in this task

- `SectionCard` / `InfoCard` / `MetricCard`
- `Button`, `EmptyState`, `ActionMenu`, `CompactTabs`
