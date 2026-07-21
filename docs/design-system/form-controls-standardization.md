# Sport-Lead — Form Controls Standardization

**Code:** `SL-FORM-CONTROLS-STD-v1`  
**Contract:** `DS-FORM-01`  
**Date:** `2026-07-21`  
**Roadmap:** `5.4.1.1`–`5.4.1.6`  
**Primitives:** `frontend/components/ui/form-controls.tsx`  
**Styles:** `frontend/lib/design-system/control-styles.ts`  
**Related:** `interaction-tokens.md`, `component-size-tokens.md`, `spacing-tokens.md`

## Scope

Unify **form controls** across the platform (especially nomenclature + catalogs):

| Microtask | Deliverable |
|---|---|
| `5.4.1.1` | `Input` + `Textarea` + `controlClassName` |
| `5.4.1.2` | `Select`; combobox pattern = `CityAutocomplete` on same chrome |
| `5.4.1.3` | `Checkbox`, `Radio`, `Switch` |
| `5.4.1.4` | `DateInput`, `MoneyInput` |
| `5.4.1.5` | `Field` help/error + `aria-invalid` / `invalid` prop |
| `5.4.1.6` | Disabled + read-only styles (opacity / secondary surface) |

**Out of scope:** Button visual system (`5.4.2.1`), StatusBadge (`5.4.2.2`). Submit actions on migrated forms may already use existing `Button`.

## Visual rules

1. Heights: `h-portal-control-compact|default|spacious` (32 / 40 / 44).
2. Border: `border-portal-border`; focus: `border-portal-primary` + `.portal-focus-ring`.
3. Radius: `rounded-portal-md`; surface: `bg-portal-surface`.
4. Invalid: `border-portal-danger` + Field error text.
5. Read-only: `bg-portal-surface-secondary` + muted text.
6. Disabled: portal disabled opacity; no pointer events on interactive controls.
7. Do not invent slate/blue/`#cfd7e6` one-off control skins for new work.

## Migrated consumers (this iteration)

- `nomenclature-create-panels.tsx` — CreateDrawer forms
- `custom-fields-workspace.tsx`
- `nomenclature-workspace.tsx` — filters + category edit
- `nomenclature-card.tsx` — field editors (compact)
- `nomenclature-media-gallery.tsx` — alt/sort inputs
- `product-characteristics-*` CSS inputs/selects → portal tokens
- `entity-form.tsx`
- `city-autocomplete.tsx` — shared `controlClassName`
- `sales-order-items.tsx` — order line create/edit fields (`/sales/orders/[id]`)

## Verification (owner)

1. `/settings/catalogs/nomenclature` — Create drawer fields look like portal controls (height 40, primary focus).
2. Same page — list filters / category edit match create chrome.
3. Nomenclature card edit — compact inputs, no hex `#cfd7e6` borders.
4. `/settings/catalogs/custom-fields` — create/assign forms use Input/Select/Checkbox + Button.
5. Characteristics search inputs match portal border/focus.
6. `/sales/orders/[id]` — блок «Товарные позиции»: Input/Select compact/default в том же chrome, что и справочники.
7. Confirm: `DS-SHELL-01 visual contract preserved`, `DS-SHELL-02 visual contract preserved`.

Reply: `5.4.1 visual OK` or list issues.

## Status

Owner confirmation: **`5.4.1 visual OK`** (`2026-07-21`), including `/sales/orders/[id]` order items.
