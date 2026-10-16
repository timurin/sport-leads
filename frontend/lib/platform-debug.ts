import { readDiagnostics, type DiagnosticCategory, type DiagnosticTraceStep, type ProductionDiagnostic } from "./production/readiness-stickers.ts";

export const DEBUG_MODE_BACKEND_GAP =
  "BACKEND GAP: в platform-system-settings нет поля режима отладки. Постоянный переключатель на frontend не сохраняется.";

export const DEBUG_MODE_WRITE_GAP =
  "BACKEND GAP: platform-system-settings не принимает запись режима отладки.";

export const TRACE_CHAIN = ["Source", "Snapshot", "Derived", "Demand", "Scheduler"] as const;

export type TraceNode = (typeof TRACE_CHAIN)[number];

export type TraceNodeState = "broken" | "present" | "unknown";

export type HealthCategoryFilter = "all" | DiagnosticCategory;

export type PlatformDebugContext = {
  entityType?: string;
  entityId?: string;
  module?: string;
  label: string;
};

export type PlatformHealthView = {
  scope: string;
  total: number;
  countsByCategory: Record<string, number>;
  countsByModule: Record<string, number>;
  countsBySeverity: Record<string, number>;
  limit: number;
  offset: number;
  diagnostics: ProductionDiagnostic[];
};

const SECRET_TEXT = /password|token|cookie|secret|authorization|connection|postgres:\/\/|bearer /i;

export function debugModeContract(value: unknown): { enabled: boolean; gap: string } {
  if (!value || typeof value !== "object" || !("debug_mode" in value) || typeof (value as { debug_mode?: unknown }).debug_mode !== "boolean") {
    return { enabled: false, gap: DEBUG_MODE_BACKEND_GAP };
  }
  return { enabled: (value as { debug_mode: boolean }).debug_mode, gap: "" };
}

export function filterHealthDiagnostics(
  rows: ProductionDiagnostic[],
  filter: HealthCategoryFilter,
  query: string,
): ProductionDiagnostic[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter !== "all" && row.category !== filter) return false;
    if (!needle) return true;
    return [row.entity_name, row.field_label, row.field, row.message, row.code, row.module ?? ""].join("\n").toLowerCase().includes(needle);
  });
}

export function traceNodeForSource(source: string): TraceNode | null {
  const text = source.trim().toLowerCase();
  if (text === "demand" || text.startsWith("demand ")) return "Demand";
  if (text === "scheduler" || text.includes("scheduler") || text.includes("calendarassignment")) return "Scheduler";
  if (text.includes("volume_qty_per_item") || text.includes("norm_qty_per_item") || text.includes("derived")) return "Derived";
  if (text.startsWith("technicalcard.") || text.startsWith("technical_card.") || text.includes("technicalcardoperationline") || text.includes("snapshot node")) return "Snapshot";
  if (text.includes("snapshot") && !text.includes("_")) return "Snapshot";
  if (text.endsWith(".id") || text.includes(".") || text.includes("_")) return "Source";
  return null;
}

export function traceChain(steps: DiagnosticTraceStep[] | undefined): Array<{ id: TraceNode; state: TraceNodeState }> {
  const seen = new Map<TraceNode, TraceNodeState>();
  for (const step of steps ?? []) {
    const node = traceNodeForSource(step.source);
    if (!node) continue;
    const current = seen.get(node);
    if (step.broken) seen.set(node, "broken");
    else if (current !== "broken") seen.set(node, "present");
  }
  return TRACE_CHAIN.map((id) => ({ id, state: seen.get(id) ?? "unknown" }));
}

export function debugContextFromPath(pathname: string): PlatformDebugContext | null {
  const card = /^\/production\/tech-cards\/(\d+)(?:\/|$)/.exec(pathname);
  if (card) return { entityType: "technical_card", entityId: card[1], label: `Техкарта ${card[1]}` };
  if (pathname.startsWith("/production/calendar")) return { module: "calendar", label: "Календарь" };
  if (pathname.startsWith("/settings/catalogs/routings")) return { module: "routing", label: "Маршруты" };
  if (pathname.startsWith("/settings/catalogs/work-centers")) return { module: "capacity", label: "Мощность" };
  return null;
}

export function safeFixHref(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("/") || url.startsWith("//") || url.includes("://") || url.includes("\\")) return null;
  return url;
}

export function formatDebugValue(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value);
    return SECRET_TEXT.test(text) ? "" : text;
  }
  if (Array.isArray(value)) return value.map(formatDebugValue).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, item]) => {
        if (SECRET_TEXT.test(key)) return [];
        const text = formatDebugValue(item);
        return text ? [`${key}: ${text}`] : [];
      })
      .join("; ");
  }
  return "";
}

