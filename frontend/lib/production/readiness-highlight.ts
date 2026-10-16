import {
  diagnosticEditorTarget,
  uniqueDiagnostics,
  type ProductionDiagnostic,
} from "./readiness-stickers.ts";
import type { OperationEditorTab } from "../tech-operation-ux.ts";

const SECTION_FIELDS = new Set(["demand_rule", "calculation_mode", "work_center_id", "capacity_resource_keys"]);

export type HighlightTone = "danger" | "warning";

export type DiagnosticHighlight = {
  tab: OperationEditorTab;
  fieldId: string;
  scope: "field" | "section";
};

export function diagnosticHighlight(row: ProductionDiagnostic): DiagnosticHighlight {
  const target = diagnosticEditorTarget(row);
  const scope = SECTION_FIELDS.has(target.fieldId) || row.fix_scope === "work_center" ? "section" : "field";
  return { tab: target.tab, fieldId: target.fieldId, scope };
}

export function sectionSetupText(row: ProductionDiagnostic): string {
  return `Требует настройки: ${row.field_label}`;
}

export function highlightClass(tone: HighlightTone): string {
  return tone === "warning"
    ? "rounded-portal-md border border-portal-warning bg-portal-warning-soft p-portal-2"
    : "rounded-portal-md border border-portal-danger bg-portal-danger-soft p-portal-2";
}

export function headerDiagnosticPreview(rows: ProductionDiagnostic[]): { first: ProductionDiagnostic | null; rest: ProductionDiagnostic[] } {
  const unique = uniqueDiagnostics(rows);
  return { first: unique[0] ?? null, rest: unique.slice(1) };
}

export function diagnosticsOnTab(rows: ProductionDiagnostic[], tab: OperationEditorTab): ProductionDiagnostic[] {
  return uniqueDiagnostics(rows).filter((row) => diagnosticHighlight(row).tab === tab);
}

export function fieldHighlight(
  rows: ProductionDiagnostic[],
  fieldId: string,
): { message: string; tone: HighlightTone; scope: "field" | "section" } | null {
  const matches = uniqueDiagnostics(rows).filter((row) => diagnosticHighlight(row).fieldId === fieldId && row.severity !== "info");
  const row = matches.find((item) => item.severity === "error") ?? matches[0];
  if (!row) return null;
  const target = diagnosticHighlight(row);
  return {
    message: target.scope === "section" ? sectionSetupText(row) : row.message,
    tone: row.severity === "warning" ? "warning" : "danger",
    scope: target.scope,
  };
}

/** First paint only. After the user picks a tab or a field, keep their choice. */
export function openingTab(options: {
  requestedTab: OperationEditorTab;
  requestedField: string | null;
  diagnostics: ProductionDiagnostic[];
  userSteered: boolean;
}): OperationEditorTab {
  if (options.userSteered || options.requestedField) return options.requestedTab;
  const blocking = uniqueDiagnostics(options.diagnostics).find((row) => row.severity === "error");
  return blocking ? diagnosticHighlight(blocking).tab : options.requestedTab;
}
