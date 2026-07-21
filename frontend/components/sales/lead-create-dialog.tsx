"use client";

import { type FormEvent, useState } from "react";

import type { LeadCreateActionResult } from "@/app/(workspace)/sales/leads/lead-create-actions";
import { Button } from "@/components/ui/button";
import { CityAutocomplete } from "@/components/ui/city-autocomplete";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import type { LeadCreateDraft } from "@/lib/sales/lead-creation";

type Props = {
  open: boolean;
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

/**
 * Lead create via CreateDrawer overlay (ADR-013 / 5.4.2.3.4).
 * Kept export name for existing imports.
 */
export function LeadCreateDialog({ open, onClose, onCreate }: Props) {
  const { push: pushToast } = useToast();
  const [draft, setDraft] = useState<LeadCreateDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field: keyof LeadCreateDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleClose() {
    if (saving) {
      return;
    }
    setDraft(emptyDraft);
    setError("");
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await onCreate(draft);
      if (result.ok) {
        setDraft(emptyDraft);
        setSaving(false);
        pushToast("Лид создан", "success");
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
    <CreateDrawer
      open={open}
      title="Создать лид"
      description="После сохранения лид появится в стадии «Новый»."
      onClose={handleClose}
      variant="overlay"
    >
      <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-portal-5 overflow-y-auto p-portal-6">
          <div className="border-t border-portal-border pt-portal-5">
            <h3 className="mb-portal-4 text-portal-body font-semibold text-portal-text">
              Основные данные
            </h3>
            <div className="grid gap-portal-4 sm:grid-cols-2">
              <Field label="Контактное лицо" required className="sm:col-span-1">
                <Input
                  autoFocus
                  required
                  maxLength={255}
                  value={draft.contactName}
                  onChange={(event) => update("contactName", event.target.value)}
                />
              </Field>
              <Field label="Организация">
                <Input
                  maxLength={255}
                  value={draft.companyName}
                  onChange={(event) => update("companyName", event.target.value)}
                />
              </Field>
              <Field label="Телефон">
                <Input
                  type="tel"
                  maxLength={50}
                  value={draft.phone}
                  onChange={(event) => update("phone", event.target.value)}
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  maxLength={255}
                  value={draft.email}
                  onChange={(event) => update("email", event.target.value)}
                />
              </Field>
              <CityAutocomplete
                id="lead-create-city"
                label="Город"
                value={draft.city}
                onChange={(value) => update("city", value)}
              />
              <Field label="Источник">
                <Select
                  value={draft.source}
                  onChange={(event) => update("source", event.target.value)}
                >
                  <option value="manual">Вручную</option>
                  <option value="website">Сайт</option>
                  <option value="phone">Телефон</option>
                  <option value="email">Email</option>
                  <option value="referral">Рекомендация</option>
                  <option value="vk">VK</option>
                </Select>
              </Field>
            </div>
            {error ? (
              <p className="mt-portal-4 text-portal-body text-portal-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
        <footer className="flex items-center justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
          <Button type="button" onClick={handleClose} disabled={saving}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Создание…" : "Создать"}
          </Button>
        </footer>
      </form>
    </CreateDrawer>
  );
}
