# Sport-Lead — Responsive Navigation (Platform Shell)

**Code:** `SL-SHELL-RESPONSIVE-NAV-v1`  
**Date:** `2026-07-21`  
**Project version:** `v0.9.0`  
**Roadmap:** `5.3.1.4`  
**Contracts:** `DS-SHELL-01`, `DS-SHELL-02` (`docs/design-system/shell-contracts.md`)  
**Breakpoints:** `docs/design-system/breakpoint-tokens.md`  
**Implementation:** `frontend/components/navigation/app-sidebar.tsx`, `frontend/components/navigation/top-navigation.tsx`  
**Nav source:** `frontend/lib/navigation.ts`

## Goal

Define how platform navigation adapts across viewports **without redesigning** the approved sidebar/topbar look. This document is the shell-level contract for `5.3.1.4`; page templates (PT-*) may add local responsive rules later.

## Breakpoint anchors (shell only)

| Token / Tailwind | Width | Shell role |
|---|---|---|
| `--portal-bp-mobile-max` / below `md` | ≤767 px | **Mobile:** no left sidebar |
| `--portal-bp-tablet-min` / `md` | ≥768 px | Sidebar may show (expanded or compact) |
| `--portal-bp-laptop-min` / `lg` | ≥1024 px | Desktop in-section topbar nav |
| `--portal-bp-desktop-min` / `xl` | ≥1280 px | Wider search field in topbar |
| Topbar height | `sm`→`md` | `64px` → `72px` (`--portal-shell-topbar-sm` / `--portal-shell-topbar`) |

Viewport breakpoints apply to **platform chrome only**. Nested workspaces prefer container queries (see `responsive-rules.md`).

## Behaviour matrix

| Band | Sidebar (DS-SHELL-01) | Topbar section nav (DS-SHELL-02) | How user reaches other platform sections |
|---|---|---|---|
| **Mobile** ≤767 | Hidden (`hidden md:flex`) | Compact menu button (`lg:hidden`) | Compact menu lists **all** `appSections`, then current section `topNavigation` |
| **Tablet** 768–1023 | Visible; expanded `260px` or compact `72px` (`localStorage` `sport-lead-sidebar-mode`) | Compact menu (desktop strip still `hidden` until `lg`) | Sidebar sections **or** compact menu (sections + section routes) |
| **Laptop+** ≥1024 | Same as tablet | Horizontal in-section nav (`lg:flex`) | Sidebar only for switching top-level sections |
| **User hid sidebar** (`mode=hidden`, `md+` only) | Floating restore button top-left | Unchanged | Restore sidebar or use topbar routes |

## Component responsibilities

### Sidebar

1. Never shown below `md` — no alternate mobile drawer for the left rail.
2. Modes on `md+`: `expanded` | `compact` | `hidden` (hidden is user-triggered, not viewport-driven).
3. Structure only from `appSections` / `topNavigation` via `navigation.ts`.
4. Compact mode must not introduce horizontal scroll.

### Topbar

1. Heights: 64 → 72 from `md`.
2. In-section links: desktop strip from `lg`; below `lg` — hamburger compact menu.
3. Compact menu content:
   - block **Разделы** → `appSections` (required on mobile because sidebar is gone; also present on tablet/laptop when compact menu is used);
   - block **current section** → that section’s `topNavigation` (groups with children expand in place).
4. Global Search: icon button below `xl`, wider field from `xl`; full-width search mode unchanged.
5. Global Create: always visible in topbar (wiring is a separate task; placement is part of DS-SHELL-02).
6. Dropdowns/popups: close on toggle, select, outside click, route change, `Escape`; stay in viewport; no page horizontal scroll.

### AppShell

- Single flex row: sidebar (when visible) + content column with topbar + main scroll (`[data-app-shell-main]`).
- No second global scrollbar from page roots.

## Explicit non-goals (`5.3.1.4`)

- Redesign of DS-SHELL-01 / DS-SHELL-02 visuals.
- Replacing compact menu with a full-screen mobile nav app shell.
- Backend search / Create business logic.
- Page-template responsive rules (PT-01…PT-07) — later stages.
- Keyboard-only / keyboard-first platform navigation — **out of scope** (product `2026-07-21`; former `5.3.1.5` removed).

## Verification checklist (definition acceptance)

Confirm against matrix viewports **390 / 768 / 1024 / 1280** (spot 1440/1920 as needed):

- [ ] ≤767: no left sidebar; hamburger opens sections + current section routes
- [ ] ≥768: sidebar visible (unless user-hidden); compact/expanded widths 72/260
- [ ] &lt;1024: no desktop horizontal section strip; hamburger present
- [ ] ≥1024: desktop section strip; hamburger hidden
- [ ] Search / Create remain reachable; no horizontal page scroll
- [ ] `DS-SHELL-01 visual contract preserved`
- [ ] `DS-SHELL-02 visual contract preserved`

Owner visual pass for responsive bands was already recorded under `5.1.4` (`responsive-audit.md`). This microtask **codifies** that behaviour as the shell navigation contract.

## Related

- `shell-sidebar-standardization.md` (`5.3.1.1`)
- `shell-topbar-standardization.md` (`5.3.1.2`)
- `responsive-audit.md` (`5.1.4`)
- `breakpoint-tokens.md` (`5.2.2.1`)
