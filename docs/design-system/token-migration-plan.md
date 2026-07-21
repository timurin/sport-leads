# Sport-Lead — Token Migration Plan

**Code:** `SL-TOKEN-MIGRATION-PLAN-v1`  
**Date:** `2026-07-21`  
**Roadmap:** `5.2.2.5`  
**Depends on:** `5.2.1.*`, `5.2.2.1–4`, `token-sources-audit.md`

## Goal

One token SoT (`--portal-*` in `globals.css` + docs + `tokens.ts`) with gradual UI adoption. No big-bang restyle of DS-SHELL or domain pages.

## Phases

### Phase A — Foundations (done in 5.2.1 / 5.2.2)

| Area | Status |
|---|---|
| Color (Decision A `#1f5eff`) | Done |
| Typography / spacing / surface / control / interaction | Done |
| Breakpoints / content width / z-index / motion | Done |
| Canonical docs under `docs/design-system/*-tokens.md` | Done |

### Phase B — Shared UI (`5.4`)

1. Forms (`5.4.1`): inputs/selects use control heights + portal borders/focus.
2. Buttons/menus/badges: already partially wired — finish remaining `slate`/`blue` utilities.
3. StatusBadge domain maps: move off Tailwind emerald/amber raw classes.
4. Forbid new raw hex in `frontend/components/ui/**` (lint/review).

### Phase C — Shell (`5.3`)

1. Map sidebar/topbar hex → CSS vars **without** changing approved look (same values).
2. Keep DS-SHELL visual contract; any look change needs owner visual task.
3. Replace remaining arbitrary shadows on topbar with `shadow-portal-overlay`.

### Phase D — Domain pages (`5.5` templates + settings/sales)

1. Nomenclature / characteristics: drop leftover `#1f5eff` literals → `portal-primary`.
2. Lead workspace: replace ad-hoc blues with portal tokens during PT work.
3. Kanban/tables: local overflow only; widths from content tokens.
4. Charts: series colours may stay explicit hex but brand series = primary.

### Phase E — Cleanup

1. Delete unused `--pc-*` once all consumers use portal aliases.
2. Remove deprecated `--font-geist-*` names after full rename sweep.
3. Keep `uiTokens` only as re-export; prefer named `*Tokens`.
4. Update HTML references in `docs/design/` to point at portal token names.

## Keep / unify / deprecate (summary)

| Item | Action |
|---|---|
| `--portal-*` + `@theme` | **Keep** SoT |
| Shell hex matching Decision A | **Unify** to vars in Phase C (no visual delta) |
| Tailwind slate/blue sprawl | **Unify** gradually Phases B–D |
| `uiTokens` layout 1800/92 | **Deprecated** (fixed in 5.2.1) |
| Module `--pc-*` hex | **Deprecate** (already aliased) |
| One-off `z-[999]` | **Forbid** — use z-index tokens |

## Exit criteria for “tokens complete”

- [ ] No new hex in shared UI without token registration
- [ ] Shell chrome uses portal vars for colors/z-index (look unchanged)
- [ ] Domain templates (PT-*) documented against portal tokens
- [ ] Migration checklist above closed or tracked as open bugs

## Manual QA

Not required for Phase A token definitions (values unchanged).  
Visual QA returns when Phase C/D change visible styling beyond token aliases.
