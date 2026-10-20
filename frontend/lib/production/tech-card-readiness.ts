/** Present GET /technical-cards/{id}/readiness. Step status and can_launch stay on the server. */

export type ReadinessStepStatus = "completed" | "warning" | "blocked" | "pending";
export type ReadinessOverallStatus = "ready" | "warning" | "blocked" | "incomplete" | "completed";

export type ReadinessDiagnostic = {
  code?: string;
  message?: string;
  category?: string;
  field?: string;
  field_label?: string;
  fix_scope?: string;
  entity_name?: string;
};

export type ReadinessIssue = {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  fix_action: string | null;
  fix_url: string | null;
  diagnostic?: ReadinessDiagnostic | null;
};

export type ReadinessStep = {
  code: string;
  title: string;
  status: ReadinessStepStatus;
  summary: string;
  issues: ReadinessIssue[];
  fix_action: string | null;
  fix_url: string | null;
  blocking: boolean;
};

export type TechnicalCardReadiness = {
  technical_card_id: number;
  lifecycle_status: string;
  overall_status: ReadinessOverallStatus;
  can_launch: boolean;
  progress_completed: number;
  progress_total: number;
  steps: ReadinessStep[];
};

export type FixTarget =
  | { kind: "url"; href: string; label: string }
  | { kind: "section"; id: string; fallbackId: string | null; tab: string | null; label: string }
  | { kind: "none" };

export const STEP_SECTIONS: Record<string, { id: string; fallbackId: string | null; tab: string | null }> = {
  basic: { id: "tech-card-order-data", fallbackId: null, tab: null },
  model: { id: "tech-card-model", fallbackId: null, tab: null },
  route: { id: "tech-card-route", fallbackId: null, tab: null },
  personalization: { id: "tech-card-personalization", fallbackId: null, tab: "assembly" },
  norms: { id: "tech-card-norms", fallbackId: null, tab: "operations" },
  planning: { id: "tech-card-planning", fallbackId: null, tab: null },
  launch: { id: "tech-card-readiness", fallbackId: null, tab: null },
};

const OVERALL_LABEL: Record<ReadinessOverallStatus, string> = {
  completed: "Производство завершено",
  ready: "Готова к запуску",
  warning: "Есть замечания",
  blocked: "Не готова",
  incomplete: "Заполняется",
};

export const LAUNCH_BLOCKED_MESSAGE = "Техкарта не готова к запуску";

export const READINESS_REFRESH_MUTATIONS = [
  "basic-data",
  "model",
  "assembly",
  "route",
  "personalization",
  "norms",
  "schedule",
  "launch",
] as const;

export function parseTechnicalCardReadiness(value: unknown): TechnicalCardReadiness | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<TechnicalCardReadiness>;
  if (!Array.isArray(row.steps) || typeof row.can_launch !== "boolean") return null;
  if (typeof row.progress_completed !== "number" || typeof row.progress_total !== "number") return null;
  if (typeof row.overall_status !== "string" || typeof row.lifecycle_status !== "string") return null;
  return {
    technical_card_id: Number(row.technical_card_id) || 0,
    lifecycle_status: row.lifecycle_status,
    overall_status: row.overall_status as ReadinessOverallStatus,
    can_launch: row.can_launch,
    progress_completed: row.progress_completed,
    progress_total: row.progress_total,
    steps: row.steps.map((step) => ({
      code: String(step.code),
      title: String(step.title),
      status: step.status,
      summary: String(step.summary ?? ""),
      issues: Array.isArray(step.issues) ? step.issues.map((issue) => ({
        code: String(issue.code),
        severity: issue.severity,
        message: String(issue.message ?? ""),
        fix_action: issue.fix_action ?? null,
        fix_url: issue.fix_url ?? null,
        diagnostic: issue.diagnostic
          ? {
            code: issue.diagnostic.code,
            message: issue.diagnostic.message,
            category: issue.diagnostic.category,
            field: typeof issue.diagnostic.field === "string" ? issue.diagnostic.field : undefined,
            field_label: typeof issue.diagnostic.field_label === "string" ? issue.diagnostic.field_label : undefined,
            fix_scope: typeof issue.diagnostic.fix_scope === "string" ? issue.diagnostic.fix_scope : undefined,
            entity_name: typeof issue.diagnostic.entity_name === "string" ? issue.diagnostic.entity_name : undefined,
          }
          : null,
      })) : [],
      fix_action: step.fix_action ?? null,
      fix_url: step.fix_url ?? null,
      blocking: Boolean(step.blocking),
    })),
  };
}

export function progressLabel(readiness: Pick<TechnicalCardReadiness, "progress_completed" | "progress_total">): string {
  return `${readiness.progress_completed} из ${readiness.progress_total}`;
}

