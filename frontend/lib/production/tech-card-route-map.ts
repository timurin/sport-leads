import { operationHealthStatus, operationPlanLabel, operationWarningLabel, type OperationPlanningHealth } from "./planning-health.ts";
import type { RouteSchemeColumn, RouteSchemeStep } from "./tech-card-route-choice.ts";
import { formatReadyDate } from "./tech-card-route-choice.ts";

export type RouteMapTone = "completed" | "active" | "waiting" | "neutral" | "warning";

export type RouteMapLine = {
  sequence: number;
  operation_name: string;
  stage_order: number | null;
  production_stage_id?: number | null;
  source_kind?: string | null;
};

export type RouteMapStage = {
  id: number;
  stage_order: number;
  production_stage_id?: number | null;
  stage_label: string;
  status?: string | null;
  operation_name?: string | null;
  performer_name?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  work_center_id?: number | null;
  scrap_qty?: string | number | null;
  rework_qty?: string | number | null;
  source_routing_stage_line_id?: number | null;
};

export type RouteMapWorkCenter = { id: number; name: string };

export type RouteMapPlanStep = {
  routing_stage_line_id: number;
  planned_start_date: string;
  planned_end_date: string;
};

export type RouteMapDiagnostic = {
  code: string;
  severity: "error" | "warning" | "info";
  entity_name?: string | null;
  message?: string | null;
  fix_action?: string | null;
  snapshot_node_id?: number | null;
};

export type PresentedRouteStep = {
  step: RouteSchemeStep;
  statusLabel: string;
  tone: RouteMapTone;
  issue: string | null;
  fixAction: string | null;
  planLabel: string | null;
  equipment: string | null;
  performer: string | null;
  startedAt: string | null;
  completedAt: string | null;
  fact: string | null;
  isProtected: boolean;
  healthWarning: string | null;
};

export type PresentedRouteColumn = {
  key: string;
  workshop: string;
  statusLabel: string;
  tone: RouteMapTone;
  current: boolean;
  steps: PresentedRouteStep[];
};

export type PlanSummaryInput = {
  planning_state?: string | null;
  replan_required?: boolean | null;
  planned_start_date?: string | null;
  planned_completion_date?: string | null;
  shipping_date?: string | null;
  on_time?: boolean | null;
  buffer_days?: number | null;
  delay_days?: number | null;
};

export type PlanSummaryView = {
  mode: "empty" | "stale" | "ready";
  title: string;
  detail: string;
  actionLabel: string;
  start: string | null;
  ready: string | null;
  shipping: string | null;
  slack: string | null;
  risk: string | null;
  riskTone: "success" | "danger" | "warning" | "neutral";
};

const SETUP_ISSUE = "Эту операцию нужно настроить перед расчётом.";

export function dayCountLabel(days: number): string {
  const abs = Math.abs(days) % 100;
  const last = abs % 10;
  const word = abs > 10 && abs < 20 ? "дней" : last === 1 ? "день" : last >= 2 && last <= 4 ? "дня" : "дней";
  return `${days} ${word}`;
}

export function assemblyCaption(name: string | null | undefined, lines: RouteMapLine[]): string | null {
  const named = name?.trim();
  if (named) return named;
  const sewing = [...new Set(lines.filter((line) => line.source_kind === "sewing").map((line) => line.operation_name.trim()).filter(Boolean))];
  return sewing.length > 0 ? sewing.join(", ") : null;
}

function lineForStep(step: RouteSchemeStep, lines: RouteMapLine[]): RouteMapLine | undefined {
  if (step.kind !== "operation") return undefined;
  const match = /^line-(\d+)$/.exec(step.key);
  if (!match) return undefined;
  return lines.find((line) => line.sequence === Number(match[1]));
}

function stageForLine(line: RouteMapLine, stages: RouteMapStage[]): RouteMapStage | undefined {
  const sameSlot = stages.filter((stage) =>
    stage.stage_order === line.stage_order
    && (line.production_stage_id == null || stage.production_stage_id == null || stage.production_stage_id === line.production_stage_id),
  );
  const named = sameSlot.find((stage) => stage.operation_name && stage.operation_name === line.operation_name);
  if (named) return named;
  return sameSlot.length === 1 ? sameSlot[0] : undefined;
}

