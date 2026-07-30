"use client";

import { type FormEvent, useState } from "react";

import {
  createWorkCenter,
  type WorkCenterActionResult,
} from "@/app/(workspace)/settings/catalogs/work-centers/work-center-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import type { ProductionStage } from "@/lib/production-stages";
import {
  validateWorkCenterDraft,
  type WorkCenter,
  type WorkCenterDraft,
} from "@/lib/shop-routings";

const emptyDraft: WorkCenterDraft = {
  name: "",
  code: "",
  production_stage_id: null,
  is_active: true,
};

/** CreateDrawer host for work centers (PT-02 catalog / 11.1.2.3). */
export function WorkCenterCreateDrawer({
  open,
  productionStages,
  onClose,
  onCreated,
}: {
  open: boolean;
  productionStages: ProductionStage[];
  onClose: () => void;
  onCreated?: (workCenter: WorkCenter) => void;
}) {
  const { push: pushToast } = useToast();
  const [draft, setDraft] = useState<WorkCenterDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = <K extends keyof WorkCenterDraft>(
    field: K,
    value: WorkCenterDraft[K],
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
    const validationError = validateWorkCenterDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const result: WorkCenterActionResult = await createWorkCenter(draft);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      pushToast("Оборудование создано", "success");
      onCreated?.(result.workCenter);
      setDraft(emptyDraft);
      setError("");
      onClose();
    } catch {
      setError("Не удалось связаться с API. Оборудование не создано.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CreateDrawer
      open={open}
      title="Новое оборудование"
      description="Рабочий центр / место внутри цеха (ADR-017). Не путать с этапом производства."
      onClose={close}
      variant="overlay"
    >
      <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-portal-4 overflow-y-auto p-portal-6">
          <Field label="Наименование" required>
            <Input
              autoFocus
              required
              maxLength={255}
              value={draft.name}
              onChange={(event) => update("name", event.target.value)}
              disabled={saving}
            />
          </Field>
          <Field label="Код" required>
            <Input
              required
              maxLength={64}
              value={draft.code}
              onChange={(event) => update("code", event.target.value)}
              disabled={saving}
            />
          </Field>
          <Field label="Цех">
            <Select
              value={
                draft.production_stage_id == null
                  ? ""
                  : String(draft.production_stage_id)
              }
              onChange={(event) => {
                const raw = event.target.value;
                update("production_stage_id", raw ? Number(raw) : null);
              }}
              disabled={saving}
            >
              <option value="">Не привязан</option>
              {productionStages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </Select>
          </Field>
          <Checkbox
            checked={draft.is_active}
            onChange={(event) => update("is_active", event.target.checked)}
            disabled={saving}
            label="Активен"
          />
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
            {saving ? "Создание…" : "Создать"}
          </Button>
        </footer>
      </form>
    </CreateDrawer>
  );
}
