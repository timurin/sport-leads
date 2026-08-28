"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createTransferDocumentAction } from "@/app/(workspace)/warehouse/movements/transfer-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Field, Select } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import type { Warehouse } from "@/lib/warehouses";

export function TransferCreateDrawer({
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
  const defaultSource = useMemo(() => {
    const preferred = active.find((row) => row.is_default);
    return String((preferred ?? active[0])?.id ?? "");
  }, [active]);
  const defaultDest = useMemo(() => {
    const other = active.find((row) => String(row.id) !== defaultSource);
    return String(other?.id ?? "");
  }, [active, defaultSource]);
  const [sourceId, setSourceId] = useState(defaultSource);
  const [destId, setDestId] = useState(defaultDest);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    if (saving) return;
    setError("");
    setSourceId(defaultSource);
    setDestId(defaultDest);
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const source = Number(sourceId || defaultSource);
    const dest = Number(destId || defaultDest);
    if (!Number.isSafeInteger(source) || source <= 0) {
      setError("Укажите склад-источник");
      return;
    }
    if (!Number.isSafeInteger(dest) || dest <= 0) {
      setError("Укажите склад-получатель");
      return;
    }
    if (source === dest) {
      setError("Склад-получатель должен отличаться от склада-источника");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await createTransferDocumentAction(source, dest);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      pushToast("Перемещение создано", "success");
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
      title="Перемещение"
      description="Черновик перемещения между двумя складами. Строки и проведение — на карточке."
      onClose={close}
      variant="overlay"
    >
      <form
        className="flex flex-col gap-portal-4"
        onSubmit={submit}
        data-stock-transfer-create
      >
        {error ? (
          <p className="text-portal-caption text-portal-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Field label="Со склада" htmlFor="transfer-source" required>
          <Select
            id="transfer-source"
            value={sourceId || defaultSource}
            onChange={(event) => setSourceId(event.target.value)}
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
        <Field label="На склад" htmlFor="transfer-dest" required>
          <Select
            id="transfer-dest"
            value={destId}
            onChange={(event) => setDestId(event.target.value)}
            disabled={saving || active.length < 2}
          >
            {active.length < 2 ? (
              <option value="">Нужны минимум два склада</option>
            ) : (
              active.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))
            )}
          </Select>
        </Field>
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
            disabled={saving || active.length < 2}
          >
            Создать
          </Button>
        </div>
      </form>
    </CreateDrawer>
  );
}
