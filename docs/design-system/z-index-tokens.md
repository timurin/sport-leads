# Sport-Lead — Z-Index Layers

**Code:** `SL-Z-INDEX-TOKENS-v1`  
**Date:** `2026-07-21`  
**Roadmap:** `5.2.2.3`  
**Source:** `frontend/app/globals.css`  
**Utilities:** `z-portal-*`

## Scale (current product ladder)

| Layer | Token | Value | Use |
|---|---|---|---|
| Base | `--portal-z-base` | 0 | Default flow |
| Raised | `--portal-z-raised` | 10 | Sticky table heads, focus steps |
| Sticky | `--portal-z-sticky` | 20 | Local sticky chrome inside main |
| Dropdown | `--portal-z-dropdown` | 30 | In-card menus |
| Shell | `--portal-z-shell` | 40 | Topbar stacking context |
| Shell float | `--portal-z-shell-float` | 50 | Action menus, listboxes |
| Popover | `--portal-z-popover` | 100 | Topbar section dropdowns |
| Search | `--portal-z-search` | 120 | Full-width search panel |
| Modal | `--portal-z-modal` | 200 | Base modal backdrop |
| Modal +1…+4 | `--portal-z-modal-1`…`4` | 210–240 | Nested/stacked dialogs |
| Toast | `--portal-z-toast` | 300 | Future toasts |

## Rules

1. New overlays must pick the **lowest** layer that stacks correctly.
2. Do not invent one-off `z-[9999]`.
3. Modal ladder 200–240 preserves existing lead dialog stacking (wired in 5.2.2.3 smoke).
4. Shell popover/search values match prior `z-[100]` / `z-[120]` (no visual change).

## Smoke wiring

- Topbar: `z-portal-shell` / `popover` / `search`
- `ActionMenu`: `z-portal-shell-float`
- Lead/demo dialogs: `z-portal-modal` … `modal-4`
