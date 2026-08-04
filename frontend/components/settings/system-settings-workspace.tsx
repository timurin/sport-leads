"use client";

import { ImagePlus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import {
  deletePlatformSystemLogo,
  updatePlatformSystemSettings,
  uploadPlatformSystemLogo,
} from "@/app/(workspace)/settings/system/system-settings-actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { PageToolbar } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import {
  isPlatformSystemSettingsDirty,
  PLATFORM_LOCALE_OPTIONS,
  PLATFORM_TIMEZONE_OPTIONS,
  platformMediaUrl,
  toPlatformSystemSettingsDraft,
  validatePlatformSystemSettingsDraft,
  type PlatformSystemSettings,
  type PlatformSystemSettingsDraft,
} from "@/lib/platform-system-settings";

type Props = {
  settings: PlatformSystemSettings;
  canWrite: boolean;
};

export function SystemSettingsWorkspace({ settings, canWrite }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentSettings, setCurrentSettings] =
    useState<PlatformSystemSettings>(settings);
  const [draft, setDraft] = useState<PlatformSystemSettingsDraft>(() =>
    toPlatformSystemSettingsDraft(settings),
  );
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const dirty = useMemo(
    () => isPlatformSystemSettingsDirty(currentSettings, draft),
    [currentSettings, draft],
  );
  const validationError = useMemo(
    () => validatePlatformSystemSettingsDraft(draft),
    [draft],
  );

  const timezoneOptions = useMemo(() => {
    const known = new Set<string>(PLATFORM_TIMEZONE_OPTIONS);
    if (!known.has(draft.default_timezone) && draft.default_timezone) {
      return [draft.default_timezone, ...PLATFORM_TIMEZONE_OPTIONS];
    }
    return [...PLATFORM_TIMEZONE_OPTIONS];
  }, [draft.default_timezone]);

  const localeOptions = useMemo(() => {
    const known = new Set<string>(
      PLATFORM_LOCALE_OPTIONS.map((item) => item.value),
    );
    if (!known.has(draft.ui_locale) && draft.ui_locale) {
      return [
        { value: draft.ui_locale, label: draft.ui_locale },
        ...PLATFORM_LOCALE_OPTIONS,
      ];
    }
    return [...PLATFORM_LOCALE_OPTIONS];
  }, [draft.ui_locale]);

  const logoSrc = platformMediaUrl(currentSettings.logo_url);

  const statusHint = savedAt
    ? `Сохранено в ${savedAt}`
    : dirty && canWrite
      ? "Есть несохранённые изменения"
      : canWrite
        ? "Изменений нет"
        : "Только просмотр";

  const markSaved = (next: PlatformSystemSettings) => {
    setCurrentSettings(next);
    setDraft(toPlatformSystemSettingsDraft(next));
    setSavedAt(
      new Date().toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    router.refresh();
  };

  const save = async () => {
    if (!canWrite) return;
    setError(null);
    setSavedAt(null);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    const result = await updatePlatformSystemSettings(draft);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    markSaved(result.settings);
  };

  const onLogoSelected = async (file: File | null) => {
    if (!canWrite || !file) return;
    setError(null);
    setLogoBusy(true);
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadPlatformSystemLogo(formData);
    setLogoBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    markSaved(result.settings);
  };

  const removeLogo = async () => {
    if (!canWrite) return;
    setError(null);
    setLogoBusy(true);
    const result = await deletePlatformSystemLogo();
    setLogoBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    markSaved(result.settings);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageToolbar
        start={
          <div className="min-w-0">
            <p className="text-portal-body font-semibold text-portal-text">
              Системные настройки
            </p>
            <p className="text-portal-caption text-portal-muted">
              Бренд в шапке меню, часовой пояс, локаль и контакт поддержки
            </p>
          </div>
        }
        end={
          canWrite ? (
            <div className="flex flex-wrap items-center gap-portal-2">
              <span
                className={[
                  "text-portal-caption",
                  savedAt
                    ? "text-portal-success"
                    : dirty
                      ? "text-portal-warning"
                      : "text-portal-muted",
                ].join(" ")}
              >
                {statusHint}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={saving || logoBusy || !dirty}
                onClick={() => {
                  setDraft(toPlatformSystemSettingsDraft(currentSettings));
                  setError(null);
                  setSavedAt(null);
                }}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Сбросить
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={
                  saving || logoBusy || !dirty || validationError != null
                }
                onClick={() => void save()}
              >
                <Save className="size-4" aria-hidden="true" />
                {saving ? "Сохранение…" : "Сохранить"}
              </Button>
            </div>
          ) : (
            <span className="text-portal-caption text-portal-muted">
              {statusHint}
            </span>
          )
        }
      />

      <div className="min-h-0 flex-1 overflow-auto bg-portal-bg">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-portal-4 p-portal-4 lg:p-portal-6">
          {error ? (
            <p
              className="rounded-portal-md border border-portal-danger/30 bg-portal-danger-soft px-portal-4 py-portal-3 text-portal-body text-portal-danger"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <SectionCard
            title="Организация"
            description="Название и логотип привязаны к шапке меню (DS-SHELL-01). Не заменяют карточку юрлица."
            size="compact"
          >
            <div className="grid gap-portal-4">
              <div className="grid gap-portal-4 md:grid-cols-2">
                <Field
                  label="Название организации"
                  htmlFor="platform-org-name"
                  help="Показывается в шапке бокового меню вместо SPORT-LEAD."
                >
                  <Input
                    id="platform-org-name"
                    value={draft.organization_display_name}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        organization_display_name: event.target.value,
                      }))
                    }
                    disabled={saving || !canWrite}
                  />
                </Field>
                <Field
                  label="Email поддержки"
                  htmlFor="platform-support-email"
                  help="Необязательно. Для служебных уведомлений и контакта."
                >
                  <Input
                    id="platform-support-email"
                    type="email"
                    value={draft.support_email}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        support_email: event.target.value,
                      }))
                    }
                    disabled={saving || !canWrite}
                    placeholder="support@example.com"
                  />
                </Field>
              </div>

              <Field
                label="Логотип"
                htmlFor="platform-logo-upload"
                help="JPEG, PNG, WebP или SVG, до 5 МБ. Без логотипа в шапке показываются инициалы названия."
              >
                <div className="flex flex-wrap items-center gap-portal-3">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-portal-border bg-portal-surface-secondary">
                    {logoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoSrc}
                        alt={currentSettings.logo_filename ?? "Логотип"}
                        className="size-full object-contain"
                      />
                    ) : (
                      <ImagePlus
                        className="size-6 text-portal-muted"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-portal-2">
                    <input
                      ref={fileInputRef}
                      id="platform-logo-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml"
                      className="sr-only"
                      disabled={!canWrite || logoBusy || saving}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        event.target.value = "";
                        void onLogoSelected(file);
                      }}
                    />
                    {canWrite ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={logoBusy || saving}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <ImagePlus className="size-4" aria-hidden="true" />
                          {logoBusy ? "Загрузка…" : "Загрузить"}
                        </Button>
                        {currentSettings.logo_url ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={logoBusy || saving}
                            onClick={() => void removeLogo()}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                            Удалить
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                    <span className="text-portal-caption text-portal-muted">
                      {currentSettings.logo_filename ?? "Файл не выбран"}
                    </span>
                  </div>
                </div>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Регион и локаль"
            description="Часовой пояс по умолчанию и язык интерфейса платформы."
            size="compact"
          >
            <div className="grid gap-portal-4 md:grid-cols-2">
              <Field label="Часовой пояс" htmlFor="platform-timezone">
                <select
                  id="platform-timezone"
                  className="h-10 w-full rounded-portal-md border border-portal-border bg-portal-surface px-portal-3 text-portal-body text-portal-text outline-none focus-visible:border-portal-accent"
                  value={draft.default_timezone}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      default_timezone: event.target.value,
                    }))
                  }
                  disabled={saving || !canWrite}
                >
                  {timezoneOptions.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Локаль UI" htmlFor="platform-locale">
                <select
                  id="platform-locale"
                  className="h-10 w-full rounded-portal-md border border-portal-border bg-portal-surface px-portal-3 text-portal-body text-portal-text outline-none focus-visible:border-portal-accent"
                  value={draft.ui_locale}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ui_locale: event.target.value,
                    }))
                  }
                  disabled={saving || !canWrite}
                >
                  {localeOptions.map((locale) => (
                    <option key={locale.value} value={locale.value}>
                      {locale.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Заметки"
            description="Внутренний комментарий администратора (не для печати)."
            size="compact"
          >
            <Field label="Примечание" htmlFor="platform-notes">
              <Textarea
                id="platform-notes"
                rows={4}
                value={draft.notes}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                disabled={saving || !canWrite}
              />
            </Field>
          </SectionCard>

          <p className="text-portal-caption text-portal-muted">
            {canWrite
              ? "Название и логотип сразу отображаются в шапке бокового меню. Право: system_settings.write."
              : "Режим просмотра. Для изменения нужно право system_settings.write."}
          </p>
        </div>
      </div>
    </div>
  );
}
