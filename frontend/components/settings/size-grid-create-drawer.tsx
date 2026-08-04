"use client";

import { type FormEvent, useState } from "react";

import {
  createSizeGrid,
  type SizeGridActionResult,
} from "@/app/(workspace)/settings/catalogs/size-grids/size-grid-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import {
  emptySizeGridDraft,
  SIZE_GRID_SIZE_TYPE_LABELS,
  validateSizeGridDraft,
  type SizeGrid,
  type SizeGridDraft,
} from "@/lib/size-grids";

/** CreateDrawer for size grids (PT-02 / 17.1.2.4). */
export function SizeGridCreateDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (grid: SizeGrid) => void;
}) {
  const { push: pushToast } = useToast();
  const [draft, setDraft] = useState<SizeGridDraft>(emptySizeGridDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = <K extends keyof SizeGridDraft>(
    field: K,
    value: SizeGridDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const close = () => {
    if (saving) return;
    setDraft(emptySizeGridDraft());
    setError("");
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateSizeGridDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const result: SizeGridActionResult = await createSizeGrid(draft);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      pushToast("Размерная сетка создана", "success");
      onCreated?.(result.grid);
      setDraft(emptySizeGridDraft());
      setError("");
      onClose();
    } catch {
      setError("Не удалось связаться с API. Сетка не создана.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CreateDrawer
      open={open}
      title="Новая размерная сетка"
      description="Одна сетка — один тип размера (Variant A)."
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
          <Field label="Тип" required>
            <Select
              value={draft.size_type}
              onChange={(event) =>
                update(
                  "size_type",
                  event.target.value as SizeGridDraft["size_type"],
                )
              }
              disabled={saving}
            >
              <option value="men">{SIZE_GRID_SIZE_TYPE_LABELS.men}</option>
              <option value="women">{SIZE_GRID_SIZE_TYPE_LABELS.women}</option>
              <option value="kids">{SIZE_GRID_SIZE_TYPE_LABELS.kids}</option>
            </Select>
          </Field>
          <Field label="Источник / примечание">
            <Input
              maxLength={500}
              value={draft.source_note}
              onChange={(event) => update("source_note", event.target.value)}
              disabled={saving}
              placeholder="Например, Mosmade"
            />
          </Field>
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
