import { equipmentCapacityHref, operationSettingsHref, type OperationEditorTab } from "../tech-operation-ux.ts";

/** Backend production diagnostic. The UI shows these fields and does not invent messages. */
export type DiagnosticCategory = "CONFIGURATION" | "DATA_FLOW" | "RUNTIME" | "INTEGRITY";

export type DiagnosticTraceStep = {
  source: string;
  value: unknown;
  broken: boolean;
};

export type ProductionDiagnostic = {
  code: string;
  severity: "error" | "warning" | "info";
  entity_type: string;
  entity_id: number | string;
  entity_name: string;
  field: string;
  field_label: string;
  message: string;
  fix_scope: string;
  operation_id?: number | null;
  resource_key?: string | null;
  category?: DiagnosticCategory;
  module?: string;
  expected_source?: string | null;
  source_value?: unknown;
  actual_value?: unknown;
  formula?: string | null;
  trace?: DiagnosticTraceStep[];
  reason?: string | null;
  fix_action?: string | null;
  fix_url?: string | null;
  snapshot_node_id?: number | null;
  fix_target?: Record<string, string | number>;
  debug_details?: Record<string, unknown>;
};

const SECRET_TEXT = /password|token|cookie|secret|authorization|connection|postgres:\/\/|bearer /i;

function cleanDebugValue(value: unknown, depth = 0): unknown {
  if (value == null || depth > 3) return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return SECRET_TEXT.test(value) ? null : value;
  if (Array.isArray(value)) {
    return value.map((item) => cleanDebugValue(item, depth + 1)).filter((item) => item != null);
  }
  if (typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_TEXT.test(key)) continue;
      const clean = cleanDebugValue(item, depth + 1);
      if (clean != null) next[key] = clean;
    }
    return next;
  }
  return null;
}

function readCategory(value: unknown): DiagnosticCategory | undefined {
  if (value === "CONFIGURATION" || value === "DATA_FLOW" || value === "RUNTIME" || value === "INTEGRITY") return value;
  return undefined;
}

function readTrace(value: unknown): DiagnosticTraceStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((step) => {
    if (!step || typeof step !== "object") return [];
    const source = (step as { source?: unknown }).source;
    if (typeof source !== "string" || source.trim() === "") return [];
    return [{ source, value: cleanDebugValue((step as { value?: unknown }).value), broken: (step as { broken?: unknown }).broken === true }];
  });
}

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function readFixTarget(value: unknown): Record<string, string | number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const target: Record<string, string | number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_TEXT.test(key)) continue;
    if (typeof item === "number" && Number.isFinite(item)) target[key] = item;
    else if (typeof item === "string" && item.trim() !== "" && !SECRET_TEXT.test(item)) target[key] = item;
  }
  return target;
}

const SCHEDULE_FIELDS = new Set(["hours_per_day", "shifts_per_day", "efficiency", "working_days", "resource_count"]);

export function readDiagnostics(value: unknown): ProductionDiagnostic[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Partial<ProductionDiagnostic>;
    if (typeof item.code !== "string" || typeof item.entity_name !== "string" || typeof item.field_label !== "string" || typeof item.message !== "string") return [];
    const severity = item.severity === "warning" || item.severity === "info" ? item.severity : "error";
    const details = cleanDebugValue(item.debug_details);
    const trace = readTrace(item.trace);
    return [{
      code: item.code,
      severity,
      entity_type: typeof item.entity_type === "string" ? item.entity_type : "",
      entity_id: typeof item.entity_id === "number" || typeof item.entity_id === "string" ? item.entity_id : 0,
      entity_name: item.entity_name,
      field: typeof item.field === "string" ? item.field : "",
      field_label: item.field_label,
      message: item.message,
      fix_scope: typeof item.fix_scope === "string" ? item.fix_scope : "",
      operation_id: typeof item.operation_id === "number" ? item.operation_id : null,
      resource_key: typeof item.resource_key === "string" ? item.resource_key : null,
      category: readCategory(item.category),
      module: readText(item.module) ?? undefined,
      expected_source: readText(item.expected_source),
      source_value: cleanDebugValue(item.source_value),
      actual_value: cleanDebugValue(item.actual_value),
      formula: readText(item.formula),
      trace,
      reason: readText(item.reason),
      fix_action: readText(item.fix_action),
      fix_url: readText(item.fix_url),
      snapshot_node_id: typeof item.snapshot_node_id === "number" ? item.snapshot_node_id : null,
      fix_target: readFixTarget(item.fix_target),
      debug_details: details && typeof details === "object" && !Array.isArray(details) ? details as Record<string, unknown> : {},
    }];
  });
}

