"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  applyGroup,
  createAccessGroup,
  deleteAccessGroup,
  previewGroup,
  type AccessPermission,
  type AccessRole,
} from "@/app/(workspace)/settings/employees/access-actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form-controls";
import { useReportDirty } from "@/components/settings/employee-nav-context";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  groupApplyBody,
  groupPreviewBody,
  permissionLabel,
  type AccessPreview,
} from "@/lib/settings/access-group-commands";

export function AccessGroupEditor({
  role,
  permissions,
  creating = false,
  onDirtyChange,
}: {
  role: AccessRole | null;
  permissions: AccessPermission[];
  creating?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState(role?.name ?? "");
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<AccessPreview | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const system = role?.is_system === true;
  const dirty =
    creating
      ? code.trim() !== "" || name.trim() !== "" || selected.length > 0 || reason.trim() !== ""
      : name !== (role?.name ?? "") ||
        selected.join("\0") !== (role?.permissions ?? []).join("\0") ||
        reason.trim() !== "";

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useReportDirty(dirty);

  const toggle = (permission: string, checked: boolean) => {
    setPreview(null);
    setConfirmed(false);
    setSelected((current) =>
      checked ? [...current, permission] : current.filter((item) => item !== permission),
    );
  };

  const runPreview = async () => {
    if (role == null) return;
    setPending(true);
    setError(null);
    const result = await previewGroup(
      role.code,
      groupPreviewBody({ version: role.version, name, permissions: selected, reason }),
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
    if (role == null || preview == null || !preview.can_apply || !confirmed) return;
    setPending(true);
    const result = await applyGroup(
      role.code,
      groupApplyBody({ version: role.version, name, permissions: selected, reason }, preview),
    );
    setPending(false);
    if (!result.ok) {
      setPreview(null);
      setError(result.message);
      return;
    }
    setPreview(null);
    setReason("");
    setConfirmed(false);
    router.refresh();
  };

  const runCreate = async () => {
    setPending(true);
    setError(null);
    const result = await createAccessGroup({
      code: code.trim(),
      name: name.trim(),
      permissions: selected,
      reason: reason.trim(),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace(`/settings/employees/access-groups/${encodeURIComponent(result.data.code)}`);
  };

  const runDelete = async () => {
    if (role == null || !deleteConfirmed) return;
    setPending(true);
    const result = await deleteAccessGroup(role.code, { version: role.version, reason: reason.trim() });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push("/settings/employees/access-groups");
  };

  if (system && role) {
    return (
      <div className="space-y-portal-2" data-access-group="system">
        <p className="text-portal-body text-portal-text">Системная группа «{role.name}» не редактируется.</p>
        <p className="text-portal-caption text-portal-muted">Назначено учёток: {role.member_count}</p>
        <ul className="space-y-1 text-portal-caption text-portal-text">
          {role.permissions.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-portal-3" data-access-group={creating ? "create" : "edit"}>
      {creating ? (
        <Field label="Код" htmlFor="group-code">
          <Input id="group-code" value={code} maxLength={64} disabled={pending} onChange={(event) => setCode(event.target.value)} />
        </Field>
      ) : (
        <p className="text-portal-caption text-portal-muted">Код {role?.code} не меняется. Назначено: {role?.member_count ?? 0}</p>
      )}
      <Field label="Название" htmlFor="group-name">
        <Input id="group-name" value={name} maxLength={255} disabled={pending} onChange={(event) => { setName(event.target.value); setPreview(null); }} />
      </Field>
      <fieldset className="max-h-80 space-y-2 overflow-auto">
        <legend className="text-portal-caption text-portal-muted">Разрешения каталога</legend>
        {permissions.map((permission) => (
          <Checkbox
            key={permission.code}
            label={permissionLabel(permission.code, permission.description)}
            checked={selected.includes(permission.code)}
            disabled={pending}
            onChange={(event) => toggle(permission.code, event.target.checked)}
          />
        ))}
      </fieldset>
      <Field label="Причина" htmlFor="group-reason">
        <Textarea id="group-reason" value={reason} maxLength={500} disabled={pending} onChange={(event) => { setReason(event.target.value); setPreview(null); setConfirmed(false); }} />
      </Field>
      {error ? <InlineAlert tone="danger" size="compact">{error}</InlineAlert> : null}
      {preview ? (
        <div className="space-y-1 text-portal-caption">
          <p>Затронуто учёток: {preview.affected_count}</p>
          <p>В группе появится: {preview.group_granted.join(", ") || "—"}</p>
          <p>Из группы уйдёт: {preview.group_removed.join(", ") || "—"}</p>
          <p>Эффективно появится: {preview.granted.join(", ") || "—"}</p>
          <p>Эффективно исчезнет: {preview.removed.join(", ") || "—"}</p>
          {preview.blocker ? <p>{preview.blocker}</p> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {creating ? (
          <Button type="button" variant="primary" disabled={pending} onClick={() => void runCreate()}>Создать группу</Button>
        ) : (
          <>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => void runPreview()}>Показать изменения</Button>
            {preview?.can_apply ? (
              <Checkbox label="Подтверждаю изменение группы" checked={confirmed} disabled={pending} onChange={(event) => setConfirmed(event.target.checked)} />
            ) : null}
            <Button type="button" variant="primary" disabled={pending || !preview?.can_apply || !confirmed} onClick={() => void runApply()}>Применить</Button>
            {role && role.member_count === 0 ? (
              <>
                <Checkbox label="Подтверждаю удаление группы" checked={deleteConfirmed} disabled={pending} onChange={(event) => setDeleteConfirmed(event.target.checked)} />
                <Button type="button" variant="secondary" disabled={pending || !deleteConfirmed} onClick={() => void runDelete()}>Удалить</Button>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
