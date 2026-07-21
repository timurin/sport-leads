# Sport-Lead — Typography Scale

**Code:** `SL-TYPOGRAPHY-TOKENS-v1`  
**Date:** `2026-07-21`  
**Project version:** `v0.9.0`  
**Roadmap:** `5.2.1.3`  
**Source of truth:** `frontend/app/globals.css` (`:root` + `@theme inline`)  
**Typed mirror:** `frontend/lib/design-system/tokens.ts` (`typographyTokens`)

## Font families

| Token | CSS variable | Value | Notes |
|---|---|---|---|
| Sans | `--portal-font-sans` | `Inter, "Segoe UI", Arial, sans-serif` | Platform default |
| Mono | `--portal-font-mono` | system ui-monospace stack | Codes, IDs |

Compat aliases (deprecated names): `--font-geist-sans` / `--font-geist-mono` → portal fonts.  
**Geist is not loaded**; previous docs claiming Geist were incorrect. Optional `next/font` Inter packaging can come later without changing the scale.

Tailwind: `font-sans` / `font-mono` map to portal stacks.

## Size scale

| Role | CSS variable | px | rem | Tailwind utility | Typical use |
|---|---|---|---|---|---|
| Display | `--portal-font-size-display` | 30 | 1.875 | `text-portal-display` | Spacious page title |
| Page | `--portal-font-size-page` | 24 | 1.5 | `text-portal-page` | Default page / entity title |
| Entity | `--portal-font-size-entity` | 20 | 1.25 | `text-portal-entity` | Compact entity header |
| Section | `--portal-font-size-section` | 16 | 1 | `text-portal-section` | Card / section heading |
| Section sm | `--portal-font-size-section-sm` | 14 | 0.875 | `text-portal-section-sm` | Dense section heading |
| Body | `--portal-font-size-body` | 14 | 0.875 | `text-portal-body` | Default UI copy (`body`) |
| Dense | `--portal-font-size-dense` | 13 | 0.8125 | `text-portal-dense` | CRM workspace (`[data-lead-workspace]`) |
| Meta | `--portal-font-size-meta` | 12 | 0.75 | `text-portal-meta` | Metadata rows |
| Caption | `--portal-font-size-caption` | 11 | 0.6875 | `text-portal-caption` | Eyebrows, tiny labels |

## Line height

| Token | Value | Use |
|---|---|---|
| `--portal-leading-tight` | `1.25` | Display / page titles |
| `--portal-leading-snug` | `1.35` | Entity / section / meta |
| `--portal-leading-normal` | `1.45` | Body / dense |
| `--portal-leading-relaxed` | `1.55` | Long-form help text |

`@theme` wires matching `--text-portal-*--line-height` for the size utilities.

## Weight

| Token | Value | Use |
|---|---|---|
| `--portal-font-weight-regular` | 400 | Body |
| `--portal-font-weight-medium` | 500 | Labels |
| `--portal-font-weight-semibold` | 600 | Titles, emphasis |
| `--portal-font-weight-bold` | 700 | Strong actions / shell |
| `--portal-font-weight-extrabold` | 800 | Logo / rare accents |

Prefer Tailwind `font-medium` / `font-semibold` / `font-bold` when they match these weights.

## Tracking

| Token | Value | Use |
|---|---|---|
| `--portal-tracking-tight` | `-0.01em` | Large titles |
| `--portal-tracking-normal` | `0` | Default |

## Usage rules

1. New shared headings/copy use `text-portal-*` (or CSS vars), not ad-hoc `text-[17px]`.
2. Platform Topbar / Sidebar chrome may keep existing sizes under DS-SHELL until an explicit visual task.
3. Ordinary text wraps by words; `overflow-wrap: anywhere` only for email, URL, ID, technical values.
4. Do not introduce a second type scale in module CSS (`--pc-*` font sizes, etc.).

## Smoke consumers in this task

- `body` → body size / leading / Inter stack
- `[data-lead-workspace]` → dense
- `EntityHeader` → display / page / entity / caption / meta / body utilities
- `SectionCard` title → `text-portal-section`
