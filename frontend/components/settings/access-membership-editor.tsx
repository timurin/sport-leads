"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  applyMembership,
  previewMembership,
  type AccessRole,
  type EffectiveAccess,
} from "@/app/(workspace)/settings/employees/access-actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Textarea } from "@/components/ui/form-controls";
import { useReportDirty } from "@/components/settings/employee-nav-context";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  membershipApplyBody,
  membershipPreviewBody,
  membershipRoleCodes,
  type AccessPreview,
} from "@/lib/settings/access-group-commands";

export function AccessMembershipEditor({
  employeeId,
  platformUserId,
  initial,
  roles,
  onDirtyChange,
}: {
  employeeId: number | null;
  platformUserId: number;
  initial: EffectiveAccess;
  roles: AccessRole[];
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initial.role_codes);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<AccessPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const dirty = selected.join("\0") !== initial.role_codes.join("\0") || reason.trim() !== "";

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useReportDirty(dirty);

  const runPreview = async () => {
    setPending(true);
    setError(null);
    const result = await previewMembership(
      platformUserId,
      membershipPreviewBody(selected, reason),
    );
    setPending(false);
    if (!result.ok) {
      setPreview(null);
      setError(result.message);
      return;
    }
    setPreview(result.data);
  };

  const runApply = async () => {
    if (preview == null || !preview.can_apply || !confirmed) return;
    setPending(true);
    setError(null);
    const result = await applyMembership(
      platformUserId,
      employeeId,
      membershipApplyBody(selected, reason, preview),
    );
    setPending(false);
    if (!result.ok) {
      setPreview(null);
      setConfirmed(false);
      setError(result.message);
      return;
    }
    setPreview(null);
    setReason("");
    setConfirmed(false);
    router.refresh();
  };

  return (
    <div className="space-y-portal-3" data-access-membership data-dirty={dirty ? "true" : "false"}>
      <p className="text-portal-caption text-portal-muted">
        Несколько групп складываются. Должность сотрудника права не назначает.
      </p>
      <fieldset className="space-y-2">
        <legend className="text-portal-caption text-portal-muted">Группы доступа</legend>
        {roles.map((role) => (
          <Checkbox
            key={role.code}
            label={`${role.name} (${role.code})`}
            checked={selected.includes(role.code)}
            disabled={pending}
            onChange={(event) => {
              setPreview(null);
              setConfirmed(false);
              setSelected((current) => membershipRoleCodes(current, role.code, event.target.checked));
            }}
          />
        ))}
      </fieldset>
      <Field label="Причина" htmlFor="membership-reason">
        <Textarea
          id="membership-reason"
          value={reason}
          maxLength={500}
          disabled={pending}
          onChange={(event) => {
            setReason(event.target.value);
            setPreview(null);
            setConfirmed(false);
          }}
        />
      </Field>
      {error ? <InlineAlert tone="danger" size="compact">{error}</InlineAlert> : null}
      {preview ? (
        <div className="space-y-1 text-portal-caption text-portal-text">
          <p>Затронуто учёток: {preview.affected_count}</p>
          <p>Появятся: {preview.granted.join(", ") || "—"}</p>
          <p>Исчезнут: {preview.removed.join(", ") || "—"}</p>
          {preview.blocker ? <p>{preview.blocker}</p> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={pending} onClick={() => void runPreview()}>
          Показать изменения
        </Button>
        {preview?.can_apply ? (
          <Checkbox
            label="Подтверждаю изменение групп"
            checked={confirmed}
            disabled={pending}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
        ) : null}
        <Button type="button" variant="primary" disabled={pending || !preview?.can_apply || !confirmed} onClick={() => void runApply()}>
          {pending ? "Сохранение…" : "Применить"}
        </Button>
      </div>
    </div>
  );
}
