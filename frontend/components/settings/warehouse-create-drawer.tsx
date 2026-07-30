"use client";

import { type FormEvent, useState } from "react";

import {
  createWarehouse,
  type WarehouseActionResult,
} from "@/app/(workspace)/settings/catalogs/warehouses/warehouse-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Checkbox, Field, Input } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import {
  validateWarehouseDraft,
  type Warehouse,
  type WarehouseDraft,
} from "@/lib/warehouses";

const emptyDraft: WarehouseDraft = {
  name: "",
  code: "",
  is_active: true,
  is_default: false,
};

/** CreateDrawer host for warehouses (PT-02 catalog / 12.1.1). */
export function WarehouseCreateDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (warehouse: Warehouse) => void;
}) {
  const { push: pushToast } = useToast();
  const [draft, setDraft] = useState<WarehouseDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = <K extends keyof WarehouseDraft>(
    field: K,
    value: WarehouseDraft[K],
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
    const validationError = validateWarehouseDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const result: WarehouseActionResult = await createWarehouse(draft);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      pushToast("Склад создан", "success");
      onCreated?.(result.warehouse);
      setDraft(emptyDraft);
      setError("");
      onClose();
    } catch {
      setError("Не удалось связаться с API. Склад не создан.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CreateDrawer
      open={open}
      title="Новый склад"
      description="Место хранения материалов и готовой продукции (ADR-019)."
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
          <Checkbox
            checked={draft.is_active}
            onChange={(event) => update("is_active", event.target.checked)}
            disabled={saving}
            label="Активен"
          />
          <Checkbox
            checked={draft.is_default}
            onChange={(event) => update("is_default", event.target.checked)}
            disabled={saving}
            label="По умолчанию"
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
