# Sport-Lead — Data Presentation Standardization

**Code:** `SL-DATA-PRESENTATION-STD-v1`  
**Date:** `2026-07-21`  
**Roadmap:** `5.4.3.1`–`5.4.3.7`  
**Related:** `DS-FORM-01`, `DS-ACTION-01`, `DS-BADGE-01`, `DS-FEEDBACK-02`

## Contracts

| Microtask | Contract | Primitive(s) |
|---|---|---|
| `5.4.3.1` | `DS-TABLE-01` | `data-table.tsx` |
| `5.4.3.2` | `DS-FILTER-01` | `filter-toolbar.tsx` |
| `5.4.3.3` | `DS-LIST-01` | `list-pagination.tsx` (`ListTotals`, `Pagination`) |
| `5.4.3.4` | `DS-TABS-01` | `compact-tabs.tsx` |
| `5.4.3.5` | `DS-TIMELINE-01` | `activity-timeline.tsx` |
| `5.4.3.6` | `DS-PANEL-01` | `entity-panel.tsx` |
| `5.4.3.7` | `DS-LINK-01` | `entity-link.tsx` (`EntityLink`, `InlineEditActions`) |

Also: existing `DataList` used for order detail fields.

## Visual rules

1. Tables: portal border/surface, sticky head `z-portal-raised`, header cells use `text-portal-caption font-semibold uppercase tracking-wide text-portal-muted` (including sortable buttons via `font-inherit`), local `overflow-x-auto` only.
2. Filters: compose `Input`/`Select`/`Button`; strip or card variant.
3. Tabs: prefer `CompactTabs` for simple filters; nomenclature card tabs stay custom until PT-06 (inventory D7).
4. Timeline/panels: shared chrome; domain logic stays in lead components.
5. Entity links: portal primary text; inline edit uses `InlineEditActions` + form controls.

## Migrated consumers

- `/sales/clients` — DataTable, FilterToolbar, ListTotals, Pagination
- `/settings/catalogs/custom-fields` — DataTable
- `/settings/catalogs/nomenclature` — FilterToolbar card, DataTable, EntityLink, StatusBadge, EmptyState
- Lead card — CompactTabs on tasks/history; EntityPanel; ActivityTimeline; EmptyState
- `/sales/dashboard` — RecentActivity → ActivityTimeline
- `/sales/orders/[id]` — DataList + EntityLink
- Lead customer block — InlineEditActions trigger

## Verification (owner)

1. `/sales/clients` — portal table/filters/totals; pagination if >25 rows after filter.
2. `/settings/catalogs/nomenclature` — filter card + table links.
3. `/settings/catalogs/custom-fields` — DataTable chrome.
4. `/sales/leads/[id]` — CompactTabs on tasks/history; panels unchanged structurally.
5. `/sales/orders/[id]` — DataList details + lead EntityLink.
6. `/sales/dashboard` — recent activity timeline chrome.
7. `DS-SHELL-01 visual contract preserved`, `DS-SHELL-02 visual contract preserved`.

Reply: `5.4.3 visual OK` or list issues.

## Status

Owner confirmation: **pending**.
