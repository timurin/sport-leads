import type { RouteVariantRecord } from "@/lib/route-variants";

export type SchemeStage = {
  id: number;
  stage_order: number;
  production_stage_id?: number | null;
  stage_label: string;
  source_routing_stage_line_id?: number | null;
  operation_name?: string | null;
};

export type SchemeLine = {
  sequence: number;
  operation_name: string;
  stage_order: number | null;
  production_stage_id?: number | null;
};

export type RouteSchemeOption = {
  nodeId: string;
  label: string;
  selected: boolean;
  isDefault: boolean;
  status: "preliminary" | "confirmed" | null;
};

export type RouteSchemeStep =
  | { kind: "operation"; key: string; label: string }
  | {
      kind: "variant";
      key: string;
      name: string;
      caption: "Выполняется один вариант";
      status: "preliminary" | "confirmed";
      options: RouteSchemeOption[];
    };

export type RouteSchemeColumn = {
  key: string;
  workshop: string;
  steps: RouteSchemeStep[];
};

export type RouteChoiceRecommendation =
  | { supported: true; name: string; daysEarlier: number; nodeId?: string; groupId?: string }
  | { supported: false; gap: "BACKEND GAP" };

export const FORECAST_EMPTY = "Прогноз появится после расчёта плана";
export const SETUP_NOTE = "Настройку выполняет администратор производства.";

type Blocker = {
  code: string;
  reason: string;
  routing_stage_line_id?: number | null;
};

type BlockerStep = {
  routing_stage_line_id: number;
  snapshot_node_id?: number | null;
};

function stageForLine(line: SchemeLine, stages: SchemeStage[]): SchemeStage | undefined {
  return stages.find((stage) =>
    stage.stage_order === line.stage_order
    && (line.production_stage_id == null || stage.production_stage_id == null || stage.production_stage_id === line.production_stage_id),
  );
}

export function snapshotOperationName(nodeId: string, stages: SchemeStage[], lines: SchemeLine[]): string {
  const match = /^snapshot:(\d+)$/.exec(nodeId);
  if (!match) return "Операция";
  const stage = stages.find((item) => item.id === Number(match[1]));
  if (!stage) return "Операция";
  const line = lines.find((item) =>
    item.stage_order === stage.stage_order
    && (item.production_stage_id == null || stage.production_stage_id == null || item.production_stage_id === stage.production_stage_id),
  );
  return line?.operation_name || stage.stage_label || "Операция";
}

export function buildRouteScheme(
  lines: SchemeLine[],
  stages: SchemeStage[],
  variants: RouteVariantRecord[],
): RouteSchemeColumn[] {
  const membership = new Map<string, RouteVariantRecord>();
  for (const variant of variants) {
    for (const member of variant.group.members) membership.set(member.operation_node_id, variant);
  }
  const emitted = new Set<string>();
  const steps: { workshop: string; step: RouteSchemeStep }[] = [];
  const ordered = [...lines].sort((left, right) => left.sequence - right.sequence);
  for (const line of ordered) {
    const stage = stageForLine(line, stages);
    const nodeId = stage ? `snapshot:${stage.id}` : null;
    const variant = nodeId ? membership.get(nodeId) : undefined;
    if (variant) {
      if (emitted.has(variant.group.id)) continue;
      emitted.add(variant.group.id);
      const selected = variant.selected_operation_snapshot_node_id;
      steps.push({
        workshop: stage?.stage_label || "Цех",
        step: {
          kind: "variant",
          key: variant.group.id,
          name: variant.group.name,
          caption: "Выполняется один вариант",
          status: variant.selection_status,
          options: [...variant.group.members]
            .sort((left, right) => left.position - right.position)
            .map((member) => ({
              nodeId: member.operation_node_id,
              label: snapshotOperationName(member.operation_node_id, stages, lines),
              selected: member.operation_node_id === selected,
              isDefault: member.operation_node_id === variant.group.default_operation_node_id,
              status: member.operation_node_id === selected ? variant.selection_status : null,
            })),
        },
      });
      continue;
    }
    steps.push({
      workshop: stage?.stage_label || "Цех",
      step: { kind: "operation", key: `line-${line.sequence}`, label: line.operation_name },
    });
  }
  const columns: RouteSchemeColumn[] = [];
  for (const item of steps) {
    const last = columns.at(-1);
    if (last && last.workshop === item.workshop) last.steps.push(item.step);
    else columns.push({ key: `${item.workshop}-${columns.length}`, workshop: item.workshop, steps: [item.step] });
  }
  return columns;
}

function operationQuote(name: string | null): string {
  return name ? ` «${name}»` : "";
}

