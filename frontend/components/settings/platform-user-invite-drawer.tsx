"use client";

import { type FormEvent, useState } from "react";

import { invitePlatformUser } from "@/app/(workspace)/settings/users/platform-user-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Checkbox, Field, Input } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import {
  emptyInviteDraft,
  roleLabel,
  validateInviteDraft,
  type PlatformUserAdmin,
  type PlatformUserInviteDraft,
  type RoleCatalogItem,
} from "@/lib/platform-users";

/** Invite drawer for PlatformUser (21.2.2). */
export function PlatformUserInviteDrawer({
  open,
  onClose,
  roles,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  roles: RoleCatalogItem[];
  onInvited?: (user: PlatformUserAdmin, temporaryPassword: string) => void;
}) {
  const { push: pushToast } = useToast();
  const [draft, setDraft] = useState<PlatformUserInviteDraft>(emptyInviteDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const update = <K extends keyof PlatformUserInviteDraft>(
    field: K,
    value: PlatformUserInviteDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const toggleRole = (code: string, checked: boolean) => {
    setDraft((current) => {
      const next = checked
        ? [...current.role_codes, code]
        : current.role_codes.filter((item) => item !== code);
      return { ...current, role_codes: next };
    });
  };

  const close = () => {
    if (saving) return;
    setDraft(emptyInviteDraft());
    setError("");
    setCreatedPassword(null);
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateInviteDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const result = await invitePlatformUser(draft);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      pushToast("Пользователь приглашён", "success");
      onInvited?.(result.user, result.temporary_password);
      setCreatedPassword(result.temporary_password);
      setDraft(emptyInviteDraft());
      setError("");
    } catch {
      setError("Не удалось связаться с API. Приглашение не создано.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CreateDrawer
      open={open}
      title="Пригласить пользователя"
      description="Создаёт PlatformUser со статусом «приглашён». Временный пароль покажется один раз."
      onClose={close}
      variant="overlay"
    >
      {createdPassword ? (
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 space-y-portal-4 overflow-y-auto p-portal-6">
            <p className="text-portal-body text-portal-text">
              Пользователь создан. Передайте временный пароль лично — повторно он не
              отобразится.
            </p>
            <Field label="Временный пароль">
              <Input readOnly value={createdPassword} className="font-mono" />
            </Field>
          </div>
          <footer className="flex justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
            <Button type="button" variant="primary" onClick={close}>
              Готово
            </Button>
          </footer>
        </div>
      ) : (
        <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 space-y-portal-4 overflow-y-auto p-portal-6">
            <Field label="Логин" required>
              <Input
                autoFocus
                required
                maxLength={64}
                value={draft.login}
                onChange={(event) => update("login", event.target.value)}
                disabled={saving}
                autoComplete="off"
              />
            </Field>
            <Field label="Отображаемое имя" required>
              <Input
                required
                maxLength={255}
                value={draft.display_name}
                onChange={(event) => update("display_name", event.target.value)}
                disabled={saving}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                maxLength={255}
                value={draft.email}
                onChange={(event) => update("email", event.target.value)}
                disabled={saving}
              />
            </Field>
            <Field label="Телефон">
              <Input
                maxLength={64}
                value={draft.phone}
                onChange={(event) => update("phone", event.target.value)}
                disabled={saving}
              />
            </Field>
            <Field label="Отдел">
              <Input
                maxLength={150}
                value={draft.department}
                onChange={(event) => update("department", event.target.value)}
                disabled={saving}
              />
            </Field>
            <Field label="Должность">
              <Input
                maxLength={150}
                value={draft.position}
                onChange={(event) => update("position", event.target.value)}
                disabled={saving}
              />
            </Field>
            <Field label="Временный пароль">
              <Input
                type="text"
                maxLength={256}
                value={draft.temporary_password}
                onChange={(event) =>
                  update("temporary_password", event.target.value)
                }
                disabled={saving}
                placeholder="Оставьте пустым — сгенерируется"
                autoComplete="new-password"
              />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-portal-caption font-medium text-portal-muted">
                Роли при приглашении
              </legend>
              {roles.map((role) => (
                <label
                  key={role.code}
                  className="flex items-center gap-2 text-portal-body text-portal-text"
                >
                  <Checkbox
                    checked={draft.role_codes.includes(role.code)}
                    disabled={saving}
                    onChange={(event) =>
                      toggleRole(role.code, event.target.checked)
                    }
                  />
                  {roleLabel(role.code)}
                </label>
              ))}
            </fieldset>
            {error ? (
              <p className="text-portal-body text-portal-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <footer className="flex justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
            <Button type="button" onClick={close} disabled={saving}>
              Отмена
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Создание…" : "Пригласить"}
            </Button>
          </footer>
        </form>
      )}
    </CreateDrawer>
  );
}
