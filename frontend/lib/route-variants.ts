export type RouteVariantGroupMember = {
  operation_node_id: string;
  position: number;
};

export type RouteVariantGroup = {
  id: string;
  workshop_id: number;
  name: string;
  code: string | null;
  selection_mode: "one_of";
  members: RouteVariantGroupMember[];
  default_operation_node_id: string | null;
  active: boolean;
};

export type RouteVariantRecord = {
  group: RouteVariantGroup;
  selected_operation_snapshot_node_id: string | null;
  selection_status: "preliminary" | "confirmed";
};

export const VARIANT_PRELIMINARY_HELP = "Этот вариант используется для предварительного производственного плана и расчёта даты готовности.";
export const VARIANT_CONFIRMED_HELP = "Вариант подтверждён производством.";
export const VARIANT_REPLAN_HINT = "Вариант изменён. Для обновления календаря пересчитайте план.";

export function variantStatusLabel(status: RouteVariantRecord["selection_status"]): string {
  return status === "confirmed" ? "Подтверждено" : "Предварительно";
}

export function variantConflictMessage(detail: string): string {
  const text = detail.toLowerCase();
  if (text.includes("started") || text.includes("completed")) {
    return "Способ раскроя нельзя изменить: операция уже запущена в производство.";
  }
  if (text.includes("manual") || text.includes("locked assignments")) {
    return "Нельзя изменить вариант: у прежнего варианта есть ручные или заблокированные назначения.";
  }
  if (text.includes("plan is locked") || text.includes("card plan is locked")) {
    return "Нельзя изменить вариант: план техкарты заблокирован. Сначала разблокируйте план.";
  }
  if (text.includes("demoted") || text.includes("cannot be demoted")) {
    return "Подтверждённый вариант нельзя вернуть в предварительный без смены операции.";
  }
  if (text.includes("not editable")) {
    return "Этот вариант сейчас нельзя изменить.";
  }
  return "Не удалось изменить вариант.";
}