function stageByNode(nodeId: string, stages: RouteMapStage[]): RouteMapStage | undefined {
  const match = /^snapshot:(\d+)$/.exec(nodeId);
  if (!match) return undefined;
  return stages.find((stage) => stage.id === Number(match[1]));
}

function friendlyIssue(row: RouteMapDiagnostic): string {
  const message = row.message ?? "";
  if (message.includes("Объём операции") || message.toLowerCase().includes("метраж")) {
    return "Для этой операции не указан расход на одно изделие.";
  }
  const action = row.fix_action?.trim() ?? "";
  if (action && !action.includes("_")) return action;
  const cleaned = message.trim().replace(/^Операция «[^»]+»:\s*/, "");
  if (cleaned && !cleaned.includes("_") && !cleaned.includes("требуется исправление")) return cleaned;
  return SETUP_ISSUE;
}

function issueForNames(names: string[], stageId: number | null, diagnostics: RouteMapDiagnostic[]): RouteMapDiagnostic | null {
  return diagnostics.find((row) => {
    if (row.severity === "info") return false;
    if (stageId != null && row.snapshot_node_id === stageId) return true;
    if (row.entity_name && names.includes(row.entity_name)) return true;
    return names.some((name) => (row.message ?? "").includes(`«${name}»`));
  }) ?? null;
}

function equipmentName(id: number | null | undefined, centers: RouteMapWorkCenter[]): string | null {
  if (id == null) return null;
  const name = centers.find((row) => row.id === id)?.name?.trim();
  return name || null;
}

function planLabel(stage: RouteMapStage | undefined, planSteps: RouteMapPlanStep[]): string | null {
  const lineId = stage?.source_routing_stage_line_id;
  if (lineId == null) return null;
  const step = planSteps.find((row) => row.routing_stage_line_id === lineId);
  if (!step) return null;
  const start = formatReadyDate(step.planned_start_date);
  const end = formatReadyDate(step.planned_end_date);
  if (!start) return null;
  return !end || end === start ? start : `${start}–${end}`;
}

function factLabel(stage: RouteMapStage | undefined): string | null {
  if (!stage) return null;
  const scrap = stage.scrap_qty;
  const rework = stage.rework_qty;
  const hasScrap = scrap != null && String(scrap).trim() !== "";
  const hasRework = rework != null && String(rework).trim() !== "";
  if (!hasScrap && !hasRework) return null;
  return `Брак ${hasScrap ? scrap : "—"}, доработка ${hasRework ? rework : "—"}`;
}

function stepFacts(
  stage: RouteMapStage | undefined,
  names: string[],
  diagnostics: RouteMapDiagnostic[],
  centers: RouteMapWorkCenter[],
  planSteps: RouteMapPlanStep[],
): Pick<PresentedRouteStep, "issue" | "fixAction" | "planLabel" | "equipment" | "performer" | "startedAt" | "completedAt" | "fact"> {
  const hit = issueForNames(names, stage?.id ?? null, diagnostics);
  const action = hit?.fix_action?.trim() ?? "";
  return {
    issue: hit ? friendlyIssue(hit) : null,
    fixAction: action && !action.includes("_") ? action : null,
    planLabel: planLabel(stage, planSteps),
    equipment: equipmentName(stage?.work_center_id, centers),
    performer: stage?.performer_name?.trim() || null,
    startedAt: stage?.started_at ?? null,
    completedAt: stage?.completed_at ?? null,
    fact: factLabel(stage),
  };
}

function operationPresentation(
  status: string | null | undefined,
  waiting: boolean,
): { statusLabel: string; tone: RouteMapTone } {
  if (status === "completed") return { statusLabel: "Завершена", tone: "completed" };
  if (status === "in_progress") return { statusLabel: "В работе", tone: "active" };
  if (status === "skipped") return { statusLabel: "Пропущена", tone: "neutral" };
  if (waiting) return { statusLabel: "Ожидает", tone: "waiting" };
  return { statusLabel: "Запланирована", tone: "neutral" };
}

