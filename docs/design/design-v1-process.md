# Sport-Lead — Design v1.0 process

**Code:** `SL-DESIGN-V1-PROCESS-v1`  
**Date:** `2026-08-05`  
**Roadmap:** Stage `22` (`SL-ROADMAP-v1.00`)  
**Related:** `docs/design/`, `docs/tasks/v1.00-stage-22-design-v1.md`, Stage `20` (closed UX data contracts)

## Purpose / Цель

Rules for Design v1.0: HTML etalons → owner approval → platform microtasks under Stage **22**. Soft UI applies to **page content** inside `PageLayout`. Live shell `DS-SHELL-01` / `DS-SHELL-02` changes only via Stage **`22.9`** after owner visual on the shell etalon.

Правила Design v1.0: HTML-эталон → visual OK → микротаски Stage **22**. Soft UI — контент страницы; live shell — только через **`22.9`**.

## Etalon-first / Сначала эталон

1. New screen → HTML under `docs/design/{section}/…-reference-vN.html` (+ shared CSS/JS if needed).
2. Link it from `docs/design/index.html` with demo route ≈ platform URL.
3. Owner **HTML visual OK** before any FE migration microtask.
4. Mark etalon **approved** on the index (and in Stage `22.0.2` registry) only after owner confirmation.

## Add section `22.N` / Новый раздел

Allowed when owner names a platform module **and** either:

- at least one approved HTML etalon exists, **or**
- an explicit TBD scaffold placeholder is added (one open microtask «await approved etalon»).

Same `22.N` / `22.N.M` codes must appear in MD + HTML twin in the **same** iteration.

## Add microtask `22.N.M` / Новая микрозадача

1. One logical problem only.
2. Bilingual title (EN + RU) in `roadmap-v1.00.md`.
3. Evidence path (etalon and/or FE host) after the em dash when closed.
4. **No new business fields/API** without a separate roadmap/API item (Stage 22 = visual/layout chrome).
5. Atomic MD ↔ HTML twin (`done: true/false` matches `[x]`/`[ ]`).

## Patches / Патчи

| Case | How |
|------|-----|
| Visual follow-up on an open/closed microtask | `22.N.M.P` or `B*` under Stage 22 |
| Approved etalon changes | Bump HTML to `vN+1`, re-approve, add patch microtasks **before** FE |
| Silent FE drift from etalon | Forbidden — stop and add a patch microtask |

Do not reopen Stage **20** data contracts (`20.1`–`20.4`). Stage 22 may restyle hosts; it does not undo need-cleanup, collaboration XOR, or client-need sync.

## Boundaries / Границы

- Soft UI **page content** migrates under `22.1`–`22.8` without changing live shell by default.
- Soft UI **shell chrome** (left + top) has a dedicated preview etalon `docs/design/shared/shell-reference-v1.html` and Stage **`22.9`**. Live `DS-SHELL-01/02` stay frozen until owner HTML visual OK **and** an explicit FE microtask — never drive shell changes from content-only items.
- ≠ Invent list/kanban boards until their etalon is approved (Sales boards still TBD `22.3`).
- ≠ Demo substitution for live API on platform routes.
- Prefer portal tokens / existing `Button`; Soft UI tokens land via Stage 22 FE items, not ad-hoc globals without a microtask.

## Approved etalons (registry seed)

| Screen | Etalon | Platform host | Stage block | Status |
|--------|--------|---------------|-------------|--------|
| Lead card | `docs/design/sales/lead-card-reference-v1.html` | `/sales/leads/[id]` → `lead-page.tsx` | `22.1` | **Owner approved** |
| Sales order card | `docs/design/sales/order-card-reference-v1.html` | `/sales/orders/[id]` → `sales-order-page.tsx` | `22.2` | **Owner approved** |
| Production workspace | `docs/design/production/orders-workspace-reference-v1.html` | `/production/orders` → `production-orders-workspace.tsx` | `22.4` | **Owner approved** (`22.4.1`, `2026-08-22`) |
| Warehouse stock | `docs/design/warehouse/stock-workspace-reference-v1.html` | `/warehouse/stock` | `22.5` | **Owner approved** (`22.5.1`, `2026-08-22`) |
| Purchases hub | `docs/design/purchases/hub-reference-v1.html` | `/purchases` → `purchases-hub-workspace.tsx` | `22.6` | **Owner approved** (`22.6.1`, `2026-08-22`); FE `22.6.3` |
| Settings hub | `docs/design/settings/hub-reference-v1.html` | `/settings` | `22.7` | **Owner approved** (`22.7.1`, `2026-08-22`) |
| Dashboard / Home | `docs/design/dashboard/home-reference-v1.html` | `/dashboard` | `22.8` | **Owner approved** (`22.8.1`, `2026-08-22`) |
| Soft UI shell (left + top) | `docs/design/shared/shell-reference-v1.html` (+ `shell.js`) | `app-sidebar.tsx` / `top-navigation.tsx` | `22.9` | **HTML owner approved** (`22.9.1`, `2026-08-22`); live FE after `22.9.2` |

Order etalon specifics: compact **finance rail** on the right, always visible; view filters hide **left** content only.

## Draft etalons (await owner visual)

None remaining except Sales boards (`22.3` — no HTML etalon yet).

Shared: `docs/design/shared/preview.css`, `shell.js`, `demo-data.js`, `preview.js`, `docs/design/index.html`.

## Section map (Stage 22)

| Code | Module | Status |
|------|--------|--------|
| `22.0` | Process | Active |
| `22.1` | Sales · Lead | Live owner visual OK `22.1.4` (`2026-08-22`) |
| `22.2` | Sales · Order | Live owner visual OK `22.2.5` (`2026-08-22`) |
| `22.3` | Sales · boards/lists | TBD scaffold |
| `22.4` | Production | Live owner visual OK `22.4.4` (`2026-08-22`) |
| `22.5` | Warehouse | Live owner visual OK `22.5.4` (`2026-08-22`) |
| `22.6` | Purchases | Etalon + contract + FE OK; live visual `22.6.4` open |
| `22.7` | Settings / Platform | Etalon owner OK; contract `22.7.2` |
| `22.8` | Dashboard / Home | Etalon owner OK; contract `22.8.2` |
| `22.9` | Soft UI shell chrome | HTML owner OK `22.9.1`; live DS-SHELL after `22.9.2`–`22.9.3` |
