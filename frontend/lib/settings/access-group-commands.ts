/** Preview/apply bodies for Role-backed access groups. No local grant union. */

export type AccessPreview = {
  revision: string;
  preview_fingerprint: string;
  can_apply: boolean;
  blocker: string | null;
  affected_count: number;
  granted: string[];
  removed: string[];
  group_granted: string[];
  group_removed: string[];
};

export type AccessFailure = {
  success: false;
  conflict: boolean;
  keepDraft: true;
  message: string;
};

export function membershipRoleCodes(
  current: readonly string[],
  code: string,
  selected: boolean,
): string[] {
  const next = new Set(current);
  if (selected) next.add(code);
  else next.delete(code);
  return [...next];
}

export function membershipPreviewBody(roleCodes: readonly string[], reason: string) {
  return { role_codes: [...roleCodes], reason: reason.trim() };
}

export function membershipApplyBody(
  roleCodes: readonly string[],
  reason: string,
  preview: Pick<AccessPreview, "revision" | "preview_fingerprint">,
) {
  return {
    ...membershipPreviewBody(roleCodes, reason),
    revision: preview.revision,
    preview_fingerprint: preview.preview_fingerprint,
  };
}

export function groupPreviewBody(input: {
  version: number;
  name: string;
  permissions: readonly string[];
  reason: string;
}) {
  return {
    version: input.version,
    name: input.name.trim(),
    permissions: [...input.permissions],
    reason: input.reason.trim(),
  };
}

export function groupApplyBody(
  input: {
    version: number;
    name: string;
    permissions: readonly string[];
    reason: string;
  },
  preview: Pick<AccessPreview, "revision" | "preview_fingerprint">,
) {
  return {
    ...groupPreviewBody(input),
    revision: preview.revision,
    preview_fingerprint: preview.preview_fingerprint,
  };
}

export function interpretAccessFailure(
  status: number | null,
  detail: string,
): AccessFailure {
  const message = detail.trim() || "Связь с сервером не изменила доступ.";
  return {
    success: false,
    conflict: status === 409,
    keepDraft: true,
    message,
  };
}

export function permissionLabel(code: string, description: string | null | undefined): string {
  const text = description?.trim();
  return text ? `${text} (${code})` : code;
}
