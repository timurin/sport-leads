export type LeadStagePersistenceDecision = {
  shouldPersist: boolean;
  reason: "api-lead" | "unchanged" | "non-api-lead" | "unsupported-stage";
};

const API_LEAD_STAGES = new Set([
  "new",
  "contact",
  "qualification",
  "proposal",
  "waiting",
]);

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

  if (!API_LEAD_STAGES.has(nextStage)) {
    return { shouldPersist: false, reason: "unsupported-stage" };
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
