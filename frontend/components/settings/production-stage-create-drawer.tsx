"use client";

import { type FormEvent, useState } from "react";

import {
  createProductionStage,
  type ProductionStageActionResult,
} from "@/app/(workspace)/settings/catalogs/production-stages/production-stage-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Checkbox, Field, Input } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import {
  validateProductionStageDraft,
  type ProductionStage,
  type ProductionStageDraft,
} from "@/lib/production-stages";

const emptyDraft: ProductionStageDraft = {
  name: "",
  code: "",
  is_active: true,
  sort_order: 0,
};

export function ProductionStageCreateDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (stage: ProductionStage) => void;
}) {
  const { push: pushToast } = useToast();
  const [draft, setDraft] = useState<ProductionStageDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = <K extends keyof ProductionStageDraft>(
    field: K,
    value: ProductionStageDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const close = () => {
    if (saving) return;
    setDraft(emptyDraft);
    setError("");
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateProductionStageDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const result: ProductionStageActionResult =
        await createProductionStage(draft);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      pushToast("Цех создан", "success");
      onCreated?.(result.stage);
      setDraft(emptyDraft);
      setError("");
      onClose();
    } catch {
      setError("Не удалось связаться с API. Цех не создан.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CreateDrawer
      open={open}
      title="Новый цех"
      description="Справочник этапов производства для маршрутов и тех операций."
      onClose={close}
      variant="overlay"
    >
      <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-portal-4 overflow-y-auto p-portal-6">
          <Field label="Наименование" required>
            <Input autoFocus required maxLength={255} value={draft.name} onChange={(event) => update("name", event.target.value)} disabled={saving} />
          </Field>
          <Field label="Код" required>
            <Input required maxLength={64} value={draft.code} onChange={(event) => update("code", event.target.value)} disabled={saving} />
          </Field>
          <Field label="Порядок сортировки" required>
            <Input value={String(draft.sort_order)} inputMode="numeric" onChange={(event) => update("sort_order", Number(event.target.value) || 0)} disabled={saving} />
          </Field>
          <Checkbox checked={draft.is_active} onChange={(event) => update("is_active", event.target.checked)} disabled={saving} label="Активен" />
          {error ? <p className="text-portal-body text-portal-danger" role="alert">{error}</p> : null}
        </div>
        <footer className="flex justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
          <Button type="button" onClick={close} disabled={saving}>Отмена</Button>
          <Button type="submit" variant="primary" disabled={saving}>{saving ? "Создание…" : "Создать"}</Button>
        </footer>
      </form>
    </CreateDrawer>
  );
}
