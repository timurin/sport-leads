import { diagnosticAdminHref, diagnosticCardAnchor, type ProductionDiagnostic } from "./readiness-stickers.ts";

export type DebugFilter = "all" | "error" | "warning";

export type DebugLayer =
  | "Routing"
  | "Snapshot"
  | "Demand"
  | "Capacity"
  | "Scheduler"
  | "Calendar"
  | "Assembly"
  | "Operation";

const LAYER_BY_CODE: Record<string, DebugLayer> = {
  variant_not_selected: "Routing",
  missing_route: "Routing",
  active_route_required: "Routing",
  route_snapshot_mismatch: "Snapshot",
  missing_operator_norm: "Demand",
  missing_fixed_norm: "Demand",
  unsupported_calculation_mode: "Demand",
  missing_linear_meters: "Demand",
  ambiguous_operation_volume: "Demand",
  invalid_quantity: "Demand",
  missing_cutting_mode: "Demand",
  missing_cutting_rate: "Demand",
  missing_operation_volume: "Demand",
  missing_sewing_norm: "Assembly",
  sewing_norm_unverified: "Assembly",
  missing_operation: "Operation",
  missing_resource_link: "Operation",
  active_step_operation_required: "Operation",
  resource_capacity_not_configured: "Capacity",
  resource_unavailable: "Capacity",
  capacity_unit_mismatch: "Capacity",
  resource_stage_inactive: "Capacity",
  no_compatible_active_machine: "Capacity",
  machine_binding_missing: "Capacity",
  capacity_missing: "Capacity",
  no_available_capacity: "Capacity",
  plan_locked: "Calendar",
  locked_assignment_conflict: "Calendar",
  "120_day_horizon_exhausted": "Calendar",
  fact_route_stage_mismatch: "Calendar",
  unmapped_production_assignment: "Calendar",
  protected_foreign_route_step: "Calendar",
  started_step_without_saved_plan: "Calendar",
  anchor_machine_selection_mismatch: "Calendar",
  anchor_span_mismatch: "Calendar",
  anchor_demand_mismatch: "Calendar",
  anchor_predecessor_conflict: "Calendar",
  anchor_cutting_method_conflict: "Calendar",
  anchor_capacity_conflict: "Calendar",
  readiness_not_complete: "Scheduler",
  demand_calculation_missing: "Scheduler",
  manual_required: "Scheduler",
  deadline_missed: "Scheduler",
  completion_after_shipping_date: "Scheduler",
  standalone_active_card_required: "Scheduler",
  production_route_required: "Scheduler",
  allocation_precision_range: "Scheduler",
  quantity_planning_start_shipping_required: "Scheduler",
  demand_resource_unit: "Capacity",
  existing_allocation_unit: "Capacity",
  existing_cutting_method_unverified: "Demand",
};

const LAYER_BY_SCOPE: Record<string, DebugLayer> = {
  route_variant: "Routing",
  tech_operation: "Operation",
  capacity_resource: "Capacity",
  work_center: "Capacity",
};

const SEVERITY_RANK = { error: 0, warning: 1, info: 2 } as const;

const SECRET_KEY = /password|token|cookie|secret|connection/i;
const SECRET_VALUE = /^(postgres|postgresql|mysql|mongodb):\/\//i;

/** Fields the diagnostic contract does not return. Not shown as errors. */
export const DEBUG_BACKEND_GAPS = [
  "BACKEND GAP: diagnostic не содержит timestamp.",
  "BACKEND GAP: diagnostic не содержит snapshot_node_id.",
  "BACKEND GAP: отдельный список назначений календаря в API техкарты не приходит.",
];

export function debugLayer(row: ProductionDiagnostic): DebugLayer | null {
  return LAYER_BY_CODE[row.code] ?? LAYER_BY_SCOPE[row.fix_scope] ?? null;
}

export function debugLayerLabel(row: ProductionDiagnostic): string {
  return debugLayer(row) ?? row.fix_scope;
}

export function sortDiagnostics(rows: ProductionDiagnostic[]): ProductionDiagnostic[] {
  return rows.map((row, index) => ({ row, index })).sort((left, right) => {
    const rank = SEVERITY_RANK[left.row.severity] - SEVERITY_RANK[right.row.severity];
    return rank === 0 ? left.index - right.index : rank;
  }).map((item) => item.row);
}

export function filterDiagnostics(rows: ProductionDiagnostic[], filter: DebugFilter): ProductionDiagnostic[] {
  const sorted = sortDiagnostics(rows);
  if (filter === "all") return sorted;
  return sorted.filter((row) => row.severity === filter);
}

export function debugErrorCount(rows: ProductionDiagnostic[]): number {
  return rows.filter((row) => row.severity === "error").length;
}

export function diagnosticDetails(row: ProductionDiagnostic): Array<[string, string]> {
  const pairs: Array<[string, string | number | null | undefined]> = [
    ["code", row.code],
    ["severity", row.severity],
    ["entity_type", row.entity_type],
    ["entity_id", row.entity_id],
    ["entity_name", row.entity_name],
    ["field", row.field],
    ["field_label", row.field_label],
    ["fix_scope", row.fix_scope],
    ["operation_id", row.operation_id],
    ["resource_key", row.resource_key],
  ];
  return pairs.flatMap(([key, value]) => {
    if (value == null || value === "") return [];
    const text = String(value);
    if (SECRET_KEY.test(key) || SECRET_KEY.test(text) || SECRET_VALUE.test(text)) return [];
    return [[key, text]];
  });
}

export function diagnosticNavigation(row: ProductionDiagnostic): { href: string | null; anchor: string | null } {
  return { href: diagnosticAdminHref(row), anchor: diagnosticCardAnchor(row) };
}