function columnPresentation(steps: PresentedRouteStep[], current: boolean, workshopState: string | null | undefined): {
  statusLabel: string;
  tone: RouteMapTone;
} {
  if (steps.some((step) => step.statusLabel === "Просрочена")) return { statusLabel: "Просрочена", tone: "warning" };
  if (steps.some((step) => step.tone === "active")) return { statusLabel: "В работе", tone: "active" };
  if (current && workshopState === "in_progress") return { statusLabel: "В работе", tone: "active" };
  if (current && workshopState === "waiting") return { statusLabel: "Ожидает", tone: "waiting" };
  if (steps.length > 0 && steps.every((step) => step.statusLabel === "Завершена" || step.statusLabel === "Пропущена")) {
    return { statusLabel: "Завершена", tone: "completed" };
  }
  if (steps.some((step) => step.issue)) return { statusLabel: "Требует настройки", tone: "warning" };
  if (current) return { statusLabel: "В работе", tone: "active" };
  return { statusLabel: "Запланирована", tone: "neutral" };
}

function healthForStage(stage: RouteMapStage | undefined, operations: OperationPlanningHealth[] | undefined): OperationPlanningHealth | undefined {
  if (!stage || !operations) return undefined;
  return operations.find((operation) => operation.snapshot_node_id === stage.id);
}

function withHealth(
  presented: { statusLabel: string; tone: RouteMapTone },
  facts: Pick<PresentedRouteStep, "issue" | "fixAction" | "planLabel" | "equipment" | "performer" | "startedAt" | "completedAt" | "fact">,
  operation: OperationPlanningHealth | undefined,
): Pick<PresentedRouteStep, "statusLabel" | "tone" | "planLabel" | "isProtected" | "healthWarning"> & typeof facts {
  if (!operation) {
    return { ...presented, ...facts, isProtected: false, healthWarning: null };
  }
  const statusLabel = operationHealthStatus(operation);
  const tone: RouteMapTone = statusLabel === "Просрочена"
    ? "warning"
    : statusLabel === "Завершена"
      ? "completed"
      : statusLabel === "В работе"
        ? "active"
        : facts.issue
          ? "warning"
          : "neutral";
  return {
    ...facts,
    statusLabel,
    tone,
    planLabel: operationPlanLabel(operation) ?? facts.planLabel,
    isProtected: operation.is_protected,
    healthWarning: operationWarningLabel(operation.warning_code),
  };
}

function presentColumnStep(
  step: RouteSchemeStep,
  workshop: string,
  input: { lines: RouteMapLine[]; stages: RouteMapStage[]; currentStageOrder?: number | null },
  diagnostics: RouteMapDiagnostic[],
  currentLabel: string | null,
  centers: RouteMapWorkCenter[],
  planSteps: RouteMapPlanStep[],
  operations: OperationPlanningHealth[] | undefined,
): PresentedRouteStep | null {
  const inCurrentWorkshop = currentLabel != null && currentLabel === workshop;
  if (step.kind === "operation") {
    const line = lineForStep(step, input.lines);
    if (line?.source_kind === "sewing") return null;
    const stage = line ? stageForLine(line, input.stages) : undefined;
    const waiting = (input.currentStageOrder != null && stage?.stage_order === input.currentStageOrder) || inCurrentWorkshop;
    const presented = operationPresentation(
      stage?.status,
      waiting && stage?.status !== "completed" && stage?.status !== "in_progress" && stage?.status !== "skipped",
    );
    const facts = stepFacts(stage, [step.label], diagnostics, centers, planSteps);
    const health = withHealth(
      { statusLabel: presented.statusLabel, tone: facts.issue && presented.tone === "neutral" ? "warning" : presented.tone },
      facts,
      healthForStage(stage, operations),
    );
    return { step, ...health };
  }
  const selected = step.options.find((option) => option.selected);
  const stage = selected ? stageByNode(selected.nodeId, input.stages) : undefined;
  const waiting = (input.currentStageOrder != null && stage?.stage_order === input.currentStageOrder) || inCurrentWorkshop;
  const presented = operationPresentation(
    stage?.status,
    Boolean(waiting && stage && stage.status !== "completed" && stage.status !== "in_progress"),
  );
  const facts = stepFacts(stage, step.options.map((option) => option.label), diagnostics, centers, planSteps);
  const health = withHealth(
    {
      statusLabel: stage ? presented.statusLabel : "Запланирована",
      tone: facts.issue ? "warning" : presented.tone,
    },
    facts,
    healthForStage(stage, operations),
  );
  return { step, ...health };
}