export function overallLabel(status: ReadinessOverallStatus): string {
  return OVERALL_LABEL[status] ?? status;
}

const STICKER_TITLES: Record<string, string> = {
  basic: "Данные",
  model: "Модель",
  route: "Маршрут",
  personalization: "Персонализация",
  norms: "Нормы",
  planning: "План",
  launch: "Запуск",
};

export function stickerTitle(code: string, title: string): string {
  return STICKER_TITLES[code] ?? title;
}

export function stepPresentation(status: ReadinessStepStatus): {
  marker: "check" | "warning" | "blocked" | "pending";
  tone: "success" | "warning" | "danger" | "neutral";
} {
  if (status === "completed") return { marker: "check", tone: "success" };
  if (status === "warning") return { marker: "warning", tone: "warning" };
  if (status === "blocked") return { marker: "blocked", tone: "danger" };
  return { marker: "pending", tone: "neutral" };
}

export function orderedSteps<T>(steps: T[]): T[] {
  return steps.slice();
}

export function blockingIssueCount(readiness: Pick<TechnicalCardReadiness, "steps">): number {
  return readiness.steps.reduce(
    (count, step) => count + step.issues.filter((issue) => issue.severity === "error").length,
    0,
  );
}

function pathOf(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  try {
    const pathname = raw.startsWith("/") ? raw : new URL(raw).pathname;
    const clean = pathname.split("?")[0].replace(/\/$/, "");
    return clean || "/";
  } catch {
    return raw.split("?")[0].replace(/\/$/, "") || raw;
  }
}

export function resolveFixTarget(
  step: Pick<ReadinessStep, "code" | "title">,
  issue: Pick<ReadinessIssue, "fix_action" | "fix_url">,
  cardPath: string,
): FixTarget {
  const action = issue.fix_action?.trim() || "";
  const url = issue.fix_url?.trim() || "";
  if (!action && !url) return { kind: "none" };
  const label = `Открыть: ${step.title}`;
  if (url && pathOf(url) !== pathOf(cardPath)) return { kind: "url", href: url, label };
  const section = STEP_SECTIONS[step.code];
  if (section) return { kind: "section", ...section, label };
  return { kind: "none" };
}

export function managerIssueDetail(issue: ReadinessIssue, debugMode: boolean): {
  message: string;
  fixAction: string | null;
  diagnostic: ReadinessDiagnostic | null;
} {
  return {
    message: issue.message,
    fixAction: issue.fix_action,
    diagnostic: debugMode && issue.diagnostic ? issue.diagnostic : null,
  };
}

export type RoadmapRow = {
  code: string;
  title: string;
  sticker: string;
  status: ReadinessStepStatus;
  summary: string;
  marker: "check" | "warning" | "blocked" | "pending";
  tone: "success" | "warning" | "danger" | "neutral";
  issues: Array<{
    message: string;
    fixAction: string | null;
    navigation: FixTarget;
    diagnostic: ReadinessDiagnostic | null;
  }>;
};

export function roadmapView(
  readiness: TechnicalCardReadiness,
  options: { debugMode: boolean; cardPath: string },
): { progress: string; overall: string; rows: RoadmapRow[] } {
  return {
    progress: progressLabel(readiness),
    overall: overallLabel(readiness.overall_status),
    rows: orderedSteps(readiness.steps).map((step) => {
      const presentation = stepPresentation(step.status);
      return {
        code: step.code,
        title: step.title,
        sticker: stickerTitle(step.code, step.title),
        status: step.status,
        summary: step.summary,
        marker: presentation.marker,
        tone: presentation.tone,
        issues: step.issues.map((issue) => {
          const detail = managerIssueDetail(issue, options.debugMode);
          return {
            message: detail.message,
            fixAction: detail.fixAction,
            navigation: resolveFixTarget(step, issue, options.cardPath),
            diagnostic: detail.diagnostic,
          };
        }),
      };
    }),
  };
}

export function showLaunchButton(input: {
  storedStatus: string;
  shopContext: boolean;
  lifecycleStatus: string | null;
}): boolean {
  if (input.shopContext) return false;
  if (input.storedStatus !== "draft") return false;
  if (input.lifecycleStatus === "completed" || input.lifecycleStatus === "cancelled" || input.lifecycleStatus === "in_progress") {
    return false;
  }
  return true;
}

export function launchDecision(readiness: { can_launch: boolean } | null): "launch" | "blocked" {
  return readiness?.can_launch === true ? "launch" : "blocked";
}

export function launchBlockedNotice(readiness: Pick<TechnicalCardReadiness, "steps"> | null): string {
  const count = readiness ? blockingIssueCount(readiness) : 0;
  return `${LAUNCH_BLOCKED_MESSAGE}. Блокирующих замечаний: ${count}. Откройте готовность техкарты.`;
}