export function diagnosticKey(row: ProductionDiagnostic): string {
  return [row.code, row.entity_type, String(row.entity_id), row.field, row.operation_id ?? "", row.resource_key ?? ""].join("|");
}

export function uniqueDiagnostics(rows: ProductionDiagnostic[]): ProductionDiagnostic[] {
  const seen = new Set<string>();
  const result: ProductionDiagnostic[] = [];
  for (const row of rows) {
    const key = diagnosticKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

/** Same caption on the catalog, the route and the technical card. */
export function stickerLabel(row: ProductionDiagnostic): string {
  return `${row.entity_name} · ${row.field_label}`;
}

export function stickerMark(severity: ProductionDiagnostic["severity"]): string {
  if (severity === "warning") return "⚠";
  if (severity === "info") return "•";
  return "✕";
}

export function previewDiagnostics(rows: ProductionDiagnostic[], limit = 3): { shown: ProductionDiagnostic[]; hidden: number } {
  const unique = uniqueDiagnostics(rows);
  return { shown: unique.slice(0, limit), hidden: Math.max(0, unique.length - limit) };
}

export function diagnosticEditorTarget(row: ProductionDiagnostic): { tab: OperationEditorTab; fieldId: string } {
  if (row.field.startsWith("norm_rates.") || row.field === "work_center_id" || row.fix_scope === "work_center") {
    return { tab: "equipment", fieldId: row.field || "work_center_id" };
  }
  if (SCHEDULE_FIELDS.has(row.field)) return { tab: "schedule", fieldId: row.field };
  if (row.field === "demand_rule" || row.field === "demand_duration_seconds") return { tab: "main", fieldId: row.field };
  if (row.field === "calculation_mode") return { tab: "main", fieldId: "calculation_mode" };
  if (row.fix_scope === "capacity_resource" || row.field === "capacity_resource_keys" || row.field === "base_rate" || row.field === "capacity_unit" || row.field === "include_in_calendar_load") {
    return { tab: "capacity", fieldId: row.field || "capacity_resource_keys" };
  }
  if (row.field === "production_stage_id") return { tab: "main", fieldId: "production_stage_id" };
  if (row.field === "is_active") return { tab: "main", fieldId: "is_active" };
  if (row.field === "code") return { tab: "main", fieldId: "code" };
  return { tab: "main", fieldId: "name" };
}

export function diagnosticAdminHref(row: ProductionDiagnostic): string | null {
  if (row.fix_scope === "work_center") {
    const centerId = typeof row.entity_id === "number" ? row.entity_id : Number(row.entity_id);
    if (Number.isInteger(centerId) && centerId > 0) return equipmentCapacityHref(centerId);
  }
  if (row.operation_id && row.fix_scope !== "technical_card" && row.fix_scope !== "route_variant") {
    return operationSettingsHref(row.operation_id, diagnosticEditorTarget(row).tab);
  }
  return null;
}

export function diagnosticCardAnchor(row: ProductionDiagnostic): "tech-card-route-scheme" | "tech-card-production-plan" | null {
  if (row.fix_scope === "route_variant" || row.field === "selected_operation_snapshot_node_id" || row.field === "default_operation_node_id" || row.field === "volume" || row.field === "cutting_method") {
    return "tech-card-route-scheme";
  }
  if (row.fix_scope === "technical_card") return "tech-card-production-plan";
  return null;
}
