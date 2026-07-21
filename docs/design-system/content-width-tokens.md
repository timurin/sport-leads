# Sport-Lead — Content Width Tokens

**Code:** `SL-CONTENT-WIDTH-TOKENS-v1`  
**Date:** `2026-07-21`  
**Roadmap:** `5.2.2.2`  
**Source:** `frontend/app/globals.css`  
**Smoke:** `frontend/components/layout/page-layout.tsx`

## Page content max widths

| Token | Value | `PageContent` `width` |
|---|---|---|
| `--portal-content-narrow` | `42rem` (672px) | future forms/dialogs |
| `--portal-content-default` | `80rem` (1280px) | `default` (was `max-w-7xl`) |
| `--portal-content-max` | `1760px` | `wide` (platform default) |
| — | none | `full` → `max-w-none` |

Rules:

1. `PageContent` is always `mx-auto w-full min-w-0`.
2. Width props only set **max-width**, never force a fixed page width.
3. No global `min-width` on page roots inside AppShell.

## Responsive grid minima

| Token | Value | Class |
|---|---|---|
| `--portal-grid-min-sm` | 230px | `.portal-grid-small` |
| `--portal-grid-min-md` | 300px | `.portal-grid-medium` |
| `--portal-grid-min-lg` | 390px | `.portal-grid-large` |

Always `minmax(min(100%, N), 1fr)` — never drop `min(100%, …)`.

## Shell widths (reference)

See `component-size-tokens.md`: sidebar 260/72, topbar 64/72.
