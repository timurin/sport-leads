# PC-05.0C — Platform diagnostics foundation

Production scope, read-only. Extends the existing `ProductionDiagnostic` and shared `production_diagnostics` resolver; no second readiness store, business rules, migrations, fixes or UI.

## API and access

- `GET /platform-health`: category CONFIGURATION/DATA_FLOW/RUNTIME/INTEGRITY, module, severity error/warning/info, entity_type, entity_id, limit1..200 (default100), offset>=0. Summary counts apply to the filtered complete result, diagnostics array is paginated. `scope=production` explicitly excludes unimplemented ERP domains.
- `GET /platform-health/technical-cards/{id}/trace`: returns the same `ProductionDiagnosticsRead` as the existing card diagnostic API, including provenance; missing card404.
- Both endpoints require authentication and the existing `audit.read` permission. Existing entity APIs retain their access contracts. All new methods are GET; neither endpoint commits, applies routes, normalizes data, fixes norms or persists Scheduler output.

## Additive contract

Existing code/severity/entity/field/message/fix_scope/operation_id/resource_key are preserved. New fields: category/module/expected_source/source_value/actual_value/formula/trace/reason/fix_action/fix_url/fix_target/debug_details. Trace entries contain source/value/broken. Nullable unknown values remain null, never invented. Metadata is a small allowlisted collection of scalar fields, source IDs, quantities and time inputs; no ORM dumps, credential/config dumps, raw exceptions or validation payloads.

Root diagnostics from catalog/graph/card aggregation deduplicate by full serialized DTO. Card-specific lineage remains card-specific. Entity and platform diagnostics are produced by the same functions; differing context is not replaced with a parallel cause taxonomy. Entity catalog diagnostics remain contextual: lack of a card meter input in a template read is not evidence that a particular existing card lost its copy.

## Categories and trace limits

| Evidence | Category / code |
|---|---|
| Missing operation/resource configuration or missing time | CONFIGURATION / existing codes |
| Existing route source but empty applied graph | DATA_FLOW / route_snapshot_missing |
| Unique compatible configured norm but zero/null copied input | DATA_FLOW / operation_input_snapshot_missing |
| Frozen basis × quantity disagrees with persisted total | DATA_FLOW / derived_volume_mismatch |
| Ambiguous applied sewing/time source | DATA_FLOW / sewing_norm_unverified |
| Valid work exceeds available120-day scheduling budget | RUNTIME / 120_day_horizon_exhausted |
| Missing soft-ref target / malformed variant groups | INTEGRITY / broken_reference, invalid_variant_snapshot |
| Allocation target/unit/date disagrees with saved plan/resource | INTEGRITY / calendar_broken_reference, calendar_allocation_unit_mismatch, calendar_allocation_outside_plan |
| Active physical center lacks adapter | CONFIGURATION / work_center_capacity_missing |

An empty working_days configuration is CONFIGURATION when checked in resource context, rather than proof of occupancy exhaustion. Source values for frozen derived checks are saved coefficients, not edited live model norms. Manual NULL basis is excluded from that check. ONE OF excluded routing alternatives are excluded from card volume checks. Sewing trace reflects the actual order-item time snapshot or standalone live assembly source; it does not claim frozen time on TechnicalCardOperationLine.

Version1 is an explicit Debug scan over current production catalogs/cards/plans, with existing per-card dry-run cost. Pagination bounds payload, not total evaluation work. No background collector/cache, exception-catching fallback for infrastructure failures or readiness mutation is introduced. Contract tests use isolated databases; local PostgreSQL observation emitted zero INSERT/UPDATE/DELETE. Calendar consistency covers allocation target/unit/span in this slice; this is not an exhaustive ERP integrity auditor.

Canonical map: [DF-DIAGNOSTICS](SL-DATA-FLOW-v1.md#df-diagnostics). Implementation: `backend/app/schemas/production_diagnostics.py`, shared resolver, `production_lineage.py`, `platform_health.py`, `backend/app/api/platform_health.py`; tests `backend/tests/test_platform_health_pc_05_0c.py`.
