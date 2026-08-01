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
  type TechOperationRequiredMaterial,
  type TechOperation,
  type TechOperationDraft,
  type TechOperationVolumeUnit,
} from "@/lib/tech-operations";
import type { ProductionStage } from "@/lib/production-stages";

const emptyDraft: TechOperationDraft = {
  name: "",
  code: "",
  volume_unit: "pieces",
  production_stage_id: null,
  is_active: true,
  required_materials: [],
};

type TechOperationMaterialOption = {
  id: number;
  name: string;
  unit: string;
  is_active: boolean;
};

type TechOperationCreateDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (operation: TechOperation) => void;
  productionStages: ProductionStage[];
  materialOptions: TechOperationMaterialOption[];
};

/** CreateDrawer host for tech operations (PT-02 catalog). */
export function TechOperationCreateDrawer({
  open,
  onClose,
  onCreated,
  productionStages,
  materialOptions,
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

  function updateMaterial(index: number, patch: Partial<TechOperationRequiredMaterial>) {
    setDraft((current) => ({
      ...current,
      required_materials: current.required_materials.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    }));
    setError("");
  }

  function addMaterialRow() {
    setDraft((current) => ({
      ...current,
      required_materials: [
        ...current.required_materials,
        { nomenclature_id: 0, quantity: "", nomenclature_name: "", unit: "" },
      ],
    }));
    setError("");
  }

  function removeMaterialRow(index: number) {
    setDraft((current) => ({
      ...current,
      required_materials: current.required_materials.filter((_, rowIndex) => rowIndex !== index),
    }));
    setError("");
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
              <Field label="Цех">
                <Select
                  value={
                    draft.production_stage_id == null
                      ? ""
                      : String(draft.production_stage_id)
                  }
                  onChange={(event) =>
                    update(
                      "production_stage_id",
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                  disabled={saving}
                >
                  <option value="">Не указан</option>
                  {productionStages
                    .filter((stage) => stage.is_active)
                    .sort(
                      (a, b) =>
                        a.sort_order - b.sort_order ||
                        a.name.localeCompare(b.name, "ru"),
                    )
                    .map((stage) => (
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
                label="Активна"
              />
            </div>
            <div className="mt-portal-5 border-t border-portal-border pt-portal-5">
              <div className="mb-portal-3 flex items-center justify-between gap-portal-3">
                <div>
                  <h3 className="text-portal-body font-semibold text-portal-text">
                    Необходимые материалы
                  </h3>
                  <p className="mt-1 text-portal-caption text-portal-muted">
                    Расход на 1 {TECH_OPERATION_VOLUME_UNIT_LABELS[draft.volume_unit]} операции.
                  </p>
                </div>
                <Button type="button" size="compact" onClick={addMaterialRow} disabled={saving}>
                  Добавить материал
                </Button>
              </div>
              <div className="space-y-portal-3">
                {draft.required_materials.length === 0 ? (
                  <p className="text-portal-caption text-portal-muted">
                    Материалы по умолчанию не заданы.
                  </p>
                ) : (
                  draft.required_materials.map((row, index) => (
                    <div key={`material-${index}`} className="grid gap-portal-3 rounded-portal-md border border-portal-border p-portal-3">
                      <Field label="Материал" required>
                        <Select
                          value={row.nomenclature_id > 0 ? String(row.nomenclature_id) : ""}
                          onChange={(event) => {
                            const selected = materialOptions.find(
                              (option) => option.id === Number(event.target.value),
                            );
                            updateMaterial(index, {
                              nomenclature_id: event.target.value ? Number(event.target.value) : 0,
                              nomenclature_name: selected?.name ?? "",
                              unit: selected?.unit ?? "",
                            });
                          }}
                          disabled={saving}
                        >
                          <option value="">Выберите материал</option>
                          {materialOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name} · {option.unit}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label={`Расход на 1 ${TECH_OPERATION_VOLUME_UNIT_LABELS[draft.volume_unit]}`} required>
                        <Input
                          value={String(row.quantity ?? "")}
                          onChange={(event) => updateMaterial(index, { quantity: event.target.value })}
                          disabled={saving}
                        />
                      </Field>
                      <div className="flex items-center justify-between gap-portal-3">
                        <p className="text-portal-caption text-portal-muted">
                          Ед. материала: {row.unit || "—"}
                        </p>
                        <Button
                          type="button"
                          size="compact"
                          onClick={() => removeMaterialRow(index)}
                          disabled={saving}
                        >
                          Удалить
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
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
