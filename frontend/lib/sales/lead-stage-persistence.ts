export type LeadStagePersistenceDecision = {
  shouldPersist: boolean;
  reason: "api-lead" | "unchanged" | "non-api-lead";
};

export function getLeadStagePersistenceDecision(
  leadId: string,
  previousStage: string,
  nextStage: string,
  dataOrigin: "api" | "demo",
): LeadStagePersistenceDecision {
  if (previousStage === nextStage) {
    return { shouldPersist: false, reason: "unchanged" };
  }

  if (dataOrigin !== "api" || !/^\d+$/.test(leadId)) {
    return { shouldPersist: false, reason: "non-api-lead" };
  }

  return { shouldPersist: true, reason: "api-lead" };
}

export function resolveLeadStageAfterPersistence(
  previousStage: string,
  optimisticStage: string,
  persisted: boolean,
): string {
  return persisted ? optimisticStage : previousStage;
}
