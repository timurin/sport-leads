# Sport-Lead — Scrolling Ownership Standardization

**Code:** `SL-SHELL-SCROLLING-STD-v1`  
**Contract:** `DS-PAGE-05`  
**Date:** `2026-07-21`  
**Roadmap:** `5.3.2.5`  
**Source audit:** `docs/design-system/layout-scrolling-audit.md` (`5.1.3.5`)  
**Shell:** `frontend/components/layout/app-shell.tsx` (`[data-app-shell-main]`)

## Scope

Promote target scrolling rules from the audit into a **binding page-shell contract**. No DS-SHELL visual redesign.

## Primary owner

| Layer | Selector | Role |
|---|---|---|
| Document | `body` / `html` | `overflow-hidden` — no document scroll |
| Shell | `[data-app-shell]` | `h-dvh overflow-hidden` |
| Main | `[data-app-shell-main]` | **Sole primary vertical scrollbar** (`overflow-y-auto`) |
| Sidebar | DS-SHELL-01 | Own vertical scroll allowed |

## `DS-PAGE-05` rules

1. One primary vertical scrollbar for workspace pages: `[data-app-shell-main]`.
2. `PageLayout` / `PageContent` / page roots must **not** add `h-screen`, `h-dvh`, or page-level `overflow-y-auto`.
3. Local **vertical** scroll allowed only for: dialogs, dropdowns/popovers, combobox lists, chat/communication panes, explicitly bounded panels with `max-height`.
4. Local **horizontal** scroll allowed for: kanban boards, wide tables, tab/chip strips.
5. Sticky elements inside `main` must not create a second viewport-tall column (`height: 100vh` sticky sidebars forbidden as platform pattern).
6. Fixed overlays cover the viewport and must not fight `body overflow-hidden`.
7. When adding a nested scroller, document axis + max-height source (`vh` / `dvh` / `px`).

## Known exceptions (debt)

| Area | Issue | Follow-up |
|---|---|---|
| Product-characteristics detail | Local sticky sidebar `height:100vh` | PT-05 / dedicated bug — do not copy |
| Lead communication column | `overflow-hidden` may clip | verify in CRM polish |

## Verification

1. Navigate catalog / sales pages — only main column scrolls vertically.
2. Open CreateDrawer — drawer may scroll internally; main scroll restores after close.
3. Confirm: `DS-SHELL-01 visual contract preserved`, `DS-SHELL-02 visual contract preserved`.

## Status

Contract shipped for `5.3.2.5`. Owner spot-check recommended on characteristics page (known exception) — not a blocker to close the contract item.
