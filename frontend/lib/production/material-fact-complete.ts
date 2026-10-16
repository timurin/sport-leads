export const MATERIAL_FACT_GATE_MARKER = "MATERIAL fact_qty required";

export const MATERIAL_FACT_OPERATOR_MESSAGE =
  "Укажите фактический расход материалов перед завершением операции.";

export const MATERIAL_FACT_REQUIRED_MESSAGE = "Укажите фактический расход.";

export const MATERIAL_FACT_NUMBER_MESSAGE = "Укажите число не меньше 0.";

export const MATERIAL_FACT_SAVE_FAILED_MESSAGE =
  "Не удалось сохранить фактический расход.";

export type MaterialFactStageRef = {
  stage_order: number;
  production_stage_id?: number | null;
  tech_operation_id?: number | null;
};

export type MaterialFactLineSource = {
  id: number;
  sequence: number;
  line_kind: string;
  snapshot_name: string;
  planned_qty: string | number | null;
  fact_qty?: string | number | null;
  production_stage_id?: number | null;
  tech_operation_id?: number | null;
  unit: string | null;
};

export type MaterialFactDraft = {
  lineId: number;
  name: string;
  unit: string;
  plannedQty: string;
  factQty: string;
};

export function isMaterialFactGateError(message: string | null | undefined): boolean {
  return (message ?? "").includes(MATERIAL_FACT_GATE_MARKER);
}

function qtyText(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value).trim();
}

export function stageMaterialFactDrafts(
  stageResults: MaterialFactStageRef[],
  lines: MaterialFactLineSource[],
  stageOrder: number,
): MaterialFactDraft[] {
  const stage = stageResults.find((row) => row.stage_order === stageOrder);
  const stageId = stage?.production_stage_id;
  if (stageId == null) return [];
  const operationId = stage?.tech_operation_id ?? null;
  const siblings = stageResults.filter(
    (row) => row.production_stage_id === stageId && row.tech_operation_id != null,
  );
  return lines
    .filter((line) => {
      if (line.line_kind !== "material" || line.production_stage_id !== stageId) return false;
      if (line.tech_operation_id != null) return line.tech_operation_id === operationId;
      return operationId == null || siblings.length <= 1;
    })
    .slice()
    .sort((left, right) => left.sequence - right.sequence || left.id - right.id)
    .map((line) => {
      const plannedQty = qtyText(line.planned_qty);
      const recordedFact = qtyText(line.fact_qty);
      return {
        lineId: line.id,
        name: line.snapshot_name,
        unit: line.unit?.trim() || "—",
        plannedQty,
        factQty: recordedFact || plannedQty,
      };
    });
}

export function validateMaterialFactQty(value: string): string | null {
  const text = value.trim();
  if (!text) return MATERIAL_FACT_REQUIRED_MESSAGE;
  if (!/^\d+(\.\d+)?$/.test(text)) return MATERIAL_FACT_NUMBER_MESSAGE;
  return null;
}

export function materialFactSaveError(message: string | null | undefined): string {
  const text = message ?? "";
  if (text.includes("fact_qty must be >= 0") || text.includes("Invalid fact_qty")) {
    return MATERIAL_FACT_NUMBER_MESSAGE;
  }
  if (isMaterialFactGateError(text)) return MATERIAL_FACT_OPERATOR_MESSAGE;
  if (
    text.startsWith("Недостаточно прав")
    || text === "Требуется вход"
    || text.startsWith("Укажите")
  ) {
    return text;
  }
  return MATERIAL_FACT_SAVE_FAILED_MESSAGE;
}
