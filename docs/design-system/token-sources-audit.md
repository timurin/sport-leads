# Sport-Lead — Existing Token Sources Audit

**Code:** `SL-TOKEN-SOURCES-AUDIT-v1`  
**Date:** `2026-07-21`  
**Project version:** `v0.9.0`  
**Git branch:** `feature/v0.8.1-nomenclature-core`  
**Related:** `docs/design-system/README.md`, `visual-rules.md`, `shell-contracts.md`, `responsive-rules.md`  
**Roadmap:** `5.2.1.1`

## Verdict

There is a **documented portal token core** (`--portal-*` in `frontend/app/globals.css`), but the running UI is mostly **Tailwind default palette utilities** plus a **locked shell / reference hex system**. Treat portal CSS as the keep-list foundation; treat shell hex as a protected second palette to absorb in later microtasks; treat orphan TS tokens and module-local CSS as migrate/deprecate targets.

This task only **audits**. No new semantic token dictionary is defined here (`5.2.1.2+`).

## Roadmap microtask

- `[x]` `5.2.1.1` — Audit existing token sources

---

## 1. Token source inventory

| Role | Path | Status |
|---|---|---|
| Primary CSS tokens + Tailwind v4 `@theme` bridge | `frontend/app/globals.css` | **Keep as SoT** |
| Orphan TS token module | `frontend/lib/design-system/tokens.ts` | **Deprecate or rewrite** (unused; conflicts) |
| PostCSS / Tailwind v4 | `frontend/postcss.config.mjs`, `package.json` | Keep; no `tailwind.config.*` |
| Root layout (imports globals; no `next/font`) | `frontend/app/layout.tsx` | Keep |
| Docs: token list | `docs/design-system/README.md` | Keep; sync after `5.2.1.2+` |
| Docs: visual / responsive / checklist | `visual-rules.md`, `responsive-rules.md`, `page-design-checklist.md` | Keep; fix Geist claim |
| Shell contracts (locked look) | `shell-contracts.md` + `app-sidebar.tsx` / `top-navigation.tsx` | Keep protected; map into tokens later |
| HTML visual references | `docs/design/*.html` | Parallel palette — unify toward chosen primary |
| Module-local CSS | `--pc-*`, `[data-active-tab]` hex in `globals.css` | Deprecate into portal after color decision |

**Not found:** `--sl-*` prefix, SCSS/CSS modules, Framer Motion, `@keyframes` motion tokens, font npm packages, custom Tailwind breakpoint tokens.

---

## 2. Categorized inventory

### 2.1 Color

**Portal `:root` (intended SoT):**

| Token | Value |
|---|---|
| `--portal-page` | `#f6f8fc` |
| `--portal-surface` | `#ffffff` |
| `--portal-surface-secondary` | `#f8fafc` |
| `--portal-border` | `#e2e8f0` |
| `--portal-text` | `#0f172a` |
| `--portal-text-muted` | `#64748b` |
| `--portal-primary` | `#2563eb` |
| `--portal-primary-hover` | `#1d4ed8` |
| `--portal-success` | `#059669` |
| `--portal-warning` | `#d97706` |
| `--portal-danger` | `#dc2626` |

`@theme inline` registers colors as Tailwind utilities (`portal-page`, `portal-primary`, …). **Not** registered: radius, shadow, spacing, control sizes.

**Competing palettes:**

| Family | Examples | Where |
|---|---|---|
| Shell / PC / HTML primary | `#1f5eff`, `#174bd8`, `#3678ff` | `app-sidebar.tsx`, nomenclature/PC CSS, `docs/design/*` |
| Shell text / border | `#101828`, `#dfe5ef`, `#475467` | Shell + settings cards |
| Tailwind slate/blue/red/… | `bg-slate-*`, `text-blue-*` | Dominant styling (~hundreds of class uses) |
| Chart / media hex | various | dashboard chart, media gallery |

### 2.2 Typography

| Claimed | Actual |
|---|---|
| Docs: Geist + Inter fallback | Geist **not loaded** |
| `--font-geist-sans` | Value is `Inter, "Segoe UI", Arial, sans-serif` |
| `next/font` | Not used |
| Doc type scale (24 / 20 / 14–16 / 14 / 11–12) | **Not encoded** as CSS tokens |
| Lead workspace | `font-size: 13px` override on `[data-lead-workspace]` |

### 2.3 Spacing

- Defined: `--portal-space-1…8` (4–32 px)
- **`var(--portal-space-*)` usage in product UI: effectively unused**
- Real spacing = Tailwind `p-*` / `gap-*` + hardcoded px in module CSS

### 2.4 Radius and shadows

| Portal token | Value | Notes |
|---|---|---|
| `--portal-radius-sm…xl` | 6 / 8 / 12 / 16 | Used via `rounded-[var(--portal-radius-*)]` in some sales/UI |
| `--portal-shadow-sm|card|overlay` | defined | Partial adoption; topbar also inlines overlay-like shadow |
| Competing | Tailwind `rounded-lg/xl`, PC `14px`, shell `9px` | |
| `uiTokens.radius/shadow` | Tailwind class strings ≠ CSS vars | Dead module |

### 2.5 Component / layout sizes

