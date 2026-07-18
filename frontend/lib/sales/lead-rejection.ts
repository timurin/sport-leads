export type ApiLeadRejectionReason = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
};

export function findBackendReasonId(
  frontendReasonCode: string,
  reasons: readonly ApiLeadRejectionReason[],
): number | null {
  return reasons.find(
    (reason) => reason.is_active && reason.code === frontendReasonCode,
  )?.id ?? null;
}
