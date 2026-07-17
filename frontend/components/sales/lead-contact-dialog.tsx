"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { validateContactFields, type ContactFieldErrors } from "@/lib/sales/lead-customer";
import type { CommunicationChannel, LeadContact } from "@/types/sales";

export const communicationChannelOptions: ReadonlyArray<{
  value: CommunicationChannel;
  label: string;
}> = [
  { value: "phone", label: "Телефон" },
  { value: "email", label: "Email" },
  { value: "telegram", label: "Telegram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "vk", label: "VK" },
  { value: "unspecified", label: "Не указан" },
];

export type ContactDraft = {
  name: string;
  position: string;
  phone: string;
  email: string;
  messenger: string;
  preferredChannel: CommunicationChannel;
  isPrimary: boolean;
};

export type ContactDialogResult = {
  ok: boolean;
  message: string;
};

const fieldClass = "mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function closeOnEscape(onClose: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      onClose();
    }
  };
}

export function LeadContactDialog({
  contact,
  persistent,
  onClose,
  onSave,
}: {
  contact: LeadContact | null;
  persistent: boolean;
  onClose: () => void;
  onSave: (draft: ContactDraft) => ContactDialogResult | Promise<ContactDialogResult>;
}) {
  const [draft, setDraft] = useState<ContactDraft>(() => ({
    name: contact?.name ?? "",
    position: contact?.position ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    messenger: contact?.messenger ?? "",
    preferredChannel: contact?.preferredChannel ?? "unspecified",
    isPrimary: contact?.isPrimary ?? false,
  }));
  const [errors, setErrors] = useState<ContactFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const handler = closeOnEscape(onClose);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function update<Field extends keyof ContactDraft>(field: Field, value: ContactDraft[Field]) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === "name" || field === "email" || field === "phone") {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateContactFields(draft);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      setSaving(true);
      setSaveError("");
      const result = await onSave(draft);
      if (!result.ok) {
        setSaveError(result.message);
      }
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={onClose}>
      <section
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-2xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-contact-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="lead-contact-dialog-title" className="text-lg font-semibold text-slate-950">
              {contact ? "Редактировать контакт" : "Добавить контакт"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {persistent ? "Изменения сохраняются в карточке лида." : "Demo-режим: изменения сохраняются только локально."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Закрыть окно контакта"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Имя
            <input
              autoFocus
              value={draft.name}
              onChange={(event) => update("name", event.target.value)}
              className={fieldClass}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "contact-name-error" : undefined}
            />
            {errors.name ? <span id="contact-name-error" className="mt-1 block text-xs text-red-700">{errors.name}</span> : null}
          </label>

          <label className="text-sm font-medium text-slate-700">
            Должность
            <input value={draft.position} onChange={(event) => update("position", event.target.value)} className={fieldClass} />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Телефон
            <input
              type="tel"
              value={draft.phone}
              onChange={(event) => update("phone", event.target.value)}
              className={fieldClass}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "contact-phone-error" : undefined}
            />
            {errors.phone ? <span id="contact-phone-error" className="mt-1 block text-xs text-red-700">{errors.phone}</span> : null}
          </label>

          <label className="text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={draft.email}
              onChange={(event) => update("email", event.target.value)}
              className={fieldClass}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "contact-email-error" : undefined}
            />
            {errors.email ? <span id="contact-email-error" className="mt-1 block text-xs text-red-700">{errors.email}</span> : null}
          </label>

          <label className="text-sm font-medium text-slate-700">
            Мессенджер
            <input value={draft.messenger} onChange={(event) => update("messenger", event.target.value)} className={fieldClass} />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Предпочтительный канал
            <select
              value={draft.preferredChannel}
              onChange={(event) => update("preferredChannel", event.target.value as CommunicationChannel)}
              className={fieldClass}
            >
              {communicationChannelOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.isPrimary}
              disabled={Boolean(contact?.isPrimary)}
              onChange={(event) => update("isPrimary", event.target.checked)}
              className="mt-0.5 size-4"
            />
            <span>
              Основной контакт
              {contact?.isPrimary ? <span className="mt-1 block text-xs text-slate-500">Назначьте основным другой контакт, чтобы изменить этот статус.</span> : null}
            </span>
          </label>

          {persistent ? (
            <p className="text-xs text-slate-500 sm:col-span-2">Поле «Мессенджер» пока хранится только в текущей сессии.</p>
          ) : null}
          {saveError ? <p className="text-sm text-red-700 sm:col-span-2" role="alert">{saveError}</p> : null}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:col-span-2 sm:flex-row sm:justify-end">
            <Button type="button" onClick={onClose} disabled={saving}>Отмена</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? "Сохранение…" : contact ? "Сохранить" : "Добавить"}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function LeadContactDeleteDialog({
  contact,
  persistent,
  onCancel,
  onConfirm,
}: {
  contact: LeadContact;
  persistent: boolean;
  onCancel: () => void;
  onConfirm: () => ContactDialogResult | Promise<ContactDialogResult>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  useEffect(() => {
    const handler = closeOnEscape(onCancel);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  async function confirm() {
    setDeleting(true);
    setDeleteError("");
    const result = await onConfirm();
    if (!result.ok) {
      setDeleteError(result.message);
    }
    setDeleting(false);
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={onCancel}>
      <section
        className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-contact-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="delete-contact-title" className="text-lg font-semibold text-slate-950">Удалить контакт?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {persistent
            ? `Контакт «${contact.name}» будет удалён из карточки лида.`
            : `Контакт «${contact.name}» будет удалён только из локального состояния страницы.`}
        </p>
        {deleteError ? <p className="mt-3 text-sm text-red-700" role="alert">{deleteError}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" onClick={onCancel} disabled={deleting}>Отмена</Button>
          <Button type="button" variant="primary" onClick={confirm} disabled={deleting} autoFocus>{deleting ? "Удаление…" : "Удалить"}</Button>
        </div>
      </section>
    </div>
  );
}