export function diagnosticTechnicalRows(row: ProductionDiagnostic): Array<[string, string]> {
  const pairs: Array<[string, unknown]> = [
    ["code", row.code],
    ["severity", row.severity],
    ["category", row.category],
    ["module", row.module],
    ["entity_type", row.entity_type],
    ["entity_id", row.entity_id],
    ["field", row.field],
    ["fix_scope", row.fix_scope],
    ["operation_id", row.operation_id],
    ["resource_key", row.resource_key],
    ["formula", row.formula],
    ["reason", row.reason],
    ["expected_source", row.expected_source],
    ["fix_url", row.fix_url],
  ];
  for (const [key, value] of Object.entries(row.debug_details ?? {})) pairs.push([key, value]);
  return pairs.flatMap(([key, value]) => {
    if (SECRET_TEXT.test(key)) return [];
    const text = formatDebugValue(value);
    if (!text || SECRET_TEXT.test(text)) return [];
    return [[key, text]];
  });
}

function readCountMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const counts: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number" && Number.isFinite(item)) counts[key] = item;
  }
  return counts;
}

const DEBUG_LOG_FIELDS = [
  "code",
  "severity",
  "category",
  "module",
  "entity_type",
  "entity_id",
  "entity_name",
  "field",
  "field_label",
  "operation_id",
  "snapshot_node_id",
  "resource_key",
  "reason",
  "expected_source",
  "source_value",
  "actual_value",
  "fix_scope",
  "fix_url",
  "formula",
  "trace",
  "debug_details",
] as const;

export type DebugLogDocument = {
  generated_at: string;
  app: "sport-leads";
  page: string;
  module: string | null;
  entity_type: string | null;
  entity_id: string | null;
  context_label: string | null;
  filters: { category: string; query: string; offset: number };
  diagnostics_count: number;
  diagnostics_total: number;
  diagnostics: Array<Record<string, unknown>>;
};

function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (value == null || depth > 4) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim() === "" || SECRET_TEXT.test(value) ? null : value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, depth + 1)).filter((item) => item != null);
  }
  if (typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_TEXT.test(key)) continue;
      const clean = sanitizeLogValue(item, depth + 1);
      if (clean != null) next[key] = clean;
    }
    return next;
  }
  return null;
}

export function debugLogFilename(when: Date): string {
  const stamp = when.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "");
  return `Sport-Leads-debug-${stamp}.json`;
}

export function buildDebugLog(input: {
  generatedAt: Date;
  page: string;
  context: PlatformDebugContext | null;
  category: string;
  query: string;
  offset: number;
  total: number;
  diagnostics: ProductionDiagnostic[];
}): DebugLogDocument {
  const diagnostics = input.diagnostics.flatMap((row) => {
    const source = row as ProductionDiagnostic & Record<string, unknown>;
    const exported: Record<string, unknown> = {};
    for (const key of DEBUG_LOG_FIELDS) {
      const clean = sanitizeLogValue(source[key]);
      if (clean == null) continue;
      if (typeof clean === "object" && !Array.isArray(clean) && Object.keys(clean).length === 0) continue;
      if (Array.isArray(clean) && clean.length === 0) continue;
      exported[key] = clean;
    }
    return [exported];
  });
  return {
    generated_at: input.generatedAt.toISOString(),
    app: "sport-leads",
    page: input.page,
    module: input.context?.module ?? null,
    entity_type: input.context?.entityType ?? null,
    entity_id: input.context?.entityId ?? null,
    context_label: input.context?.label ?? null,
    filters: {
      category: input.category,
      query: input.query,
      offset: input.offset,
    },
    diagnostics_count: diagnostics.length,
    diagnostics_total: input.total,
    diagnostics,
  };
}

export function readPlatformHealth(value: unknown): PlatformHealthView | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const diagnostics = readDiagnostics(body.diagnostics);
  if (!Array.isArray(body.diagnostics) && body.diagnostics != null) return null;
  return {
    scope: typeof body.scope === "string" ? body.scope : "production",
    total: typeof body.total === "number" ? body.total : diagnostics.length,
    countsByCategory: readCountMap(body.counts_by_category),
    countsByModule: readCountMap(body.counts_by_module),
    countsBySeverity: readCountMap(body.counts_by_severity),
    limit: typeof body.limit === "number" ? body.limit : diagnostics.length,
    offset: typeof body.offset === "number" ? body.offset : 0,
    diagnostics,
  };
}
