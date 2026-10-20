/** Present GET readiness issues. This module does not decide whether a field is required. */

import { STEP_SECTIONS, type ReadinessIssue, type ReadinessStep, type TechnicalCardReadiness } from "./tech-card-readiness.ts";

export type PreflightTrigger = "schedule" | "launch" | "model";

export type PreflightContext = {
  catalogNormOperations?: string[];
  assemblyName?: string | null;
};

export type PreflightItem = {
  key: string;
  code: string;
  severity: "error" | "warning";
  title: string;
  detail: string;
  why: string;
  actionLabel: string | null;
  sectionId: string | null;
  fallbackId: string | null;
  tab: string | null;
  kind: "section" | "norms";
  operations: string[];
  /** Operation this action should land on. Presentation only; not a readiness rule. */
  focusOperation: string | null;
  reasons: string[];
  /** Canonical diagnostic field when the readiness payload includes one. */
  diagnosticField: string | null;
  /** Original codes folded into this card. Presentation only. */
  sourceCodes: string[];
};

const NORM_CODES = new Set(["missing_operator_norm", "missing_fixed_norm", "missing_cutting_rate"]);
const METER_CODES = new Set(["missing_linear_meters"]);
const SEWING_CODES = new Set(["missing_sewing_norm", "sewing_norm_unverified"]);
const PLAN_CODES = new Set([
  "saved_plan_required",
  "saved_plan_requires_review",
  "quantity_planning_start_shipping_required",
  "calendar_plan_stale_after_demand_change",
]);

const SKIP: Record<PreflightTrigger, Set<string>> = {
  schedule: new Set(["saved_plan_required", "saved_plan_requires_review", "calendar_plan_stale_after_demand_change", "readiness_incomplete", "launch_not_available"]),
  launch: new Set(["readiness_incomplete"]),
  model: new Set(["saved_plan_required", "saved_plan_requires_review", "readiness_incomplete", "launch_not_available", "planning_dates_required"]),
};

const MODEL_STEPS = new Set(["model", "norms"]);

const PLAN_REASONS: Record<string, string> = {
  saved_plan_required: "План ещё не рассчитан.",
  saved_plan_requires_review: "Сохранённый план нужно проверить.",
  quantity_planning_start_shipping_required: "Для расчёта не хватает количества, даты начала или даты отгрузки.",
  calendar_plan_stale_after_demand_change: "После изменений в техкарте сохранённый план больше не актуален.",
};

/** These readiness codes are cleared by the existing calculate/recalculate action. */
const SCHEDULE_ACTION_CODES = new Set([
  "saved_plan_required",
  "saved_plan_requires_review",
  "calendar_plan_stale_after_demand_change",
]);

export function planActionResolves(item: PreflightItem): boolean {
  return item.sourceCodes.length > 0 && item.sourceCodes.every((code) => SCHEDULE_ACTION_CODES.has(code));
}

function contextOf(value: PreflightContext | string[] | undefined): PreflightContext {
  if (Array.isArray(value)) return { catalogNormOperations: value };
  return value ?? {};
}

