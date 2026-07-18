export type LeadDetailStageState = {
  status: string;
  stageId?: string;
};

export function resolveLeadDetailStage(status: string): LeadDetailStageState {
  return status === "completed"
    ? { status: "completed" }
    : { status, stageId: status };
}
