# Sport-Lead — Modal vs CreateDrawer Boundaries

**Code:** `SL-CREATE-MODAL-BOUNDARIES-v1`  
**Date:** `2026-07-21`  
**Roadmap:** `5.4.2.3.7`  
**ADR:** `ADR-013-create-inspector-drawer.md`

## Rule

| Action | Shell |
|---|---|
| Create entity / catalog item | **CreateDrawer** (`docked` or `overlay`) |
| Confirm / delete / one-shot warning | Centered modal dialog (allowed) |
| Demo create stub (no API yet) | **CreateDrawer overlay** + honest demo copy (`DemoCreateDrawer`) |
| Narrow edit popovers already on card | Existing domain dialogs until a later migration |

## Variants

- **docked** — workspace has a right inspector column (nomenclature / materials pattern).
- **overlay** — no inspector column (leads kanban, orders/deals/tasks, clients).

## Centered create modals

Forbidden for persistent entity create. `DemoActionDialog` re-exports `DemoCreateDrawer` for compatibility and must not be used for new work.

## Visual verification checklist (owner)

1. `/sales/leads` — «Создать лид» opens **right overlay** CreateDrawer (not centered modal).
2. `/sales/orders`, `/sales/deals`, `/sales/tasks` — create opens right overlay demo drawer.
3. `/sales/clients` — «Создать клиента» same overlay pattern.
4. `/settings/catalogs/custom-fields` — «Создать → Реквизит» docks CreateDrawer; no inline create card.
5. `/settings/catalogs/nomenclature` — create still docked right.
6. Shell: `DS-SHELL-01 visual contract preserved`, `DS-SHELL-02 visual contract preserved`.

Reply: `5.4.2 visual OK` or list issues.

## Status

Owner confirmation: **`5.4.2 visual OK`** (`2026-07-21`).