function sectionOf(stepCode: string): { sectionId: string | null; fallbackId: string | null; tab: string | null } {
  const section = STEP_SECTIONS[stepCode];
  if (!section) return { sectionId: null, fallbackId: null, tab: null };
  return { sectionId: section.id, fallbackId: section.fallbackId, tab: section.tab };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function operationLabel(issue: ReadinessIssue): string | null {
  const diagnosticMessage = issue.diagnostic?.message ?? "";
  const fromDiagnostic = /Операция «([^»]+)»/.exec(diagnosticMessage)?.[1]?.trim();
  if (fromDiagnostic) return fromDiagnostic;
  const fromManager = /Для операции «([^»]+)»/.exec(issue.message)?.[1]?.trim();
  if (fromManager) return fromManager;
  const entity = issue.diagnostic?.entity_name?.trim();
  if (!entity || entity === "Операция") return null;
  if (diagnosticMessage.startsWith(entity)) return null;
  return entity;
}

function missingLabel(issue: ReadinessIssue): string | null {
  const label = issue.diagnostic?.field_label?.trim();
  if (label === "Сборка изделия / нормы пошива") return "норма пошива";
  if (label) return label;
  if (SEWING_CODES.has(issue.code)) return "норма пошива";
  return null;
}

function assemblyDetail(issue: ReadinessIssue, assemblyName: string | null): string {
  const field = missingLabel(issue);
  const name = assemblyName?.trim();
  if (name && field) return `Для сборки «${name}» не заполнено: ${field}.`;
  if (field) return `Не заполнено: ${field}.`;
  return "Откройте сборку изделия и заполните недостающие параметры.";
}

export function preflightItems(
  readiness: TechnicalCardReadiness | null,
  trigger: PreflightTrigger,
  context: PreflightContext | string[] = {},
): PreflightItem[] {
  const options = contextOf(context);
  const items: PreflightItem[] = [];
  const steps = readiness?.steps ?? [];
  const codes = new Set(steps.flatMap((step) => step.issues.map((issue) => issue.code)));
  const normOperations: string[] = [];
  let sawMeter = false;
  const planIssues: ReadinessIssue[] = [];
  const groups = new Map<string, { step: ReadinessStep; issues: ReadinessIssue[] }>();

  for (const step of steps) {
    if (step.status === "completed") continue;
    if (trigger === "model" && !MODEL_STEPS.has(step.code)) continue;
    for (const issue of visibleIssues(step, trigger, codes)) {
      if (SEWING_CODES.has(issue.code)) {
        if (items.some((item) => item.code === "assembly_sewing")) continue;
        items.push(sewingItem(issue, options.assemblyName ?? null));
        continue;
      }
      if (METER_CODES.has(issue.code) || NORM_CODES.has(issue.code)) {
        if (METER_CODES.has(issue.code)) sawMeter = true;
        const name = operationLabel(issue);
        if (name) normOperations.push(name);
        continue;
      }
      if (PLAN_CODES.has(issue.code)) {
        planIssues.push(issue);
        continue;
      }
      const key = [issue.code, issue.severity, issue.fix_action ?? "", issue.fix_url ?? ""].join("|");
      const group = groups.get(key);
      if (group) group.issues.push(issue);
      else groups.set(key, { step, issues: [issue] });
    }
  }

  for (const group of groups.values()) items.push(groupedItem(group.step, group.issues));

  for (const name of options.catalogNormOperations ?? []) normOperations.push(name);
  const operations = unique(normOperations);
  if (operations.length > 0 || sawMeter) items.push(normsItem(operations, sawMeter));
  if (planIssues.length > 0) items.push(planItem(planIssues));
  return items;
}

function visibleIssues(step: ReadinessStep, trigger: PreflightTrigger, codes: Set<string>): ReadinessIssue[] {
  return step.issues.filter((issue) => {
    if (issue.severity !== "error" && issue.severity !== "warning") return false;
    if (step.status === "pending" && issue.severity !== "error") return false;
    if (SKIP[trigger].has(issue.code)) return false;
    if (SEWING_CODES.has(issue.code) && codes.has("assembly_required")) return false;
    return true;
  });
}

function sewingItem(issue: ReadinessIssue, assemblyName: string | null): PreflightItem {
  return {
    key: "assembly_sewing",
    code: "assembly_sewing",
    severity: issue.severity === "warning" ? "warning" : "error",
    title: "Нужно заполнить параметры сборки",
    detail: assemblyDetail(issue, assemblyName),
    why: "Откройте сборку изделия и заполните недостающие параметры.",
    actionLabel: "Открыть сборку",
    ...sectionOf("model"),
    kind: "section",
    operations: [],
    focusOperation: null,
    reasons: [],
    diagnosticField: issue.diagnostic?.field ?? null,
    sourceCodes: ["assembly_sewing"],
  };
}

function normsItem(operations: string[], sawMeter: boolean): PreflightItem {
  const many = operations.length !== 1;
  const title = sawMeter
    ? (many ? "Нужно заполнить нормы расхода" : `Не указана норма расхода для операции «${operations[0]}»`)
    : "Нужно заполнить нормы производственных операций";
  const detail = sawMeter && !many
    ? "Для расчёта этой операции нужно указать расход на одно изделие."
    : sawMeter
      ? "Не заполнено для операций:"
      : "Для следующих операций нет норм:";
  const why = sawMeter && !many
    ? `Откройте нормы модели и заполните метраж для операции «${operations[0]}».`
    : "Откройте нормы модели и заполните значения для этих операций.";
  return {
    key: "norms",
    code: "operation_norms",
    severity: "error",
    title,
    detail,
    why,
    actionLabel: many || !sawMeter ? "Заполнить нормы" : "Заполнить норму",
    ...sectionOf("norms"),
    kind: "norms",
    operations: many ? operations : [],
    focusOperation: operations[0] ?? null,
    reasons: [],
    diagnosticField: null,
    sourceCodes: ["operation_norms"],
  };
}

function planItem(issues: ReadinessIssue[]): PreflightItem {
  const reasons = unique(issues.map((issue) => PLAN_REASONS[issue.code] ?? issue.message));
  const sourceCodes = unique(issues.map((issue) => issue.code));
  const onlyMissing = issues.every((issue) => issue.code === "saved_plan_required");
  const severity = issues.some((issue) => issue.severity === "error") ? "error" : "warning";
  const scheduleResolves = sourceCodes.every((code) => SCHEDULE_ACTION_CODES.has(code));
  const needsDates = sourceCodes.includes("quantity_planning_start_shipping_required");
  return {
    key: "plan",
    code: "plan_review",
    severity,
    title: scheduleResolves
      ? (onlyMissing ? "Производственный план ещё не рассчитан" : "Производственный план нужно пересчитать")
      : "Для расчёта плана не хватает исходных данных",
    detail: reasons.length === 1 ? reasons[0] : "Что мешает плану:",
    why: scheduleResolves
      ? (onlyMissing ? "Рассчитайте производственный план." : "Заново рассчитайте производственный план.")
      : "Количество задаётся при создании техкарты и на карточке не редактируется. Укажите дату начала и дату отгрузки — после этого план можно рассчитать.",
    actionLabel: scheduleResolves ? (onlyMissing ? "Рассчитать план" : "Пересчитать план") : (needsDates ? "Указать даты" : null),
    ...sectionOf("planning"),
    kind: "section",
    operations: [],
    focusOperation: null,
    reasons: reasons.length > 1 ? reasons : [],
    diagnosticField: needsDates ? "planning_start_date" : null,
    sourceCodes,
  };
}

function groupedItem(step: ReadinessStep, issues: ReadinessIssue[]): PreflightItem {
  const issue = issues[0];
  const operations = unique(issues.map((row) => operationLabel(row) ?? "").filter(Boolean));
  const copy = friendlyCopy(issue, operations);
  return {
    key: `${step.code}:${issue.code}:${issue.fix_action ?? ""}`,
    code: issue.code,
    severity: issue.severity === "warning" ? "warning" : "error",
    title: copy.title,
    detail: copy.detail,
    why: copy.why,
    actionLabel: copy.action,
    ...sectionOf(step.code),
    kind: "section",
    operations: operations.length > 1 ? operations : [],
    focusOperation: operations[0] ?? null,
    reasons: [],
    diagnosticField: issue.diagnostic?.field ?? null,
    sourceCodes: unique(issues.map((row) => row.code)),
  };
}

function friendlyCopy(issue: ReadinessIssue, operations: string[]): { title: string; detail: string; why: string; action: string | null } {
  if (issue.code === "assembly_required") {
    return {
      title: "Нужно выбрать сборку изделия",
      detail: "Для выбранной модели необходимо выбрать сборку.",
      why: "Откройте модель и выберите сборку изделия.",
      action: "Открыть сборку",
    };
  }
  if (issue.code === "planning_dates_required") {
    return {
      title: "Укажите даты производства и отгрузки",
      detail: "Без даты начала и даты отгрузки система не сможет рассчитать производственный план.",
      why: "",
      action: "Указать даты",
    };
  }
  if (issue.code === "model_required") {
    return {
      title: "Нужно выбрать модель изделия",
      detail: "Без модели нельзя заполнить сборку и рассчитать техкарту.",
      why: "Откройте блок модели и выберите изделие.",
      action: "Выбрать модель",
    };
  }
  if (issue.code === "route_required") {
    return {
      title: "Нужно выбрать маршрут производства",
      detail: "Без маршрута нельзя рассчитать операции.",
      why: "Откройте маршрут и выберите шаблон.",
      action: "Выбрать маршрут",
    };
  }
  if (issue.code === "variant_not_selected") {
    const name = operations[0];
    return {
      title: name ? `Нужно выбрать вариант операции «${name}»` : "Нужно выбрать вариант операции",
      detail: "В маршруте осталась группа, где вариант ещё не выбран.",
      why: "Откройте маршрут и отметьте нужную операцию.",
      action: "Выбрать вариант",
    };
  }
  if (issue.code === "invalid_quantity") {
    return {
      title: "Количество изделий не задано",
      detail: "Количество должно быть больше нуля.",
      why: "Количество задаётся при создании техкарты («План ТК») и на карточке только показывается. Персонализация его не меняет. Отдельного поля для правки здесь нет.",
      action: null,
    };
  }
  if (issue.code.startsWith("calendar_allocation_") || issue.diagnostic?.field?.startsWith("production_plan.assignment.")) {
    const label = issue.diagnostic?.field_label?.trim() || "Распределение нагрузки";
    return {
      title: `${label} не совпадает с текущей потребностью`,
      detail: "На техкарте нет поля, которым можно поправить сохранённое распределение.",
      why: "Проверьте текущую потребность, даты и ресурс и явно перепланируйте будущий план. Факт и неизвестные данные автоматически не исправляются.",
      action: "Показать план",
    };
  }
  if (issue.code === "personalization_quantity_mismatch") {
    return {
      title: "Персонализация не совпадает с количеством",
      detail: issue.message,
      why: "Это предупреждение. Запуск из-за него не останавливается.",
      action: "Открыть персонализацию",
    };
  }
  const name = operations.length === 1 ? operations[0] : null;
  return {
    title: name ? `${issue.message.replace(/\.$/, "")} — «${name}»` : issue.message,
    detail: "",
    why: issue.fix_action ?? "",
    action: issue.fix_action,
  };
}

export function preflightBlocks(items: PreflightItem[]): boolean {
  return items.some((item) => item.severity === "error");
}
