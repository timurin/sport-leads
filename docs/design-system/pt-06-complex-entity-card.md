# Sport-Lead — PT-06 Complex Entity Card

**Code:** `SL-PT-06-COMPLEX-ENTITY-CARD-v1`  
**Contract:** `DS-PT-06`  
**Date:** `2026-07-22`  
**Roadmap:** `5.5.6.1`–`5.5.6.7`  
**Reference page:** `/sales/leads/[leadId]` (`LeadPage` + `LeadHeader`)  
**Secondary:** `/settings/catalogs/nomenclature/[nomenclatureId]` (HTML parity; full migrate in `5.6.6`)  
**Related:** `DS-PAGE-01`…`04`, `DS-TABS-01`, `DS-TIMELINE-01`, `DS-PANEL-01`, inventory **D6**, R4, `responsive-rules.md`

## Scope

Define the **complex entity card** template (PT-06): page frame, domain entity header (title / status / actions), optional stage rail, metrics strip, multi-section body grid, activity / workspace panels (tabs on narrow viewports), and responsive collapse. Reference is Lead Card.

Does **not** own: simple settings cards (PT-05), document cards (PT-07), de-mixing demo managers / dual lead IDs (`5.6.3`), nomenclature pixel HTML parity (`5.6.6`).

## Canonical composition

```
AppShell
  └── [data-app-shell-main]
        └── PageLayout
              ├── Complex header slot     ← LeadHeader (domain) / future EntityHeader+stage
              │     ├── identity + actions
              │     └── stage rail (local x-scroll)
              └── PageContent (width="full", size="compact")
                    └── ComplexEntityCard body
                          ├── Section grid (customer | commercial | …)
                          ├── Metrics strip (ResponsiveGrid + MetricCard)
                          └── Workspace region
                                ├── lg+: multi-panel grid + sticky side column
                                └── <lg: CompactTabs → one panel at a time (R4)
```

Domain dialogs (tasks, completion) are **siblings** of the card body.

## `DS-PT-06` rules

1. Wrap in `PageLayout`. Body uses `PageContent width="full"` for CRM density (no max-width).
2. Header is domain-owned (`LeadHeader`) until a shared complex-header primitive exists — do not put titles in Platform Topbar (D6).
3. Metrics use `MetricCard` / `ResponsiveGrid` — not one-off `KeyMetric` tiles.
4. Section shells prefer `SectionCard` (or equivalent portal surface tokens) for bordered panels.
5. Activity / workspace chrome: `CompactTabs` (`DS-TABS-01`) on narrow bands; desktop may show multiple panels.
6. Timeline / tasks / notes reuse shared primitives (`ActivityTimeline`, panels) — no second timeline framework.
7. Stage rail horizontal scroll is **local only**; no document overflow.
8. Prefer container queries on the card body for section collapse (existing `lead-page` / `lead-left` pattern).
9. Platform Shell `DS-SHELL-01` / `DS-SHELL-02` unchanged.

## Slots

| Slot | Required | Primitive |
|---|---|---|
| Page frame | yes | `PageLayout` |
| Header | yes | domain `LeadHeader` (PT-06 header slot) |
| Stage rail | recommended | local x-scroll steps inside header |
| Body | yes | `PageContent` + `ComplexEntityCard` |
| Sections | yes | `SectionCard` / domain detail blocks |
| Metrics | recommended | `ResponsiveGrid` + `MetricCard` |
| Workspace tabs | yes (&lt;lg) | `CompactTabs` |
| Timeline / tasks | optional | `ActivityTimeline` / domain panels |
| Side column | optional | sticky communication / inspector |

## Entity header (`5.5.6.2`)

1. Back control + title + status badge + overflow actions.
2. Meta row: responsible, source, last activity.
3. Primary actions wrap full-width below `sm` (`PageActions`).

## Stage + metrics (`5.5.6.3`)

1. Stage rail: numbered steps + final actions; current/done tokens via portal primary/soft.
2. Metrics: `MetricCard` grid; 1 col → 3 → 6 via container / `ResponsiveGrid`.

## Section grid (`5.5.6.4`)

1. Reference sections (customer / commercial) share one row when container allows.
2. Every flex/grid child: `min-w-0`.

## Activity tabs (`5.5.6.5`)

1. Desktop: history / tasks / notes as multi-panel grid (optional side communication column).
2. Narrow: `CompactTabs` switches visible workspace panel (R4).

## Responsive collapse (`5.5.6.6`) — addresses R4

| Band | Behaviour |
|---|---|
| Wide (`lead-page` ≥ ~90rem) | Two columns: main + sticky communication |
| Mid | Single column; section grids via container queries |
| Mobile (`&lt;lg` / ~900px) | Stack; workspace tabs; stage rail local x-scroll |

Verification widths: 1920…390.

## Reference consumers

- `/sales/leads/[leadId]` — **PT-06 reference**
- Nomenclature card — secondary; formal migrate in `5.6.6`

## Verification (owner)

1. `/sales/leads/[id]` — header, stages, metrics, sections, communication, tasks/notes/history.
2. Resize 1920 → 390 — no page overflow; tabs on narrow; stage rail scrolls locally.
3. `DS-SHELL-01 visual contract preserved`, `DS-SHELL-02 visual contract preserved`.

Reply: `5.5.6 visual OK` or list issues.

## Status

Contract + Lead Card standardization shipped for `5.5.6.*`. Owner confirmation: **`5.5.6 visual OK`** (`2026-07-22`).
