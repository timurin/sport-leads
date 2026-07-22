# Sport-Lead — Responsive Verification Matrix and Audit

**Code:** `SL-RESPONSIVE-AUDIT-v1`
**Date:** `2026-07-21`
**Project version:** `v0.9.0`
**Git branch:** `feature/v0.8.1-nomenclature-core`
**Git commit:** `7c267e1`
**Related:** `docs/design-system/responsive-rules.md`, `ui-audit.md`, `layout-scrolling-audit.md`, `shell-contracts.md`

## Roadmap microtasks

## Roadmap microtasks

- `[x]` `5.1.4.1` — Define responsive verification matrix
- `[x]` `5.1.4.2` — Audit desktop layouts — owner pass OK (`2026-07-21`)
- `[x]` `5.1.4.3` — Audit laptop layouts — owner pass OK (`2026-07-21`)
- `[x]` `5.1.4.4` — Audit tablet layouts — owner pass OK (`2026-07-21`)
- `[x]` `5.1.4.5` — Audit mobile layouts — owner pass OK (`2026-07-21`); sidebar hidden below `md`
- `[x]` `5.1.4.6` — Register visual bug microtasks — **no `B1+` registered**; candidates dismissed/deferred

## `5.1.4.1` — Verification matrix

### Device bands (aligned with `responsive-rules.md`)

| Band | Width range | Primary matrix viewports | Shell expectations |
|---|---|---|---|
| Wide desktop | ≥ 1500 px content / ≥ 1920 viewport | **1920**, **1600** | Sidebar expanded 260px; topbar desktop nav (`lg+`) |
| Desktop | ~1200–1499 | **1440**, **1280** | Expanded or compact sidebar; desktop nav if ≥ `lg` |
| Laptop | ~1024–1279 | **1280**, **1024** | Compact sidebar likely; topbar may use compact section menu below `lg` |
| Tablet | 768–1199 | **1024**, **768** | Compact sidebar / tablet menu; no horizontal page scroll |
| Mobile | ≤ 767 | **390** (also spot-check ~600) | **No left sidebar**; topbar menu = sections + in-section nav; mobile bars; single column |

Tailwind/shell anchors used in product code:

- Topbar height / desktop nav: `md`, `lg` (see DS-SHELL-02)
- Sidebar widths: expanded `260px`, compact `72px` (DS-SHELL-01)

### Mandatory pages (from ui-audit references)

| # | URL | Why |
|---|---|---|
| 1 | `/sales/dashboard` | PT-01 provisional |
| 2 | `/sales/leads` | PT-03 reference |
| 3 | `/sales/leads/[leadId]` | PT-06 provisional (pick a real numeric id) |
| 4 | `/sales/orders` | secondary kanban |
| 5 | `/sales/orders/[orderId]` | PT-07 reference |
| 6 | `/settings/catalogs/nomenclature` | PT-04 reference |
| 7 | `/settings/catalogs/nomenclature/[id]` | PT-06 reference |
| 8 | `/settings/catalogs/product-characteristics` | PT-02 / Settings → Номенклатура |
| 9 | `/settings/catalogs/product-characteristics/[id]` | card under Platform Shell only |
| 10 | `/settings` | hub + long labels |

Optional spot-check (nav added after matrix draft): `/settings/catalogs/nomenclature-categories`, `/settings/catalogs/nomenclature-types`, `/settings/catalogs/units`.

Also verify **expanded** and **compact** sidebar on each band where both modes exist (desktop/laptop/tablet).

### Matrix reconciliation (2026-07-21)

| Block | Status | Notes |
|---|---|---|
| R1 / B-candidate-1 — characteristics local sidebar + `100vh` | **Dismissed** | Removed; page uses Platform Shell only |
| B-candidate-2 — nomenclature missing from nav | **Dismissed** | Group «Номенклатура» in `navigation.ts` |
| R2 — kanban vs page width | **Addressed in PT-03 (`5.5.3`)** | Local board x-scroll + snap; full-width toolbar; no document overflow |
| R3 — wide settings tables | **Addressed in PT-02 (`5.5.2`)** | Clients: mobile cards; `md+` local x-scroll; other wide lists adopt later |
| R4 — lead card columns | **Dismissed for 5.1.4** | Owner pass; revisit PT-06 |
| R5 — nomenclature tree+list | **Dismissed for 5.1.4** | Owner pass; revisit PT-04 |
| R6 — search + compact sidebar | **Dismissed for 5.1.4** | Owner pass |
| R7 — `/dashboard` vs sales dashboard | **Deferred** | Product note |
| B-candidate-3 / 4 — empty states | **Deferred** | Later DS empty-state work |
| Mobile left sidebar | **Fixed** | Hidden below `md`; topbar menu has sections |

### Interactions to open on each page (minimum)

- Global search open + hints + Escape close
- Global Create dropdown (if present)
- Section compact menu on tablet/mobile
- One page dialog/drawer if the page has it (lead create / stage settings / media lightbox)
- Long title / filter empty where applicable

### Pass criteria (per viewport × page)

- [ ] No horizontal scrollbar on `document` / page (local table/kanban scroll OK)
- [ ] Title and topbar controls do not overlap
- [ ] Primary vertical scroll is `[data-app-shell-main]` only
- [ ] Focus visible on interactive controls
- [ ] Dropdown/popup stays in viewport
- [ ] DS-SHELL-01 / DS-SHELL-02 visual contract preserved

