export type TechCardWipStatus =
  | "return"
  | "ready"
  | "partial_ready"
  | "in_work";

export type TechCardScanUnit = {
  id: number;
  unit_index: number;
  size: string | null;
  personalization: string | null;
  print_number: string | null;
  production_stage_id: number | null;
  stage_label: string | null;
  last_transfer_kind: string | null;
  fg_receipt_posted: boolean;
  fg_issue_posted: boolean;
};

export type TechCardScanStage = {
  production_stage_id: number;
  stage_order: number;
  stage_label: string;
  stage_code: string | null;
  relation: string;
};

export type TechCardScanMaterial = {
  composition_line_id: number;
  snapshot_name: string;
  planned_qty: string | number | null;
  fact_qty: string | number | null;
  unit: string | null;
  production_stage_id: number | null;
};

export type TechCardScan = {
  technical_card_id: number;
  number: string;
  status: string;
  wip_status: TechCardWipStatus | string;
  wip_status_label: string;
  quantity: string | number;
  nomenclature_name: string | null;
  current_stage_label: string | null;
  scan_url: string;
  restricted_sewing_only: boolean;
  units: TechCardScanUnit[];
  allowed_stages: TechCardScanStage[];
  material_lines: TechCardScanMaterial[];
  updated_at: string;
};

export type TechCardScanCommand = {
  production_stage_id: number;
  unit_line_ids: number[];
  performer_name?: string;
  work_done?: string;
  duration_seconds?: number | null;
  notes?: string;
  material_facts?: { composition_line_id: number; fact_qty: string }[];
};

export function techCardWipStatusLabel(status: string): string {
  if (status === "return") return "Возврат";
  if (status === "ready") return "Готова";
  if (status === "partial_ready") return "Частично готова";
  return "В работе";
}

export function isTechCardScanPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path.startsWith("/production/scan/");
}
