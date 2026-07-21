# Sport-Lead — Layout and Scrolling Audit

**Code:** `SL-LAYOUT-SCROLL-AUDIT-v1`
**Date:** `2026-07-21`
**Project version:** `v0.9.0`
**Git branch:** `feature/v0.8.1-nomenclature-core`
**Git commit:** `c9bee2b` (audit baseline)
**Related:** `docs/design-system/ui-audit.md`, `shell-contracts.md`, `page-design-checklist.md`

## Roadmap microtasks

- `[x]` `5.1.3.1` — Audit AppShell and workspace layouts
- `[x]` `5.1.3.2` — Audit page widths and content containers
- `[x]` `5.1.3.3` — Audit nested and double scrolling
- `[x]` `5.1.3.4` — Audit sticky and fixed elements
- `[x]` `5.1.3.5` — Define target scrolling rules

## Method

Static review of `AppShell`, workspace/sales layouts, `PageContent`, globals CSS for product-characteristics/nomenclature, and grep for `overflow`, `h-screen`/`h-dvh`, `sticky`, `fixed`. No production code changed. Full viewport matrix remains `5.1.4.*`.

---

## `5.1.3.1` — AppShell and workspace layouts

| Layer | Path | Behaviour |
|---|---|---|
| Root | `frontend/app/layout.tsx` | `body` is `flex h-full flex-col overflow-hidden` |
| Workspace | `frontend/app/(workspace)/layout.tsx` | wraps children in `AppShell` |
| Sales | `frontend/app/(workspace)/sales/layout.tsx` | pass-through (`return children`) — no extra chrome |
| Shell | `frontend/components/layout/app-shell.tsx` | `h-dvh overflow-hidden`; column: Topbar → WorkspaceTabs → `main[data-app-shell-main]` with `overflow-y-auto` |

**Findings**

1. Intended single primary vertical scroll owner: `[data-app-shell-main]`.
2. Sidebar has its own `overflow-y-auto` (allowed by DS-SHELL-01).
3. Characteristic detail rebuilds a full page grid with sticky local sidebar (`globals.css` `.product-characteristics-*`) — **bypasses AppShell content model** while still mounted under workspace layout (double chrome risk).
4. Nomenclature card uses page-level `bg`/`px` and internal sticky mobile bar patterns; still inside `main` scroll (acceptable if no second page-level `overflow-y-auto`).

---

## `5.1.3.2` — Page widths and content containers

| Mechanism | Location | Notes |
|---|---|---|
| `PageContent` | `page-layout.tsx` | `w-full min-w-0`; width variants `default` / `wide` / `full` set max-width only |
| Ad-hoc padding | many domain pages (`p-6`, nomenclature card `px-3 sm:px-6`) | Not all pages use `PageContent` |
| Tables | custom-fields, UoM, characteristics | `overflow-x-auto` wrappers + `min-width` tables |
| Kanban | `kanban-board.tsx` | horizontal `overflow-x-auto` for columns |

**Findings**

1. Mixed adoption of `PageContent` vs raw padded divs → inconsistent content max-width.
2. Wide tables correctly use local horizontal scroll (good).
3. Target: new PT pages must use `PageContent` (or documented full-bleed exception).

---

## `5.1.3.3` — Nested and double scrolling

| Area | Scroll owners | Assessment |
|---|---|---|
| Happy path workspace | `main` only (+ sidebar) | OK |
| Kanban board | `main` + horizontal board scroller | OK (orthogonal axes) |
| CompactTabs / stage chips | local `overflow-x-auto` | OK |
| Dialogs | `fixed` overlay + panel `overflow-y-auto` | OK (modal local scroll) |
| Search/Create dropdowns | topbar popup `max-h` + `overflow-y-auto` | OK per DS-SHELL-02 |
| Combobox/autocomplete lists | local `max-h` overflow | OK |
| Lead communication column | `overflow-hidden` on aside | Potential clipped content — verify in 5.1.4 |
| Product-characteristics page | sticky sidebar `height:100vh` + table wrap overflow + `main` scroll | **High risk of nested/competing vertical scroll** |
| Root `body overflow-hidden` + shell `h-dvh` | locks document scroll | Correct if `main` always scrolls |

---

## `5.1.3.4` — Sticky and fixed elements

| Element | Positioning | OK? |
|---|---|---|
| Platform Sidebar | sticky within shell column / compact fixed toggle | Yes (contract) |
| Topbar | in flow at top of content column | Yes |
| Topbar dropdowns | `absolute` under topbar, high z-index | Yes |
| Lead/order dialogs | `fixed inset-0` overlays z 200–240 | Yes |
| Media lightbox | `fixed inset-0` | Yes |
| Nomenclature mobile action bar | fixed bottom (card CSS) | Allowed local chrome; verify no clash with shell |
| Product-characteristics local sidebar | `position:sticky; top:0; height:100vh` | **Not OK** as platform pattern — conflicts with shell |

---

## `5.1.3.5` — Target scrolling rules

These rules become the checklist for later shell/page work (`5.3.2.5`, page checklist).

1. **One primary vertical scrollbar** for workspace pages: `[data-app-shell-main]`.
2. **Do not** put `h-screen` / `h-dvh` / `overflow-y-auto` on page roots inside `AppShell`.
3. **Local vertical scroll** is allowed only for: dialogs, dropdowns/popovers, combobox lists, chat/communication panes, explicitly bounded panels with `max-height`.
4. **Local horizontal scroll** is allowed for: kanban boards, wide tables, tab/chip strips.
5. **Sticky** elements inside `main` must not create a second viewport-tall column that competes with shell (no `height:100vh` sticky sidebars inside pages).
6. **Fixed** overlays must cover viewport, trap focus, and restore scroll lock without fighting `body overflow-hidden`.
7. **Page width** defaults to `PageContent` (`wide` unless PT says otherwise); full-bleed requires PT exception.
8. Characteristic detail and any future settings pages must use Platform Shell only — remove parallel sticky sidebars.
9. When adding nested panels, document which axis scrolls and the max-height source (`vh`/`dvh`/`px`).
10. Visual verification of scroll ownership is mandatory in `5.1.4.*` and after shell changes.

---

## Follow-ups (implementation later)

| Priority | Item | Target microtask |
|---|---|---|
| P1 | Remove product-characteristics local sidebar scroll model | shell-fix / PT-05 / B-bug |
| P2 | Standardize pages onto `PageContent` | `5.3.2.4` |
| P2 | Confirm lead communication column does not clip | `5.1.4` / lead polish |
| P3 | Inventory pages missing `PageContent` during PT migrations | `5.6.*` |

## Next

- `5.1.4.1` — Define responsive verification matrix