export function managerBlockerText(deviation: Blocker, operationName?: string | null): string {
  const operation = operationQuote(operationName ?? null);
  const reason = deviation.reason;
  if (reason === "missing_cutting_mode") {
    return `Не настроен способ раскроя операции${operation}. Обратитесь к администратору производства.`;
  }
  if (
    reason === "missing_operator_norm"
    || reason === "missing_fixed_norm"
    || reason === "missing_sewing_norm"
    || deviation.code === "manual_required"
    || deviation.code === "demand_calculation_missing"
  ) {
    return `Не настроена производственная норма операции${operation}. Обратитесь к администратору производства.`;
  }
  if (deviation.code === "capacity_missing" || deviation.code === "no_available_capacity" || deviation.code === "capacity_unit_mismatch") {
    return `Для операции${operation} не настроена мощность. Обратитесь к администратору производства.`;
  }
  if (deviation.code === "deadline_missed") return "Срок отгрузки не выдержан.";
  if (deviation.code === "locked_assignment_conflict") return "План техкарты заблокирован. Сначала разблокируйте план.";
  if (deviation.code === "readiness_not_complete") {
    return "Маршрут или операция ещё не готовы к расчёту. Обратитесь к администратору производства.";
  }
  return "Маршрут требует настройки. Обратитесь к администратору производства.";
}

export function managerBlockers(
  deviations: Blocker[] | null | undefined,
  steps: BlockerStep[] | null | undefined,
  stages: SchemeStage[],
  lines: SchemeLine[],
): { headline: string | null; items: string[] } {
  const rows = deviations ?? [];
  const setup = rows.filter((item) => item.code !== "deadline_missed");
  const items = rows.map((item) => {
    const step = steps?.find((row) => row.routing_stage_line_id === item.routing_stage_line_id);
    const fromStep = step?.snapshot_node_id != null
      ? snapshotOperationName(`snapshot:${step.snapshot_node_id}`, stages, lines)
      : null;
    const fromStage = stages.find((row) =>
      item.routing_stage_line_id != null && row.source_routing_stage_line_id === item.routing_stage_line_id,
    )?.operation_name;
    const name = fromStep && fromStep !== "Операция" ? fromStep : fromStage;
    return managerBlockerText(item, name || null);
  });
  return { headline: setup.length > 0 ? "Маршрут требует настройки" : null, items };
}

function dayNumber(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000);
}

export function routeChoiceRecommendation(source: {
  selectedCompletionDate?: string | null;
  alternatives?: { name: string; planned_completion_date: string; nodeId?: string; groupId?: string }[] | null;
} = {}): RouteChoiceRecommendation {
  const alternatives = source.alternatives ?? [];
  const selected = source.selectedCompletionDate ? dayNumber(source.selectedCompletionDate) : null;
  if (alternatives.length < 2 || selected == null) return { supported: false, gap: "BACKEND GAP" };
  const ranked = alternatives.flatMap((item) => {
    const day = dayNumber(item.planned_completion_date);
    return day == null ? [] : [{ name: item.name, day, nodeId: item.nodeId, groupId: item.groupId }];
  });
  if (ranked.length < 2) return { supported: false, gap: "BACKEND GAP" };
  const best = ranked.reduce((left, right) => (right.day < left.day ? right : left));
  const daysEarlier = selected - best.day;
  if (daysEarlier <= 0) return { supported: false, gap: "BACKEND GAP" };
  return best.nodeId
    ? { supported: true, name: best.name, daysEarlier, nodeId: best.nodeId, groupId: best.groupId }
    : { supported: true, name: best.name, daysEarlier };
}

export function recommendationEarlierText(days: number): string {
  const phrase = daysEarlierLabel(days);
  return `Ожидаемая ${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}`;
}

export function managerWarningCallout(input: { headline: string | null; items: string[] } | null): {
  title: string;
  lines: string[];
  note: string;
} | null {
  if (!input?.headline) return null;
  const lines = input.items
    .filter((item) => item !== "Срок отгрузки не выдержан.")
    .map((item) => item.replace(" Обратитесь к администратору производства.", "").trim());
  if (lines.length === 0) return null;
  return { title: input.headline, lines, note: SETUP_NOTE };
}

export function formatReadyDate(iso: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!match) return null;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function daysEarlierLabel(days: number): string {
  const abs = Math.abs(days) % 100;
  const last = abs % 10;
  const word = abs > 10 && abs < 20 ? "дней" : last === 1 ? "день" : last >= 2 && last <= 4 ? "дня" : "дней";
  return `Готовность на ${days} ${word} раньше`;
}
