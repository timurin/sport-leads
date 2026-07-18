"use client";

import { X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import type { LeadCreateActionResult } from "@/app/(workspace)/sales/leads/lead-create-actions";
import { Button } from "@/components/ui/button";
import { CityAutocomplete } from "@/components/ui/city-autocomplete";
import type { LeadCreateDraft } from "@/lib/sales/lead-creation";

type Props = {
  onClose: () => void;
  onCreate: (draft: LeadCreateDraft) => Promise<LeadCreateActionResult>;
};

const emptyDraft: LeadCreateDraft = {
  contactName: "",
  companyName: "",
  phone: "",
  email: "",
  city: "",
  source: "manual",
};

const fieldClass = "mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400";

export function LeadCreateDialog({ onClose, onCreate }: Props) {
  const [draft, setDraft] = useState<LeadCreateDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, saving]);

  function update(field: keyof LeadCreateDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await onCreate(draft);
      if (result.ok) {
        onClose();
        return;
      }
      setError(result.message);
    } catch {
      setError("Не удалось связаться с backend. Лид не создан.");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={() => { if (!saving) onClose(); }}>
      <section
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-2xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-create-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="lead-create-dialog-title" className="text-lg font-semibold text-slate-950">Создать лид</h2>
            <p className="mt-1 text-sm text-slate-500">После сохранения лид появится в стадии «Новый».</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Закрыть создание лида">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Контактное лицо <span className="text-red-600">*</span>
            <input autoFocus required maxLength={255} value={draft.contactName} onChange={(event) => update("contactName", event.target.value)} className={fieldClass} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Организация
            <input maxLength={255} value={draft.companyName} onChange={(event) => update("companyName", event.target.value)} className={fieldClass} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Телефон
            <input type="tel" maxLength={50} value={draft.phone} onChange={(event) => update("phone", event.target.value)} className={fieldClass} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Email
            <input type="email" maxLength={255} value={draft.email} onChange={(event) => update("email", event.target.value)} className={fieldClass} />
          </label>
          <CityAutocomplete id="lead-create-city" label="Город" value={draft.city} onChange={(value) => update("city", value)} inputClassName={fieldClass} />
          <label className="text-sm font-medium text-slate-700">
            Источник
            <select value={draft.source} onChange={(event) => update("source", event.target.value)} className={fieldClass}>
              <option value="manual">Вручную</option>
              <option value="website">Сайт</option>
              <option value="phone">Телефон</option>
              <option value="email">Email</option>
              <option value="referral">Рекомендация</option>
              <option value="vk">VK</option>
            </select>
          </label>

          {error ? <p className="text-sm text-red-700 sm:col-span-2" role="alert">{error}</p> : null}
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:col-span-2 sm:flex-row sm:justify-end">
            <Button type="button" onClick={onClose} disabled={saving}>Отмена</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? "Создание…" : "Создать"}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