| Token | Value | Conflict |
|---|---|---|
| `--portal-control-compact/default/spacious` | 32 / 40 / 44 | Unused; Button uses `h-8` / `h-10` / `h-11` |
| `--portal-sidebar-width` | `92px` | DS-SHELL-01 uses **260 / 72** |
| `--portal-content-max` | `1760px` | `uiTokens` says **1800**; `PageContent` also uses Tailwind max widths |
| Grid helpers | `.portal-grid-small|medium|large` | 230 / 300 / 390 — keep as layout helpers |

### 2.6 Breakpoints (three systems — detail in `5.2.2.1`)

1. Tailwind defaults in JSX (`sm` / `md` / `lg` / …)
2. Docs bands in `responsive-rules.md` (1500 / 1200 / 768 / 767 / 600)
3. Custom media + container queries in `globals.css` (lead / nomenclature)

Shell: sidebar hidden below `md` (≤767); topbar desktop nav from `lg`.

### 2.7 Z-index (no tokens — ladder for `5.2.2.3`)

| Layer | Typical values |
|---|---|
| Sticky / local | `z-10`, `z-20` |
| Menus | `z-30`, `z-50` |
| Shell / topbar popups | `z-40`, `z-50`, `z-[100]`, `z-[120]` |
| Modals | `z-[200]` … `z-[240]` |

### 2.8 Motion

No motion tokens. Mostly `transition-colors` / Tailwind defaults; rare `animate-pulse`. Define in `5.2.2.4`.

---

## 3. Critical conflicts

1. **Two primary blues:** `--portal-primary` `#2563eb` vs shell/reference `#1f5eff`.
2. **Two neutral greys:** portal slate-ish vs shell `#101828` / `#dfe5ef`.
3. **Three styling channels:** CSS vars ↔ Tailwind palette ↔ arbitrary hex.
4. **`uiTokens` dead + wrong:** never imported; content max / radius / sidebar disagree with CSS and shell.
5. **Font naming debt:** “Geist” in docs and CSS variable names; Inter-only delivery.
6. **Incomplete `@theme`:** colors only → inconsistent consumption (`bg-portal-*` vs `rounded-[var(...)]`).
7. **Sidebar width token 92** contradicts protected shell widths.

---

## 4. Keep / unify / deprecate

| Item | Decision for later work |
|---|---|
| `--portal-*` in `globals.css` + `@theme` colors | **Keep** as platform SoT; expand `@theme` when scales are defined |
| Docs pointing at `--portal-*` | **Keep**; correct Geist claim in `5.2.1.3` |
| Shell hex (DS-SHELL-01/02) | **Keep temporarily**; map into tokens without restyling unless visual task |
| HTML `docs/design/*` palettes | **Unify** after primary-blue decision |
| `--pc-*` / `[data-active-tab]` hex | **Deprecate into portal** after color decision |
| `lib/design-system/tokens.ts` | **Deprecate or rewrite** to re-export CSS var names only |
| Tailwind slate/blue sprawl | **Unify gradually** (`5.2.2.5` migration plan); no new raw palette in shared UI |
| `--portal-space-*`, `--portal-control-*` | **Keep definitions**; wire or formally prefer Tailwind scale in `5.2.1.4` / `5.2.1.6` |
| `--font-geist-*` | **Rename or load Geist** in `5.2.1.3` |
| `--background` / `--foreground` | **Unify** with portal page/text or drop |
| New `--sl-*` prefix | **Do not invent** |

### Product decision required in `5.2.1.2`

Choose **one** primary blue:

- **A)** Portal adopts `#1f5eff` (align with shell + HTML references), or  
- **B)** Shell/settings migrate to `#2563eb` (requires explicit visual approval for DS-SHELL).

**Accepted 2026-07-21: A.** Evidence: `docs/design-system/color-tokens.md`. Portal primary/neutrals published; shell JSX hex left under DS-SHELL contract (values now match).

---

## 5. Gaps vs a proper token system

- No single published dictionary (CSS + typed exports + docs in sync)
- Thin semantic color set (missing hover/focus/disabled/selected surfaces as tokens)
- No typography / spacing-as-used / z-index / motion / breakpoint token scales
- Spacing & control CSS vars defined but unused
- Status tones live in components / dead `uiTokens.status`, not CSS vars
- Light-only (`color-scheme: light`)
- Shell hex locked until mapped under contract rules
- Adoption inverted: Tailwind defaults dominate over `portal-*` utilities

---

## 6. Evidence checklist (files read)

- `frontend/app/globals.css` (`:root`, `@theme`, module islands)
- `frontend/lib/design-system/tokens.ts` (orphan; zero imports)
- `frontend/postcss.config.mjs`, `frontend/app/layout.tsx`, `frontend/package.json`
- `frontend/components/navigation/app-sidebar.tsx`, `top-navigation.tsx`
- `frontend/components/ui/button.tsx` (portal + Tailwind mix)
- `docs/design-system/README.md`, `visual-rules.md`, `shell-contracts.md`, `responsive-rules.md`

---

## 7. Next microtask

`5.2.1.2` — Define semantic color tokens (resolve primary-blue conflict; publish semantic surfaces/tones; do not restyle shell without approval).
