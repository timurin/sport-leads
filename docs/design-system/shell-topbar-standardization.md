# Sport-Lead — Platform Topbar Standardization

**Code:** `SL-SHELL-TOPBAR-STD-v1`  
**Date:** `2026-07-21`  
**Roadmap:** `5.3.1.2`  
**Component:** `frontend/components/navigation/top-navigation.tsx`  
**Contract:** `DS-SHELL-02` (`docs/design-system/shell-contracts.md`)

## Scope

Tokenize topbar chrome without changing structure/behaviour:

- heights → `--portal-shell-topbar-sm` (64) / `--portal-shell-topbar` (72 from `md`)
- surfaces/borders/text → portal tokens
- brand actions / active nav → Decision A primary (`portal-primary*`)
- focus → `portal-focus-ring`
- dropdowns/search panel → `shadow-portal-overlay`, `z-portal-popover|search`
- Create CTA → `bg-portal-primary` / `hover:bg-portal-primary-hover`

Navigation still from `frontend/lib/navigation.ts` only. Mobile menu still includes platform sections + section links.

## Unchanged behaviour

- Full-width search open/focus/Escape/close
- Desktop nav from `lg`; compact section menu below `lg`
- Dropdown close rules (toggle, select, outside, route, Escape)
- Title ellipsis; no horizontal page scroll from topbar

## Product updates (`2026-07-21`)

- Section title label removed from the topbar (nav links remain).
- `WorkspaceTabs` strip removed from `AppShell` on all pages.

## Verification (owner)

1. `/dashboard` or `/sales/leads` — title + desktop nav (`lg+`)
2. Search open — full width, hints, Escape
3. Create + mobile menu (`<lg`) — sections list
4. Expanded + compact sidebar with topbar
5. Active nav underline uses portal primary

Confirm: `DS-SHELL-02 visual contract preserved`
