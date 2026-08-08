"use client";

import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  changeOwnPassword,
  setPlatformUserPassword,
  updatePlatformUserProfile,
} from "@/app/(workspace)/settings/users/platform-user-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  displayOrDash,
  effectivePermissionsForUser,
  emptyPasswordChangeDraft,
  formatLoginHandle,
  formatRoleSummary,
  formatUserActivity,
  groupPermissionsByModule,
  permissionLabel,
  profileDraftFromUser,
  roleLabel,
  sortRolesByCode,
  userHasRole,
  userInitials,
  userStatusLabel,
  userStatusTone,
  validatePasswordChangeDraft,
  validateProfileDraft,
  type PasswordChangeDraft,
  type PlatformUserAdmin,
  type PlatformUserProfileDraft,
  type RoleCatalogItem,
} from "@/lib/platform-users";

function ProfileReadField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-portal-caption text-portal-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-portal-body text-portal-text">
        {value}
      </dd>
    </div>
  );
}

function ProfileSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-4 rounded-portal-md border border-portal-border bg-portal-surface p-portal-4"
    >
      <h3 className="text-portal-body font-semibold text-portal-text">{title}</h3>
      {description ? (
        <p className="mt-1 text-portal-caption text-portal-muted">{description}</p>
      ) : null}
      <div className="mt-portal-3">{children}</div>
    </section>
  );
}

