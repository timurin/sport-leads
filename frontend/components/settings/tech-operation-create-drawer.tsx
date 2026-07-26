"use client";

import { type FormEvent, useState } from "react";

import {
  createTechOperation,
  type TechOperationActionResult,
} from "@/app/(workspace)/settings/catalogs/tech-operations/tech-operation-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import {
  TECH_OPERATION_VOLUME_UNIT_LABELS,
  validateTechOperationDraft,
  type TechOperation,
  type TechOperationDraft,
  type TechOperationVolumeUnit,
} from "@/lib/tech-operations";

const emptyDraft: TechOperationDraft = {
  name: "",
  code: "",
  volume_unit: "pieces",
  is_active: true,
};

type TechOperationCreateDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (operation: TechOperation) => void;
};

/** CreateDrawer host for tech operations (PT-02 catalog). */
export function TechOperationCreateDrawer({
  open,
  onClose,
  onCreated,
}: TechOperationCreateDrawerProps) {
  const { push: pushToast } = useToast();
  const [draft, setDraft] = useState<TechOperationDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof TechOperationDraft>(
    field: K,
    value: TechOperationDraft[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleClose() {
    if (saving) return;
    setDraft(emptyDraft);
    setError("");
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateTechOperationDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result: TechOperationActionResult = await createTechOperation(draft);
      if (result.ok) {
        setDraft(emptyDraft);
        setSaving(false);
        pushToast("Тех операция создана", "success");
        onCreated?.(result.operation);
        onClose();
        return;
      }
      setError(result.message);
    } catch {
      setError("Не удалось связаться с API. Операция не создана.");
    }
    setSaving(false);
  }

  return (
    <CreateDrawer
      open={open}
      title="Новая технологическая операция"
      description="Справочник тех операций для маршрутов производства."
      onClose={handleClose}
      variant="overlay"
    >
      <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-portal-5 overflow-y-auto p-portal-6">
          <div className="border-t border-portal-border pt-portal-5">
            <h3 className="mb-portal-4 text-portal-body font-semibold text-portal-text">
              Реквизиты
            </h3>
            <div className="grid gap-portal-4">
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
              <Field label="Единица объёма" required>
                <Select
                  value={draft.volume_unit}
                  onChange={(event) =>
                    update(
                      "volume_unit",
                      event.target.value as TechOperationVolumeUnit,
                    )
                  }
                  disabled={saving}
                >
                  <option value="pieces">
                    {TECH_OPERATION_VOLUME_UNIT_LABELS.pieces}
                  </option>
                  <option value="linear_meters">
                    {TECH_OPERATION_VOLUME_UNIT_LABELS.linear_meters}
                  </option>
                </Select>
              </Field>
              <Checkbox
                checked={draft.is_active}
                onChange={(event) => update("is_active", event.target.checked)}
                disabled={saving}
                label="Активна"
              />
            </div>
            {error ? (
              <p
                className="mt-portal-4 text-portal-body text-portal-danger"
                role="alert"
              >
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
