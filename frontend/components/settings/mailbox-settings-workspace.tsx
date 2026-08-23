"use client";

import { Mail, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { updateMailboxSettings } from "@/app/(workspace)/settings/integrations/mailbox-settings-actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Switch } from "@/components/ui/form-controls";
import { PageToolbar } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import {
  isMailboxSettingsDirty,
  toMailboxSettingsDraft,
  validateMailboxSettingsDraft,
  type MailboxSettings,
  type MailboxSettingsDraft,
} from "@/lib/mailbox-settings";

type Props = {
  settings: MailboxSettings;
  canWrite: boolean;
};

export function MailboxSettingsWorkspace({ settings, canWrite }: Props) {
  const router = useRouter();
  const [currentSettings, setCurrentSettings] = useState(settings);
  const [draft, setDraft] = useState<MailboxSettingsDraft>(() =>
    toMailboxSettingsDraft(settings),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const dirty = useMemo(
    () => isMailboxSettingsDirty(currentSettings, draft),
    [currentSettings, draft],
  );
  const validationError = useMemo(
    () => validateMailboxSettingsDraft(draft),
    [draft],
  );

  const statusHint = savedAt
    ? `Сохранено в ${savedAt}`
    : dirty && canWrite
      ? "Есть несохранённые изменения"
      : canWrite
        ? "Изменений нет"
        : "Только просмотр";

  const patch = (partial: Partial<MailboxSettingsDraft>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
    setSavedAt(null);
  };

  const markSaved = (next: MailboxSettings) => {
    setCurrentSettings(next);
    setDraft(toMailboxSettingsDraft(next));
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
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    const result = await updateMailboxSettings(draft);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    markSaved(result.settings);
  };

  const connectedLabel =
    draft.email_address.trim() || draft.smtp_from.trim() || "Ящик не выбран";

  return (
    <div className="sl-design-v1 flex min-h-0 min-w-0 flex-1 flex-col">
      <PageToolbar
        start={
          <div className="min-w-0">
            <p className="text-portal-body font-semibold text-portal-text">
              Настройка почтового ящика
            </p>
            <p className="text-portal-caption text-portal-muted">
              SMTP для исходящих с карточки лида; входящие — webhook
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
                disabled={saving || !dirty}
                onClick={() => {
                  setDraft(toMailboxSettingsDraft(currentSettings));
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
                disabled={saving || !dirty || validationError != null}
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

      <div className="min-h-0 flex-1 overflow-auto bg-portal-page">
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
            title="Выбранный почтовый клиент"
            description="Входящая почта. IMAP сохраняется для следующего этапа; сейчас входящие принимаются webhook."
            size="compact"
          >
            <div className="flex flex-col gap-portal-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-portal-lg border border-portal-primary/20 bg-portal-primary-soft px-portal-4 py-portal-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="rounded-portal-md bg-portal-primary p-2 text-portal-primary-on">
                    <Mail className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-portal-text">
                      {draft.display_name || "Корпоративная почта"}
                    </p>
                    <p className="text-portal-caption text-portal-muted">
                      {connectedLabel}
                    </p>
                  </div>
                </div>
                <span className="text-portal-caption text-portal-muted">
                  Входящие: webhook
                </span>
              </div>

              <div className="grid gap-portal-4 md:grid-cols-2">
                <Field label="Название ящика" htmlFor="mailbox-display-name">
                  <Input
                    id="mailbox-display-name"
                    value={draft.display_name}
                    disabled={!canWrite}
                    onChange={(event) =>
                      patch({ display_name: event.target.value })
                    }
                  />
                </Field>
                <Field label="Адрес ящика" htmlFor="mailbox-email">
                  <Input
                    id="mailbox-email"
                    type="email"
                    value={draft.email_address}
                    disabled={!canWrite}
                    onChange={(event) =>
                      patch({ email_address: event.target.value })
                    }
                  />
                </Field>
              </div>

              <div className="grid gap-portal-4 md:grid-cols-[1fr_8rem]">
                <Field label="IMAP" htmlFor="mailbox-imap-host">
                  <Input
                    id="mailbox-imap-host"
                    value={draft.imap_host}
                    disabled={!canWrite}
                    placeholder="imap.mail.ru"
                    onChange={(event) =>
                      patch({ imap_host: event.target.value })
                    }
                  />
                </Field>
                <Field label="Порт" htmlFor="mailbox-imap-port">
                  <Input
                    id="mailbox-imap-port"
                    inputMode="numeric"
                    value={draft.imap_port}
                    disabled={!canWrite}
                    onChange={(event) =>
                      patch({ imap_port: event.target.value })
                    }
                  />
                </Field>
              </div>
              <Checkbox
                checked={draft.imap_use_tls}
                disabled={!canWrite}
                label="Использовать защищённое соединение"
                onChange={(event) =>
                  patch({ imap_use_tls: event.target.checked })
                }
              />
              <div className="grid gap-portal-4 md:grid-cols-2">
                <Field label="Логин" htmlFor="mailbox-imap-user">
                  <Input
                    id="mailbox-imap-user"
                    value={draft.imap_username}
                    disabled={!canWrite}
                    onChange={(event) =>
                      patch({ imap_username: event.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Пароль"
                  htmlFor="mailbox-imap-password"
                  help={
                    currentSettings.imap_password_set
                      ? "Пароль задан. Оставьте пустым, чтобы не менять."
                      : "Пароль не возвращается в интерфейс."
                  }
                >
                  <Input
                    id="mailbox-imap-password"
                    type="password"
                    autoComplete="new-password"
                    value={draft.imap_password}
                    disabled={!canWrite}
                    onChange={(event) =>
                      patch({ imap_password: event.target.value })
                    }
                  />
                </Field>
              </div>
              <Field
                label="Секрет входящего webhook"
                htmlFor="mailbox-inbound-secret"
                help="Заголовок X-Sport-Lead-Email-Secret. Пустое поле не затирает текущий секрет."
              >
                <Input
                  id="mailbox-inbound-secret"
                  type="password"
                  autoComplete="new-password"
                  value={draft.inbound_webhook_secret}
                  disabled={!canWrite}
                  onChange={(event) =>
                    patch({ inbound_webhook_secret: event.target.value })
                  }
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Настройки SMTP"
            description="Будьте внимательны: при неверных данных письма не дойдут до получателя."
            size="compact"
            actions={
              <Switch
                id="mailbox-smtp-enabled"
                checked={draft.smtp_enabled}
                disabled={!canWrite}
                label={draft.smtp_enabled ? "Включено" : "Выключено"}
                onChange={(event) =>
                  patch({ smtp_enabled: event.target.checked })
                }
              />
            }
          >
            <div className="flex flex-col gap-portal-4">
              <div className="grid gap-portal-4 md:grid-cols-[1fr_8rem]">
                <Field label="SMTP-сервер" htmlFor="mailbox-smtp-host">
                  <Input
                    id="mailbox-smtp-host"
                    value={draft.smtp_host}
                    disabled={!canWrite || !draft.smtp_enabled}
                    placeholder="smtp.mail.ru"
                    onChange={(event) =>
                      patch({ smtp_host: event.target.value })
                    }
                  />
                </Field>
                <Field label="Порт" htmlFor="mailbox-smtp-port">
                  <Input
                    id="mailbox-smtp-port"
                    inputMode="numeric"
                    value={draft.smtp_port}
                    disabled={!canWrite || !draft.smtp_enabled}
                    onChange={(event) =>
                      patch({ smtp_port: event.target.value })
                    }
                  />
                </Field>
              </div>
              <Checkbox
                checked={draft.smtp_use_tls}
                disabled={!canWrite || !draft.smtp_enabled}
                label="Использовать защищённое соединение"
                onChange={(event) =>
                  patch({ smtp_use_tls: event.target.checked })
                }
              />
              <div className="grid gap-portal-4 md:grid-cols-2">
                <Field label="Логин" htmlFor="mailbox-smtp-user">
                  <Input
                    id="mailbox-smtp-user"
                    value={draft.smtp_username}
                    disabled={!canWrite || !draft.smtp_enabled}
                    onChange={(event) =>
                      patch({ smtp_username: event.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Пароль"
                  htmlFor="mailbox-smtp-password"
                  help={
                    currentSettings.smtp_password_set
                      ? "Пароль задан. Оставьте пустым, чтобы не менять."
                      : "Пароль не возвращается в интерфейс."
                  }
                >
                  <Input
                    id="mailbox-smtp-password"
                    type="password"
                    autoComplete="new-password"
                    value={draft.smtp_password}
                    disabled={!canWrite || !draft.smtp_enabled}
                    onChange={(event) =>
                      patch({ smtp_password: event.target.value })
                    }
                  />
                </Field>
              </div>
              <Field label="Отправитель (From)" htmlFor="mailbox-smtp-from">
                <Input
                  id="mailbox-smtp-from"
                  type="email"
                  value={draft.smtp_from}
                  disabled={!canWrite || !draft.smtp_enabled}
                  onChange={(event) =>
                    patch({ smtp_from: event.target.value })
                  }
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Интеграция с CRM"
            description="Входящее письмо с неизвестного адреса может создать лид. Календарь и общий доступ к ящику — вне этого этапа."
            size="compact"
          >
            <div className="flex flex-col gap-portal-4">
              <Checkbox
                checked={draft.create_lead_from_unknown}
                disabled={!canWrite}
                label="Создавать лид для входящей почты с нового адреса"
                onChange={(event) =>
                  patch({ create_lead_from_unknown: event.target.checked })
                }
              />
              <Field label="Источник лида" htmlFor="mailbox-lead-source">
                <Input
                  id="mailbox-lead-source"
                  value={draft.lead_source_label}
                  disabled={!canWrite}
                  onChange={(event) =>
                    patch({ lead_source_label: event.target.value })
                  }
                />
              </Field>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
