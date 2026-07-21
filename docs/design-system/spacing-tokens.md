# Sport-Lead — Spacing Scale

**Code:** `SL-SPACING-TOKENS-v1`  
**Date:** `2026-07-21`  
**Project version:** `v0.9.0`  
**Roadmap:** `5.2.1.4`  
**Source of truth:** `frontend/app/globals.css` (`:root` + `@theme inline`)  
**Typed mirror:** `frontend/lib/design-system/tokens.ts` (`spacingTokens`)

## Base grid

**4 px** base unit. Steps are named like a partial Tailwind scale (1–12) mapped to portal values.

| Token | CSS variable | px | Tailwind utilities (examples) |
|---|---|---|---|
| 0 | `--portal-space-0` | 0 | `p-portal-0`, `gap-portal-0` |
| 1 | `--portal-space-1` | 4 | `p-portal-1`, `gap-portal-1`, `m-portal-1` |
| 2 | `--portal-space-2` | 8 | `gap-portal-2` |
| 3 | `--portal-space-3` | 12 | `p-portal-3` |
| 4 | `--portal-space-4` | 16 | `p-portal-4` |
| 5 | `--portal-space-5` | 20 | `p-portal-5` |
| 6 | `--portal-space-6` | 24 | `p-portal-6`, `gap-portal-6` |
| 8 | `--portal-space-8` | 32 | `p-portal-8` |
| 10 | `--portal-space-10` | 40 | section breathing room |
| 12 | `--portal-space-12` | 48 | rare large page gaps |

`@theme` registers `--spacing-portal-*` so Tailwind generates spacing utilities.

Skipped steps **7 / 9 / 11** on purpose (avoid half-step clutter). Prefer nearest even step.

## Density mapping (page chrome)

Aligns with `visual-rules.md` compact / default / spacious:

| Density | PageContent padding | Grid gap | Actions gap |
|---|---|---|---|
| `compact` | `p-portal-3` → `sm:p-portal-4` (12→16) | `gap-portal-2` (8) | `gap-portal-2` |
| `default` | `p-portal-4` → `lg:p-portal-6` (16→24) | `gap-portal-3` (12) | `gap-portal-2` |
| `spacious` | `p-portal-5` → `lg:p-portal-8` (20→32) | `gap-portal-4` → `lg:gap-portal-6` | `gap-portal-2` |

Control heights (`--portal-control-*`) stay in `5.2.1.6` — not spacing tokens.

## Usage rules

1. New shared layout/spacing uses `*-portal-*` utilities or `var(--portal-space-*)`.
2. Do not invent `--pc-gap` style module spacing; alias to portal space if needed.
3. Shell DS-SHELL paddings remain under contract until an explicit visual task; new work should still prefer the scale.
4. Content max width remains `--portal-content-max` (`5.2.2.2`).

## Smoke consumers in this task

- `PageContent` / `PageActions` / `ResponsiveGrid` in `frontend/components/layout/page-layout.tsx`