export function routeOperationCountLabel(count: number): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  const word = abs > 10 && abs < 20 ? "операций" : last === 1 ? "операция" : last >= 2 && last <= 4 ? "операции" : "операций";
  return `Маршрут · ${count} ${word}`;
}

export function presentRouteMap(input: {
  lines: RouteMapLine[];
  stages: RouteMapStage[];
  columns: RouteSchemeColumn[];
  assemblyName?: string | null;
  currentStageLabel?: string | null;
  currentStageOrder?: number | null;
  workshopState?: string | null;
  diagnostics?: RouteMapDiagnostic[];
  workCenters?: RouteMapWorkCenter[];
  planSteps?: RouteMapPlanStep[];
  healthOperations?: OperationPlanningHealth[];
}): { assembly: string | null; columns: PresentedRouteColumn[] } {
  const diagnostics = input.diagnostics ?? [];
  const centers = input.workCenters ?? [];
  const planSteps = input.planSteps ?? [];
  const currentLabel = input.currentStageLabel?.trim() || null;
  const columns = input.columns.flatMap((column) => {
    const steps: PresentedRouteStep[] = [];
    for (const step of column.steps) {
      const presented = presentColumnStep(step, column.workshop, input, diagnostics, currentLabel, centers, planSteps, input.healthOperations);
      if (presented) steps.push(presented);
    }
    if (steps.length === 0) return [];
    const current = (currentLabel != null && currentLabel === column.workshop)
      || steps.some((step) => {
        if (step.step.kind === "operation") {
          const line = lineForStep(step.step, input.lines);
          const stage = line ? stageForLine(line, input.stages) : undefined;
          return input.currentStageOrder != null && stage?.stage_order === input.currentStageOrder;
        }
        return false;
      });
    const summary = columnPresentation(steps, current, input.workshopState);
    return [{
      key: column.key,
      workshop: column.workshop,
      statusLabel: summary.statusLabel,
      tone: summary.tone,
      current,
      steps,
    }];
  });
  return { assembly: assemblyCaption(input.assemblyName, input.lines), columns };
}

export function presentPlanSummary(
  summary: PlanSummaryInput | null | undefined,
  cardShipping?: string | null,
): PlanSummaryView {
  const stale = summary?.planning_state === "stale"
    || summary?.planning_state === "invalid"
    || summary?.replan_required === true;
  const ready = formatReadyDate(summary?.planned_completion_date);
  const dates = {
    start: formatReadyDate(summary?.planned_start_date),
    ready,
    shipping: formatReadyDate(summary?.shipping_date ?? cardShipping),
    slack: summary?.buffer_days != null && summary.buffer_days > 0 ? dayCountLabel(summary.buffer_days) : null,
    risk: summary?.delay_days != null && summary.delay_days > 0
      ? `Опоздание ${dayCountLabel(summary.delay_days)}`
      : summary?.on_time === false
        ? "Риск срока"
        : summary?.on_time === true
          ? "В срок"
          : null,
    riskTone: (summary?.delay_days != null && summary.delay_days > 0) || summary?.on_time === false
      ? "danger" as const
      : summary?.on_time === true
        ? "success" as const
        : "neutral" as const,
  };
  if (stale) {
    return {
      mode: "stale",
      title: "План нужно обновить",
      detail: "После изменений в техкарте сохранённый расчёт больше не актуален.",
      actionLabel: "Пересчитать",
      ...dates,
      risk: dates.risk ?? "Нужен пересчёт",
      riskTone: "warning",
    };
  }
  if (!ready || summary?.planning_state === "unplanned" || summary?.planning_state === "unknown" || summary == null) {
    return {
      mode: "empty",
      title: "План не рассчитан",
      detail: "Укажите даты и рассчитайте производственный план.",
      actionLabel: "Рассчитать план",
      start: null,
      ready: null,
      shipping: dates.shipping,
      slack: null,
      risk: null,
      riskTone: "neutral",
    };
  }
  return {
    mode: "ready",
    title: "Производственный план",
    detail: "",
    actionLabel: "Пересчитать план",
    ...dates,
  };
}
