import type { ProductionDiagnostic } from "./readiness-stickers.ts";

export function routeReviewPresentation(row: ProductionDiagnostic | undefined) {
  if (!row || row.code !== "route_requires_review_before_planning") return null;
  const protectedFact = row.fix_action === "Открыть маршрут";
  return {
    protectedFact,
    title: protectedFact ? "Маршрут техкарты требует проверки" : "Не удалось проверить производственный маршрут",
    message: protectedFact
      ? "В техкарте есть выполненные или начатые операции, поэтому маршрут нельзя обновить автоматически."
      : "В этой техкарте используется старый маршрут, и система не может подтвердить, что в нём есть все необходимые операции.",
    actionText: protectedFact
      ? "Проверьте маршрут вручную или обратитесь к ответственному за производство."
      : "Обновите маршрут техкарты перед планированием производства.",
    actionLabel: protectedFact ? "Открыть маршрут" : "Обновить маршрут",
  };
}
