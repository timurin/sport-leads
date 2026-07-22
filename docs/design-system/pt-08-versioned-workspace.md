# Sport-Lead — PT-08 Versioned Workspace

**Code:** `SL-PT-08-VERSIONED-WORKSPACE-v1`  
**Contract:** `DS-PT-08`  
**Date:** `2026-07-22`  
**Roadmap:** `5.5.8.1`–`5.5.8.5`  
**Reference page:** `/settings/catalogs/product-models/[modelId]` (`ProductModelPersistentCard`) — layout etalon `DS-PT-08-CATALOG`  
**Demo shell:** `/settings/catalogs/product-models/demo-reference` (`ProductModelCard`)  
**Related:** `DS-PAGE-01`…`04`, `DS-TABS-01`, `DS-BADGE-01`, `DS-ACTION-01`, `DS-FEEDBACK-02`, `pt-08-catalog-card-layout.md`, Stage `6.1` product models, `responsive-rules.md`

## Scope

Define the **versioned workspace** template (PT-08): page frame, entity header, **active version** strip, version history, **draft / published** lifecycle chrome, **compare / restore** entry points, and tabbed or sectioned body for long-lived configuration entities (product models, specifications, routings). Reference is a **labeled demo** Model Card until Stage `6.1` API lands.

Does **not** own: nomenclature catalog source of truth (PT-04/PT-06 card), simple single-version settings cards (PT-05), transactional documents (PT-07).

## Canonical composition

```
AppShell
  └── [data-app-shell-main]
        └── PageLayout
              └── PageContent (width="full", size="default")
                    └── VersionedWorkspace
                          ├── Entity header (+ back, title, status)
                          └── CatalogVersionedCardLayout (DS-PT-08-CATALOG)
                                ├── main     — attributes + workspace
                                ├── media    — photo / cover (300px @ ≥1900)
                                └── versions — version bar + change history
```

For catalog cards, body grid rules live in `pt-08-catalog-card-layout.md` (`DS-PT-08-CATALOG`). Demo reference may still use an older PT-08 composition until migrated.

## `DS-PT-08` rules

1. Wrap in `PageLayout` → `PageContent` (`width="full"` default for engineering workspaces).
2. Header uses `EntityHeader` — not Platform Topbar titles (D6).
3. **One active version** is always visible in the version bar; switching version updates body context (no hidden active version).
4. Version **state** uses `StatusBadge` tones: `draft` → warning/neutral, `published` → success, `archived` → neutral.
5. History lists versions with label, state, author/time when available; empty → `EmptyState`.
6. **Compare**: explicit entry (button/link); opens side-by-side or modal shell — no silent diff.
7. **Restore**: confirm step before replacing active draft; disabled when API unavailable (demo: labeled).
8. Demo/local shells must show **demo label** (`DS-FEEDBACK-02`); no fake persistence.
9. Segment boundaries: `loading` / `error` / `not-found` per `DS-PAGE-06`.
10. Platform Shell `DS-SHELL-01` / `DS-SHELL-02` unchanged.

## Slots

| Slot | Required | Primitive |
|---|---|---|
| Page frame | yes | `PageLayout` + `PageContent` |
| Workspace frame | yes | `VersionedWorkspace` |
| Header | yes | `EntityHeader` |
| Version bar | yes | `ProductModelVersionBar` (domain) / shared pattern |
| Active version | yes | selector + `StatusBadge` |
| Body | yes | `SectionCard` / `CompactTabs` |
| History | yes | `SectionCard` + list or `ActivityTimeline` |
| Compare | recommended | `EditDrawer` / dialog shell |
| Restore | recommended | confirm + `Button` |

## Active version and history (`5.5.8.2`)

1. Version bar shows all selectable versions (scroll locally on narrow widths).
2. **Active** version for editing is distinct from **published** baseline when both exist (badge + label).
3. History section lists prior publishes and drafts; selecting a row may open read-only preview (future API).

## Draft and published states (`5.5.8.3`)

| State | Meaning | UI |
|---|---|---|
| `draft` | Editable working copy | Warning/neutral badge; save/publish actions enabled when API ready |
| `published` | Approved baseline | Success badge; read-only or “create draft from published” |
| `archived` | Retired | Neutral badge; read-only |

Only one **published** active baseline per model (business rule in `6.1`); PT-08 surfaces the distinction in chrome.

## Compare and restore UX (`5.5.8.4`)

1. **Compare** — user picks second version; show structural diff shell (fields table or sections); demo may use static placeholder rows.
2. **Restore** — “Восстановить в черновик” with confirm; on success switch version bar to new draft.
3. Destructive actions use `Button` `danger` + confirm; no restore without explicit confirm.

## Responsive behaviour

| Band | Behaviour |
|---|---|
| Desktop (`lg+`) | Version bar inline; history beside or below body via grid |
| Tablet (`md`–`lg`) | Version bar horizontal scroll; tabs stack |
| Mobile (`&lt;md`) | Version bar scroll; single-column sections; full-width actions |

Verification widths: 1920…390.

## Reference consumers

- `/settings/catalogs/product-models/[modelId]` — **PT-08 + DS-PT-08-CATALOG etalon** (API)
- `/settings/catalogs/product-models/demo-reference` — labeled PT-08 demo shell

Future: pattern-set card after `6.3.5`, specification/routing versioned editors. Mapping: `stage-6.0.3-pattern-base-pt-mapping.md`. Layout: `pt-08-catalog-card-layout.md`.

## Verification (owner)

1. Open demo reference — version bar, draft/published badges, history, compare/restore affordances (demo-labeled).
2. Resize 1920 → 390 — version bar scrolls locally; no page overflow.
3. `DS-SHELL-01 visual contract preserved`, `DS-SHELL-02 visual contract preserved`.

Reply: `5.5.8 visual OK` when reference shell is accepted (optional before Stage `5.6.7`).

## Status

Contract + demo Model Card shell shipping for `5.5.8.*`. API-backed behaviour: Stage `6.1`.
