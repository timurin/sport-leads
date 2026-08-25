/**
 * Sewing cabinet view helpers (ADR-029 / Stage 24).
 */

export type SewingPeriodPreset = "day" | "week" | "month" | "custom";

export type SewingCabinetProfile = {
  id: number;
  login: string;
  display_name: string;
  photo_url: string | null;
};

export type SewingWorkEntry = {
  id: number;
  platform_user_id: number;
  technical_card_id: number;
  technical_card_number: string;
  kind: "piece" | "operation";
  operation_line_id: number | null;
  qty: string;
  status: "reserved" | "completed" | "released";
  unit_price: string;
  price_label: string;
  amount: string;
  taken_at: string;
  completed_at: string | null;
  released_at: string | null;
};

export type SewingQueueOperation = {
  operation_line_id: number;
  operation_name: string;
  volume: string;
  remaining: string;
  unit_price: string | null;
};

export type SewingQueueCard = {
  technical_card_id: number;
  number: string;
  nomenclature_name: string | null;
  product_model_name: string | null;
  assembly_variant_name: string | null;
  piece_cap: number;
  piece_remaining: string;
  piece_unit_price: string | null;
  operations: SewingQueueOperation[];
};

export type SewingCabinet = {
  profile: SewingCabinetProfile;
  period: {
    preset: SewingPeriodPreset;
    date_from: string;
    date_to: string;
  };
  earnings_completed: string;
  reserved: SewingWorkEntry[];
  history: SewingWorkEntry[];
  queue: SewingQueueCard[] | null;
  can_write: boolean;
  can_manage: boolean;
};

export type SewingSewerListItem = {
  id: number;
  login: string;
  display_name: string;
  photo_url: string | null;
  reserved_count: number;
  earnings_completed: string;
};

export function sewingWorkStatusLabel(status: SewingWorkEntry["status"]): string {
  if (status === "reserved") return "В резерве";
  if (status === "completed") return "Отшито";
  return "Отказались";
}

export function sewingWorkKindLabel(kind: SewingWorkEntry["kind"]): string {
  return kind === "piece" ? "Изделие" : "Операция";
}

export function parseSewingPeriodPreset(
  value: string | null | undefined,
): SewingPeriodPreset {
  if (value === "week" || value === "month" || value === "custom") return value;
  return "day";
}

export function sewerMatchesQuery(
  item: SewingSewerListItem,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    item.display_name.toLowerCase().includes(needle) ||
    item.login.toLowerCase().includes(needle)
  );
}

export function sewingQueueCardTitle(card: SewingQueueCard): string {
  return (
    card.nomenclature_name ||
    card.product_model_name ||
    card.assembly_variant_name ||
    card.number
  );
}