/** User cabinet panel with editable profile + security access (21.3 / 21.4.2). */
export function PlatformUserProfilePanel({
  open,
  user,
  users,
  roles,
  viewerUserId,
  onClose,
  onSaved,
  onToggleRole,
  onOpenAccessMatrix,
  roleBusyKey = null,
}: {
  open: boolean;
  user: PlatformUserAdmin | null;
  users: PlatformUserAdmin[];
  roles: RoleCatalogItem[];
  viewerUserId: number | null;
  onClose: () => void;
  onSaved?: (user: PlatformUserAdmin) => void;
  onToggleRole?: (
    user: PlatformUserAdmin,
    roleCode: string,
    nextChecked: boolean,
  ) => Promise<void>;
  onOpenAccessMatrix?: () => void;
  roleBusyKey?: string | null;
}) {
  const { push: pushToast } = useToast();
  const securityId = useId();
  const [securityFocus, setSecurityFocus] = useState(false);
  const [draft, setDraft] = useState<PlatformUserProfileDraft | null>(null);
  const [passwordDraft, setPasswordDraft] = useState<PasswordChangeDraft>(
    emptyPasswordChangeDraft(),
  );
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) {
      setSecurityFocus(false);
      setDraft(null);
      setPasswordDraft(emptyPasswordChangeDraft());
      setError(null);
      setPasswordError(null);
      return;
    }
    setDraft(profileDraftFromUser(user));
    setPasswordDraft(emptyPasswordChangeDraft());
    setError(null);
    setPasswordError(null);
    setSecurityFocus(false);
  }, [open, user]);

  if (!user || !draft) {
    return null;
  }

  const passwordMode =
    viewerUserId != null && viewerUserId === user.id ? "self" : "admin";

  const update = <K extends keyof PlatformUserProfileDraft>(
    field: K,
    value: PlatformUserProfileDraft[K],
  ) => {
    setDraft((current) =>
      current ? { ...current, [field]: value } : current,
    );
    setError(null);
  };

  const updatePassword = <K extends keyof PasswordChangeDraft>(
    field: K,
    value: PasswordChangeDraft[K],
  ) => {
    setPasswordDraft((current) => ({ ...current, [field]: value }));
    setPasswordError(null);
  };

  const goSecurity = () => {
    setSecurityFocus(true);
    const node = document.getElementById(securityId);
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const close = () => {
    if (saving || passwordSaving) return;
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateProfileDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await updatePlatformUserProfile(user.id, draft);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      pushToast("Профиль сохранён", "success");
      onSaved?.(result.user);
      setDraft(profileDraftFromUser(result.user));
    } catch {
      setError("Не удалось связаться с API. Профиль не сохранён.");
    } finally {
      setSaving(false);
    }
  };

  const submitPassword = async () => {
    const validationError = validatePasswordChangeDraft(
      passwordDraft,
      passwordMode,
    );
    if (validationError) {
      setPasswordError(validationError);
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    try {
      const result =
        passwordMode === "self"
          ? await changeOwnPassword({
              current_password: passwordDraft.current_password,
              new_password: passwordDraft.new_password,
            })
          : await setPlatformUserPassword(user.id, passwordDraft.new_password);
      if (!result.ok) {
        setPasswordError(result.message);
        return;
      }
      pushToast(
        passwordMode === "self" ? "Пароль изменён" : "Пароль задан",
        "success",
      );
      setPasswordDraft(emptyPasswordChangeDraft());
    } catch {
      setPasswordError("Не удалось связаться с API. Пароль не изменён.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const managerOptions = users.filter((row) => row.id !== user.id);
  const catalogRoles = sortRolesByCode(roles);
  const effectivePerms = effectivePermissionsForUser(user, catalogRoles);
  const permissionGroups = groupPermissionsByModule(effectivePerms);
  const loginHandle = formatLoginHandle(user.login);

  return (
    <CreateDrawer
      open={open}
      title={user.display_name}
      description={`Кабинет · ${loginHandle} · id ${user.id}`}
      onClose={close}
      variant="overlay"
    >
      <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-portal-4 overflow-y-auto p-portal-6">
          <div className="flex items-start gap-portal-3">
            <span
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-portal-primary-soft text-sm font-semibold text-portal-primary"
              aria-hidden="true"
            >
              {userInitials(draft.display_name || user.display_name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-portal-page font-semibold text-portal-text">
                {draft.display_name || user.display_name}
              </p>
              <p className="text-portal-body text-portal-muted">{loginHandle}</p>
              <div className="mt-2">
                <StatusBadge size="compact" tone={userStatusTone(user)}>
                  {userStatusLabel(user)}
                </StatusBadge>
              </div>
            </div>
            <Button
              type="button"
              size="compact"
              variant="secondary"
              onClick={goSecurity}
              disabled={saving || passwordSaving}
            >
              Безопасность
            </Button>
          </div>

          <ProfileSection
            id="profile-contact"
            title="Контакты"
            description="Редактируемые поля PlatformUser (PATCH 21.3.2)."
          >
            <div className="grid grid-cols-1 gap-portal-3 sm:grid-cols-2">
              <Field label="Имя" required>
                <Input
                  required
                  maxLength={255}
                  value={draft.display_name}
                  onChange={(event) =>
                    update("display_name", event.target.value)
                  }
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
              <Field label="Руководитель">
                <Select
                  value={draft.manager_platform_user_id}
                  onChange={(event) =>
                    update("manager_platform_user_id", event.target.value)
                  }
                  disabled={saving}
                >
                  <option value="">— не указан —</option>
                  {managerOptions.map((row) => (
                    <option key={row.id} value={String(row.id)}>
                      {row.display_name} ({formatLoginHandle(row.login)})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Язык" required>
                <Select
                  value={draft.language}
                  onChange={(event) => update("language", event.target.value)}
                  disabled={saving}
                >
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                </Select>
              </Field>
              <Field label="Активность">
                <Input
                  readOnly
                  value={formatUserActivity(user.last_activity_at)}
                  disabled
                />
              </Field>
            </div>
          </ProfileSection>

          <ProfileSection
            id="profile-document"
            title="Документ"
            description="MVP-заглушка. Персональные документы / HR — вне Stage 21."
          >
            <p className="text-portal-body text-portal-muted">
              Документы пользователя пока не подключены.
            </p>
          </ProfileSection>

          <ProfileSection
            id="profile-extra"
            title="Дополнительно"
            description="Статус учётки и служебные ссылки."
          >
            <div className="grid grid-cols-1 gap-portal-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-portal-body text-portal-text">
                <Checkbox
                  checked={draft.is_active}
                  disabled={saving}
                  onChange={(event) => update("is_active", event.target.checked)}
                />
                Учётка активна
              </label>
              <ProfileReadField
                label="Связанный SalesUser"
                value={
                  user.sales_user_id != null
                    ? `ID ${user.sales_user_id}`
                    : "—"
                }
              />
              <ProfileReadField
                label="Invite status"
                value={displayOrDash(user.invite_status)}
              />
            </div>
          </ProfileSection>

          <ProfileSection
            id="profile-about"
            title="О пользователе"
            description="MVP-заглушка свободного описания (отдельное поле не введено)."
          >
            <p className="text-portal-body text-portal-muted">
              Свободное «о себе» не входит в MVP Stage 21.
            </p>
          </ProfileSection>

          <ProfileSection
            id={securityId}
            title="Безопасность"
            description="Доступ платформы через роли (deny-by-default ADR-024). Персональных overrides нет."
          >
            <div
              className={
                securityFocus
                  ? "rounded-portal-md ring-2 ring-portal-primary/40 ring-offset-2 ring-offset-portal-surface"
                  : undefined
              }
            >
              <dl className="grid grid-cols-1 gap-portal-3 sm:grid-cols-2">
                <ProfileReadField label="Логин" value={user.login} />
                <ProfileReadField label="Статус" value={userStatusLabel(user)} />
                <ProfileReadField
                  label="Роли"
                  value={formatRoleSummary(user)}
                />
                <ProfileReadField
                  label="Эффективные права"
                  value={String(effectivePerms.length)}
                />
              </dl>

              <div className="mt-portal-4 rounded-portal-md border border-portal-border p-portal-3">
                <h4 className="text-portal-body font-medium text-portal-text">
                  Пароль
                </h4>
                <p className="mt-1 text-portal-caption text-portal-muted">
                  {passwordMode === "self"
                    ? "Смена своего пароля: нужен текущий пароль."
                    : "Админ задаёт новый пароль пользователю без текущего."}
                </p>
                <div className="mt-portal-3 space-y-portal-3">
                  {passwordMode === "self" ? (
                    <Field label="Текущий пароль" required>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        value={passwordDraft.current_password}
                        onChange={(event) =>
                          updatePassword("current_password", event.target.value)
                        }
                        disabled={passwordSaving || saving}
                      />
                    </Field>
                  ) : null}
                  <Field label="Новый пароль" required>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={passwordDraft.new_password}
                      onChange={(event) =>
                        updatePassword("new_password", event.target.value)
                      }
                      disabled={passwordSaving || saving}
                    />
                  </Field>
                  <Field label="Повтор нового пароля" required>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={passwordDraft.confirm_password}
                      onChange={(event) =>
                        updatePassword("confirm_password", event.target.value)
                      }
                      disabled={passwordSaving || saving}
                    />
                  </Field>
                  {passwordError ? (
                    <p className="text-portal-caption text-portal-danger">
                      {passwordError}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    size="compact"
                    disabled={passwordSaving || saving}
                    onClick={() => {
                      void submitPassword();
                    }}
                  >
                    {passwordSaving
                      ? "Сохранение…"
                      : passwordMode === "self"
                        ? "Сменить пароль"
                        : "Задать пароль"}
                  </Button>
                </div>
              </div>

              <fieldset className="mt-portal-4 space-y-2">
                <legend className="text-portal-caption font-medium text-portal-muted">
                  Назначение ролей
                </legend>
                {catalogRoles.map((role) => {
                  const checked = userHasRole(user, role.code);
                  const key = `${user.id}:${role.code}`;
                  return (
                    <label
                      key={role.code}
                      className="flex items-center gap-2 text-portal-body text-portal-text"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={
                          saving ||
                          !onToggleRole ||
                          roleBusyKey === key
                        }
                        onChange={(event) => {
                          void onToggleRole?.(
                            user,
                            role.code,
                            event.target.checked,
                          );
                        }}
                      />
                      <span>
                        {roleLabel(role.code)}
                        <span className="ml-1 font-mono text-portal-caption text-portal-muted">
                          ({role.code})
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <div className="mt-portal-4 space-y-2">
                <p className="text-portal-caption font-medium text-portal-muted">
                  Права пользователя (из ролей)
                </p>
                {permissionGroups.length === 0 ? (
                  <p className="text-portal-body text-portal-muted">
                    Нет прав — deny-by-default, пока не назначена роль.
                  </p>
                ) : (
                  permissionGroups.map((group) => (
                    <div key={group.key} className="min-w-0">
                      <p className="text-portal-caption font-semibold text-portal-text">
                        {group.label}
                      </p>
                      <ul className="mt-1 list-inside list-disc text-portal-body text-portal-muted">
                        {group.codes.map((code) => (
                          <li key={code}>
                            {permissionLabel(code)}{" "}
                            <span className="font-mono text-portal-caption">
                              ({code})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-portal-4">
                <Button
                  type="button"
                  size="compact"
                  variant="secondary"
                  disabled={saving || !onOpenAccessMatrix}
                  onClick={() => onOpenAccessMatrix?.()}
                >
                  Открыть матрицу доступа
                </Button>
              </div>
            </div>
          </ProfileSection>

          {error ? (
            <p className="text-portal-body text-portal-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
          <Button type="button" variant="secondary" onClick={goSecurity} disabled={saving || passwordSaving}>
            К безопасности
          </Button>
          <Button type="button" onClick={close} disabled={saving || passwordSaving}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={saving || passwordSaving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </footer>
      </form>
    </CreateDrawer>
  );
}
