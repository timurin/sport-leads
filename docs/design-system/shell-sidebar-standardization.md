# Sport-Lead — Platform Sidebar Standardization

**Code:** `SL-SHELL-SIDEBAR-STD-v1`  
**Date:** `2026-07-21`  
**Roadmap:** `5.3.1.1`  
**Component:** `frontend/components/navigation/app-sidebar.tsx`  
**Contract:** `DS-SHELL-01` (`docs/design-system/shell-contracts.md`)

## Scope

Tokenize sidebar chrome **without visual redesign**:

- widths → `--portal-shell-sidebar-expanded|compact` (260 / 72)
- header height → `--portal-shell-topbar` (72)
- colors → portal primary/page/border/text + shell-local neutrals (`--portal-shell-nav`, `--portal-shell-ink`, …)
- radius 9px → `--portal-shell-radius`
- logo gradient → `--portal-primary-gradient-*`
- z-index restore button → `z-portal-shell-float`

Navigation still comes only from `frontend/lib/navigation.ts`.

## Shell-local tokens (exact approved hex)

| Token | Value | Role |
|---|---|---|
| `--portal-shell-nav` | `#475467` | Default nav text |
| `--portal-shell-ink` | `#263244` | Sidebar ink |
| `--portal-shell-group-title` | `#344054` | Group label |
| `--portal-shell-group-line` | `#e7ecf4` | Group chip border |
| `--portal-shell-avatar-bg` | `#eef3ff` | Profile chip |
| `--portal-shell-avatar-fg` | `#175cd3` | Profile initials |
| `--portal-shell-radius` | `9px` | Nav row radius |

## Unchanged behaviour

- `sport-lead-sidebar-mode` storage
- expanded / compact / hidden modes
- mobile `hidden md:flex`
- section expand-on-row-click
- profile footer placement

## Verification (owner)

1. Expanded sidebar 260px — active/hover look unchanged  
2. Compact 72px — icons only  
3. Toggle compact from top and bottom  
4. Mobile ≤767 — sidebar absent  

Confirm: `DS-SHELL-01 visual contract preserved`

## Status

Owner confirmation: **`DS-SHELL-01 visual OK`** (`2026-07-21`).
