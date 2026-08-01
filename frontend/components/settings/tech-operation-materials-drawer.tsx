"use client";

import { useEffect, useState, type FormEvent } from "react";

import { updateTechOperation } from "@/app/(workspace)/settings/catalogs/tech-operations/tech-operation-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import type { TechOperation, TechOperationRequiredMaterial } from "@/lib/tech-operations";

type MaterialOption = {
  id: number;
  name: string;
  unit: string;
  is_active: boolean;
};

type Props = {
  operation: TechOperation | null;
  materialOptions: MaterialOption[];
  onClose: () => void;
  onSaved: (operation: TechOperation) => void;
};

export function TechOperationMaterialsDrawer({
  operation,
  materialOptions,
  onClose,
  onSaved,
}: Props) {
  const { push: pushToast } = useToast();
  const [rows, setRows] = useState<TechOperationRequiredMaterial[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRows(
      operation?.required_materials.map((item) => ({
        id: item.id,
        nomenclature_id: item.nomenclature_id,
        nomenclature_name: item.nomenclature_name ?? "",
        quantity: String(item.quantity),
        unit: item.unit ?? "",
      })) ?? [],
    );
    setError("");
    setSaving(false);
  }, [operation]);

  function updateRow(index: number, patch: Partial<TechOperationRequiredMaterial>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
    setError("");
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { nomenclature_id: 0, nomenclature_name: "", quantity: "", unit: "" },
    ]);
    setError("");
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operation == null) return;
    setSaving(true);
    setError("");
    try {
      const result = await updateTechOperation(operation.id, {
        name: operation.name,
        code: operation.code,
        volume_unit: operation.volume_unit,
        production_stage_id: operation.production_stage_id,
        is_active: operation.is_active,
        required_materials: rows,
      });
      if (!result.ok) {
        setError(result.message);
        setSaving(false);
        return;
      }
      pushToast("Необходимые материалы сохранены", "success");
      onSaved(result.operation);
    } catch {
      setError("Не удалось сохранить материалы операции.");
      setSaving(false);
    }
  }

  return (
    <CreateDrawer
      open={operation != null}
      title={operation ? `Необходимые материалы: ${operation.name}` : "Необходимые материалы"}
      description={
        operation
          ? `Расход на 1 ${operation.volume_unit === "linear_meters" ? "м.п." : "шт."} операции.`
          : "Расход материалов по умолчанию."
      }
      onClose={() => {
        if (!saving) onClose();
      }}
      variant="overlay"
    >
      <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-portal-4 overflow-y-auto p-portal-6">
          <div className="flex justify-end">
            <Button type="button" size="compact" onClick={addRow} disabled={saving}>
              Добавить материал
            </Button>
          </div>
          {rows.length === 0 ? (
            <p className="text-portal-caption text-portal-muted">
              Материалы по умолчанию не заданы.
            </p>
          ) : (
            rows.map((row, index) => (
              <div
                key={row.id ?? `row-${index}`}
                className="grid gap-portal-3 rounded-portal-md border border-portal-border p-portal-4"
              >
                <Field label="Материал" required>
                  <Select
                    value={row.nomenclature_id > 0 ? String(row.nomenclature_id) : ""}
                    onChange={(event) => {
                      const selected = materialOptions.find(
                        (option) => option.id === Number(event.target.value),
                      );
                      updateRow(index, {
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
                <Field
                  label={`Расход на 1 ${operation?.volume_unit === "linear_meters" ? "м.п." : "шт."}`}
                  required
                >
                  <Input
                    value={String(row.quantity ?? "")}
                    onChange={(event) => updateRow(index, { quantity: event.target.value })}
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
                    onClick={() => removeRow(index)}
                    disabled={saving}
                  >
                    Удалить
                  </Button>
                </div>
              </div>
            ))
          )}
          {error ? (
            <p className="text-portal-body text-portal-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <footer className="flex items-center justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
          <Button type="button" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={saving || operation == null}>
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </footer>
      </form>
    </CreateDrawer>
  );
}