### Result log template

Copy per band when auditing:

```
Band: desktop | Viewport: 1440
Sidebar: expanded | compact
Page: /sales/leads
Pass: yes/no
Bugs: B?
Notes:
```

---

## Static pre-findings (not a visual pass)

Known risks — confirm or dismiss during `5.1.4.2`–`5.1.4.5`:

| ID | Risk | Likely bands | Status |
|---|---|---|---|
| R1 | Characteristic detail local sticky sidebar + `100vh` | — | **Dismissed** (fixed before pass) |
| R2 | Kanban horizontal board vs page width | tablet/mobile | **Dismissed for 5.1.4** — owner pass OK; revisit in PT-03 |
| R3 | Wide settings tables (`min-width`) need local x-scroll only | tablet/mobile | **Dismissed for 5.1.4** — owner pass OK; revisit in PT-02 |
| R4 | Lead card dense two-column → single column behaviour | tablet/mobile | **Dismissed for 5.1.4** — owner pass OK; revisit in PT-06 |
| R5 | Nomenclature tree+list needs drawer strategy | tablet/mobile | **Dismissed for 5.1.4** — owner pass OK; revisit in PT-04 |
| R6 | Topbar full-width search + compact sidebar combo | laptop/tablet | **Dismissed for 5.1.4** — owner pass OK |
| R7 | `/dashboard` stub vs sales dashboard inconsistency | all | **Deferred** — product note, not a responsive shell bug |

### Candidate visual bugs for `5.1.4.6`

| Candidate | Summary | Status |
|---|---|---|
| B-candidate-1 | Characteristics alternate sidebar | **Dismissed** (fixed) |
| B-candidate-2 | Nomenclature missing from nav | **Dismissed** (fixed) |
| B-candidate-3 | EntityWorkspace demo empty state | **Deferred** — not a responsive-pass defect; handle in DS empty-state work |
| B-candidate-4 | Unused `EmptyState` | **Deferred** — same as B-candidate-3 |

`5.1.4.6` closed with **zero** new roadmap `B1+` microtasks from the owner visual pass.

---

## Manual verification procedure (owner)

### 1. Start stack

From repo root (`D:\Projects\sport-leads`):

```powershell
docker compose up -d postgres
```

Backend (new terminal):

```powershell
cd D:\Projects\sport-leads\backend
.\.venv\Scripts\Activate.ps1   # if venv exists; else use your Python env
alembic upgrade head
uvicorn app.main:app --reload
```

Frontend (new terminal):

```powershell
cd D:\Projects\sport-leads\frontend
npm run dev
```

Open: `http://localhost:3000` (or the port Next prints).

If Postgres port differs, use the host/port from `.env` (project default often `127.0.0.1:5433`).

### 2. DevTools viewport pass

For each viewport in the matrix (1920, 1600, 1440, 1280, 1024, 768, 390):

1. Toggle sidebar expanded/compact where applicable.
2. Walk mandatory pages 1–10.
3. Run interaction checklist.
4. Fill result log; file bugs as `B1`, `B2`, … in roadmap when confirmed.

### 3. Optional quick script reminder

```powershell
cd D:\Projects\sport-leads
git status -sb
# after notes, tell the agent: "visual pass done, register bugs" or paste the result logs
```

---

## Status gate

| Microtask | Agent can close alone? | Status now |
|---|---|---|
| 5.1.4.1 | Yes (docs) | **Done** |
| 5.1.4.2 | No — human viewport | **Done** — desktop pass OK |
| 5.1.4.3 | No — human viewport | **Done** — laptop pass OK |
| 5.1.4.4 | No — human viewport | **Done** — tablet pass OK |
| 5.1.4.5 | No — human viewport | **Done** — mobile pass OK |
| 5.1.4.6 | After visual confirmation | **Done** — no `B1+` to register |

### Result log — `5.1.4.2` Desktop

```
Band: desktop / wide desktop
Viewports: 1920, 1600, 1440, 1280
Sidebar: expanded + compact
Pages: mandatory 1–10 (matrix)
Pass: yes
Bugs: none reported
Owner confirmation: desktop pass OK (2026-07-21)
```

### Result log — `5.1.4.3` Laptop

```
Band: laptop
Viewports: 1280, 1024
Sidebar: expanded + compact where applicable
Pages: mandatory 1–10 (matrix)
Pass: yes
Bugs: none reported
Owner confirmation: laptop pass OK (2026-07-21)
```

### Result log — `5.1.4.4` Tablet

```
Band: tablet
Viewports: 1024, 768
Sidebar: compact / tablet section menu
Pages: mandatory 1–10 (matrix)
Pass: yes
Bugs: none reported
Owner confirmation: tablet pass OK (2026-07-21)
```

### Result log — `5.1.4.5` Mobile

```
Band: mobile
Viewports: 390
Sidebar: hidden (below md); navigation via topbar menu (sections + in-section)
Pages: mandatory 1–10 (matrix)
Pass: yes
Bugs: none reported (mobile sidebar removal fixed before pass)
Owner confirmation: mobile pass OK (2026-07-21)
```

### Next recommended iteration

`5.2.1.1` — Audit existing token sources (Design tokens). Do not start until owner confirms.
