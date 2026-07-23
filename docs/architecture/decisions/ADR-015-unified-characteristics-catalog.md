# ADR-015 — Unified characteristics catalog (absorbs custom fields)

**Status:** принято; `4.8.*` (`2026-07-23`)

**Supersedes (partially):** ADR-006 (реквизит ≠ характеристика), ADR-008 (отдельный SoT custom fields). Variant rules from ADR-010 remain for `is_variant_dimension=true`.

## Context

Settings exposed two overlapping directories — «Дополнительные реквизиты» (`CustomField*`) and «Характеристики номенклатуры» (`Characteristic*`). Owner decision: keep a single catalog under characteristics; migrate custom-field data and remove the parallel store.

## Decision

Single source of truth:

- `CharacteristicDefinition` — code, name, `kind`, activity, visibility/search/filter flags, optional `unit_id`, `is_system`, **`is_variant_dimension`**
- `CharacteristicOption` — values for `LIST` / `MULTI_SELECT` / `COLOR` (HEX for color)
- `CategoryCharacteristic` — category assignment with required/inherit/visible/sort and typed defaults
- `NomenclatureCharacteristicValue` — typed card values (former `NomenclatureFieldValue`)
- `NomenclatureCharacteristic` + variants — only for definitions with `is_variant_dimension=true` (ADR-010)

### Kinds

`STRING | TEXT | INTEGER | DECIMAL | BOOLEAN | DATE | LIST | MULTI_SELECT | COLOR`

- Former custom `SINGLE_SELECT` → `LIST`
- Former characteristic `LIST` / `COLOR` with variant use → `is_variant_dimension=true`
- Migrated custom fields → `is_variant_dimension=false`

### Deletion

Physical delete of definition/option is allowed only when:

1. Interim usage checks find no references (variants, card values, category assignment, nomenclature characteristic assignment, option defaults); and
2. Global operations journal hook (`18.4`) reports no rows (stub returns false until journal ships).

Otherwise API returns conflict; UI disables delete.

### UI

- Settings: only `/settings/catalogs/product-characteristics` (+ `[id]` card).
- `/settings/catalogs/custom-fields` redirects to product-characteristics.
- Nomenclature card uses one unified attributes/characteristics surface on the characteristics API.

## Consequences

- `/custom-fields` API is removed after callers move to `/characteristics`.
- ADR-006/008 remain historical for v0.8.2–v0.8.4; new work follows this ADR.
- Stage `18.4` will wire the journal stub without changing the delete contract.
