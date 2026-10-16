/** Display the Demand route-readiness payload. Schedule completeness is not a demand rule. */

export type RouteNodeReadiness = {
  node_id: string;
  operation_id: number;
  operation_name: string;
  status: "ready" | "blocked";
  reason_code: string | null;
  message: string | null;
  affects_route: boolean;
};

export function presentRouteReadiness(
  schedule: { status: "ready" | "needs_setup" | "no_capacity"; issues: string[] },
  demand: { status: "ready" | "blocked"; message?: string | null } | null,
): { status: "ready" | "warning"; label: string; issues: string[] } {
  if (demand?.status === "blocked") {
    const message = demand.message?.trim();
    return { status: "warning", label: "Требует настройки", issues: message ? [message] : [] };
  }
  if (schedule.status === "ready") return { status: "ready", label: "Готово", issues: [] };
  if (schedule.status === "no_capacity") return { status: "warning", label: "Без расчёта мощности", issues: schedule.issues };
  return { status: "warning", label: "Требует настройки", issues: schedule.issues };
}

export function routePlanReady(rows: Pick<RouteNodeReadiness, "status" | "affects_route">[]): boolean {
  return rows.filter((row) => row.affects_route).every((row) => row.status === "ready");
}
