"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createInventoryDocumentAction } from "@/app/(workspace)/warehouse/movements/inventory-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Checkbox, Field, Select } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import type { Warehouse } from "@/lib/warehouses";

export function InventoryCreateDrawer({
  open,
  warehouses,
  onClose,
}: {
  open: boolean;
  warehouses: Warehouse[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const active = useMemo(
    () => warehouses.filter((row) => row.is_active),
    [warehouses],
  );
  const defaultId = useMemo(() => {
    const preferred = active.find((row) => row.is_default);
    return String((preferred ?? active[0])?.id ?? "");
  }, [active]);
  const [warehouseId, setWarehouseId] = useState(defaultId);
  const [fill, setFill] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    if (saving) return;
    setError("");
    setFill(true);
    setWarehouseId(defaultId);
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = Number(warehouseId || defaultId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      setError("Укажите склад");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await createInventoryDocumentAction(id, fill);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      pushToast("Инвентаризация создана", "success");
      onClose();
      router.push(`/warehouse/movements/${result.document.id}`);
      router.refresh();
    } catch {
      setError("Не удалось связаться с API.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CreateDrawer
      open={open}
      title="Инвентаризация"
      description="Черновик пересчёта по одному складу. Книга снимается с posted remainder."
      onClose={close}
      variant="overlay"
    >
      <form className="flex flex-col gap-portal-4" onSubmit={submit}>
        {error ? (
          <p className="text-portal-caption text-portal-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Field label="Склад" htmlFor="inventory-warehouse" required>
          <Select
            id="inventory-warehouse"
            value={warehouseId || defaultId}
            onChange={(event) => setWarehouseId(event.target.value)}
            disabled={saving || active.length === 0}
          >
            {active.length === 0 ? (
              <option value="">Нет активных складов</option>
            ) : (
              active.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))
            )}
          </Select>
        </Field>
        <Checkbox
          id="inventory-fill"
          checked={fill}
          onChange={(event) => setFill(event.target.checked)}
          disabled={saving}
          label="Заполнить по остаткам склада"
        />
        <div className="flex justify-end gap-portal-2">
          <Button
            type="button"
            variant="secondary"
            size="compact"
            disabled={saving}
            onClick={close}
          >
            Отмена
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="compact"
            disabled={saving || active.length === 0}
          >
            Создать
          </Button>
        </div>
      </form>
    </CreateDrawer>
  );
}
