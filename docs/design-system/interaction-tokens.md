# Sport-Lead — Interaction States

**Code:** `SL-INTERACTION-TOKENS-v1`  
**Date:** `2026-07-21`  
**Project version:** `v0.9.0`  
**Roadmap:** `5.2.1.7`  
**Source of truth:** `frontend/app/globals.css`  
**Typed mirror:** `frontend/lib/design-system/tokens.ts` (`interactionTokens`)  
**Closes:** Stage `5.2.1` Visual foundations (pending owner visual check)

## States

| State | Tokens | Behaviour |
|---|---|---|
| **Hover** | `--portal-state-hover-bg` → surface-secondary; primary uses `--portal-primary-hover`; danger uses `--portal-danger-hover` | Pointer devices only |
| **Pressed / active** | `--portal-state-pressed-bg` (`#eef2f7`); primary/danger keep hover fill | `:active` |
| **Focus visible** | `--portal-focus-ring`, `--portal-focus-ring-width` (2px), `--portal-focus-ring-offset` (2px) | Keyboard / `:focus-visible` only; class `.portal-focus-ring` |
| **Selected** | `--portal-state-selected-bg` (primary-soft), `--portal-state-selected-fg`, `--portal-state-selected-border` | Tabs, nav rows, chips |
| **Disabled** | `--portal-state-disabled-opacity` (`0.5`), optional bg/fg/border | `disabled:` + no pointer events on buttons |
| **Loading** | Same opacity as disabled; keep layout size | Prefer `aria-busy` + spinner in later form work |

## Motion (minimal; full rules in `5.2.2.4`)

| Token | Value | Use |
|---|---|---|
| `--portal-motion-fast` | `120ms` | Micro feedback |
| `--portal-motion-normal` | `180ms` | Color / surface transitions |
| `--portal-motion-ease` | `ease` | Default easing |

Prefer `transition-colors` for controls; avoid layout-shifting transitions on buttons.

## Tailwind color bridges

| Utility | Maps to |
|---|---|
| `bg-portal-state-hover` | hover surface |
| `bg-portal-state-pressed` | pressed surface |
| `bg-portal-state-selected` | selected soft |
| `text-portal-state-selected-fg` | selected text |
| `bg-portal-danger-hover` | danger hover |
| `bg-portal-state-disabled-bg` / `text-portal-state-disabled-fg` | disabled surfaces |

## Usage rules

1. Interactive controls must show **focus-visible** (`.portal-focus-ring` or equivalent ring utilities).
2. Do not use hover-only affordances without a focus path.
3. Disabled controls: opacity token + `pointer-events-none` (or native `disabled`).
4. Selected ≠ hover: selected uses primary-soft; hover uses surface-secondary or soft tint.
5. DS-SHELL chrome keeps existing hover/active until an explicit visual task; new shared UI follows this doc.

## Smoke consumer

- `frontend/components/ui/button.tsx` — hover / active / focus / disabled / motion

## Owner visual check (after this task)

Confirm on `/sales/dashboard` and one settings page:

1. Primary / secondary / ghost / danger buttons: hover + press
2. Keyboard Tab: focus ring visible, not clipped
3. Disabled button (if present): faded, not clickable
4. Colors still Decision A (`#1f5eff`)
5. Cards still `rounded-portal-lg` + light card shadow
6. No horizontal page scroll; shell unchanged (sidebar/topbar)

Reply: `5.2.1 visual OK` or list issues.

## Status

Owner confirmation: **`5.2.1 visual OK`** (`2026-07-21`). Stage `5.2.1` closed.
