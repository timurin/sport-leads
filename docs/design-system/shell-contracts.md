# Sport-Lead — Protected Platform Shell Contracts

**Codes:** `DS-SHELL-01`, `DS-SHELL-02`  
**Canonical UI:** `frontend/components/navigation/app-sidebar.tsx`, `frontend/components/navigation/top-navigation.tsx`  
**Shell wrapper:** `frontend/components/layout/app-topbar.tsx` must not contain an alternate topbar implementation.  
**Navigation source of truth:** `frontend/lib/navigation.ts`

`DS-SHELL-01` and `DS-SHELL-02` form the protected Platform Shell.

## DS-SHELL-01 — Platform Sidebar

Approved look and behaviour:

- expanded width `260px`; compact width `72px`;
- on viewports below `md` (≤767 px) the sidebar is not shown; platform and section navigation use the topbar compact menu;
- light background and SPORT-LEAD visual system;
- logo `SL` and title `SPORT-LEAD`;
- section/subsection grouping;
- expand/collapse on the full row click;
- active section and route highlighting;
- own vertical scroll, no horizontal scroll;
- compact mode stored in `localStorage` key `sport-lead-sidebar-mode`;
- top and bottom toggles use the same compact mode;
- user profile stays in the fixed bottom area.

Forbidden without an explicit user visual task:

- widths, colors, background, borders, radii, typography;
- logo size/placement;
- item sizes, paddings, heights;
- existing section icons;
- active/hover/focus states;
- subsection expand structure;
- scrolling/overflow;
- profile placement;
- compact-mode mechanics and storage key;
- overall `AppSidebar` JSX frame;
- subsection header visual style.

Allowed without redesign:

- add routes/groups via `frontend/lib/navigation.ts` / `topNavigation`;
- rename routes by product task;
- add a Lucide icon for a new top-level section;
- fix confirmed functional bugs without visual redesign;
- improve accessibility without changing the approved look.

Navigation rules:

1. Menu structure comes only from `frontend/lib/navigation.ts`.
2. Top-level sections come from `appSections`.
3. Subsections come from `topNavigation`.
4. Do not hardcode duplicate links inside `app-sidebar.tsx`.
5. New routes join an existing logical group.
6. New top-level sections are only for major platform modules.
7. Long labels must fit or ellipsize; no horizontal scroll.
8. After navigation changes, verify expanded and compact modes.
9. Any visual change to `DS-SHELL-01` needs a separate task and user visual confirmation.

Navigation report fields:

- changed routes and menu groups;
- expanded mode check;
- compact mode check;
- confirmation: `DS-SHELL-01 visual contract preserved`.

## DS-SHELL-02 — Platform Topbar

Approved composition and behaviour:

- height `64px` on small screens, `72px` from `md`;
- light background, bottom border, SPORT-LEAD visual system;
- active top-level section title;
- in-section navigation from `frontend/lib/navigation.ts`;
- desktop nav from `lg`; tablet/mobile use compact section menu;
- on mobile (≤767 px) the compact menu also lists top-level `appSections` (sidebar is hidden);
- global Search and Create actions;
- dropdown closes on toggle, item select, outside click, route change, `Escape`;
- popups stay in viewport; no horizontal page scroll from topbar;
- title may ellipsize; focus/hover/active states are part of the contract.

Global search behaviour:

- expands to full available topbar width and autofocuses;
- closes via close control, `Escape`, or result navigation;
- empty query shows quick links; typing shows section/route hints from `navigation.ts`;
- backend search is a separate task; navigation hints remain a result group after backend lands;
- popup has max height and own vertical scroll;
- empty results are explicit; never fake demo hits for API failures.

Responsibility split:

### Platform Topbar may contain only

- active section title;
- section navigation;
- global search;
- global create;
- adaptive section menu.

### Page Header / Page Toolbar stay on the page and may contain

- page/entity title, breadcrumbs, document status;
- local filters and view modes;
- entity actions (save/edit/delete/post).

Pages must not invent an alternate global topbar.

Forbidden without an explicit user visual task:

- height, background, border, radii, core typography;
- section title placement;
- desktop/tablet/mobile breakpoint behaviour;
- active/hover/focus states;
- active section/route resolution;
- dropdown structure;
- full-width search mode;
- Search/Create placement;
- tablet/mobile compact menu;
- `TopNavigation` JSX frame;
- Topbar vs Page Toolbar split;
- existing SPORT-LEAD visual language.

Allowed without redesign:

- add routes/groups via `navigation.ts`;
- connect backend search or Create business logic by dedicated task;
- add search result types;
- fix confirmed functional bugs;
- accessibility and performance without visual change.

Shared navigation rules with the sidebar apply. Additionally:

- do not hardcode routes inside `top-navigation.tsx`;
- dropdowns must not clip under parent overflow;
- verify topbar with expanded and compact sidebar;
- Page Toolbar must not host platform global navigation;
- any visual change to `DS-SHELL-02` needs a separate task and user visual confirmation.

After topbar changes, verify at least:

`/dashboard`, `/sales/leads`, lead card, `/sales/orders`, order card, `/settings`, `/settings/catalogs/nomenclature`, nomenclature card, expanded/compact sidebar, desktop/laptop/tablet/mobile, dropdown, full-width search, search hints, Escape close, no horizontal scroll, no overlaps, keyboard focus.

Shell report fields:

- changed components, routes, groups;
- expanded/compact sidebar checks;
- desktop/tablet/mobile checks;
- dropdown and global search checks;
- confirmations: `DS-SHELL-01 visual contract preserved`, `DS-SHELL-02 visual contract preserved`.
