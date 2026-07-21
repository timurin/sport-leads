# Sport-Lead — Component Sizes

**Code:** `SL-COMPONENT-SIZE-TOKENS-v1`  
**Date:** `2026-07-21`  
**Project version:** `v0.9.0`  
**Roadmap:** `5.2.1.6`  
**Source of truth:** `frontend/app/globals.css`  
**Typed mirror:** `frontend/lib/design-system/tokens.ts` (`controlSizeTokens`)

Density modes match `visual-rules.md`: `compact` | `default` | `spacious`.

## Control heights

| Density | CSS variable | px | Tailwind height | Use |
|---|---|---|---|---|
| Compact | `--portal-control-compact` | 32 | `h-portal-control-compact` | Dense CRM controls, icon buttons |
| Default | `--portal-control-default` | 40 | `h-portal-control-default` | Buttons, text inputs |
| Spacious | `--portal-control-spacious` | 44 | `h-portal-control-spacious` | Onboarding / rare large CTA |
| Icon hit | `--portal-control-icon` | 32 | `size-portal-control-icon` | Square icon-only controls |

Inputs and primary buttons share the same height for a given density.

## Icon glyph sizes

| Token | CSS | px | Typical Lucide `size` |
|---|---|---|---|
| SM | `--portal-icon-sm` | 14 | 14 |
| MD | `--portal-icon-md` | 16 | 16 (default in menus) |
| LG | `--portal-icon-lg` | 18 | 18 |
| XL | `--portal-icon-xl` | 20 | 20 (shell toggles) |

Utilities: `size-portal-icon-md` (via `--spacing-portal-icon-*`).

## Avatar

| Token | CSS | px |
|---|---|---|
| SM | `--portal-avatar-sm` | 24 |
| MD | `--portal-avatar-md` | 32 |
| LG | `--portal-avatar-lg` | 40 |

## Shell reference (locked)

Documented for alignment; changing live shell still needs an explicit visual task.

| Token | Value | Contract |
|---|---|---|
| `--portal-shell-topbar-sm` | 64px | DS-SHELL-02 small screens |
| `--portal-shell-topbar` | 72px | DS-SHELL-02 from `md` |
| `--portal-shell-sidebar-expanded` | 260px | DS-SHELL-01 |
| `--portal-shell-sidebar-compact` | 72px | DS-SHELL-01 |

`--portal-sidebar-width` is a **deprecated alias** of compact sidebar (was incorrectly `92px`).

Content max width: `--portal-content-max` (`1760px`) — content rules continue in `5.2.2.2`.

## Density ↔ other tokens

| Density | Control height | PageContent padding | Type for control label |
|---|---|---|---|
| compact | 32 | space 3→4 | caption / meta |
| default | 40 | space 4→6 | body |
| spacious | 44 | space 5→8 | body |

## Usage rules

1. New buttons/inputs use `h-portal-control-*`, not raw `h-8` / `h-10` / `h-11`.
2. Icon-only controls use `size-portal-control-icon`.
3. Do not invent a fourth control height.
4. Status badges use typography scale + radius-full; they are not full control heights.

## Smoke consumers in this task

- `Button`, `ActionMenu` trigger, `StatusBadge`, `CityAutocomplete` default input
