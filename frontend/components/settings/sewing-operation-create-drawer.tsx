"use client";

import { type FormEvent, useEffect, useState } from "react";

import {
  createSewingOperation,
  type SewingOperationActionResult,
} from "@/app/(workspace)/settings/catalogs/sewing_operations/sewing-operation-actions";
import { SewingOperationEquipmentPicker } from "@/components/settings/sewing-operation-equipment-picker";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Field, Input } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import {
  buildSewingCatalogTreeRows,
  validateSewingOperationDraft,
  type SewingOperation,
  type SewingOperationCreateDraft,
  type SewingOperationFolder,
} from "@/lib/sewing-operations";
import type { WorkCenter } from "@/lib/shop-routings";

function emptyDraft(folderId: number | null = null): SewingOperationCreateDraft {
  return {
    name: "",
    description: "",
    folder_id: folderId,
    work_center_ids: [],
  };
}

type SewingOperationCreateDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (operation: SewingOperation) => void;
  sewingWorkCenters: WorkCenter[];
  folders?: SewingOperationFolder[];
  defaultFolderId?: number | null;
};

/** CreateDrawer host for sewing operations (`6.3.5` / `6.3.10.4` / `6.3.11`, ADR-013). */
export function SewingOperationCreateDrawer({
  open,
  onClose,
  onCreated,
  sewingWorkCenters,
  folders = [],
  defaultFolderId = null,
}: SewingOperationCreateDrawerProps) {
  const { push: pushToast } = useToast();
  const [draft, setDraft] = useState<SewingOperationCreateDraft>(() =>
    emptyDraft(defaultFolderId),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(emptyDraft(defaultFolderId));
    setError("");
  }, [open, defaultFolderId]);

  const folderOptions = buildSewingCatalogTreeRows(folders, []).filter(
    (row) => row.kind === "folder",
  );

  function update<K extends keyof SewingOperationCreateDraft>(
    field: K,
    value: SewingOperationCreateDraft[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleClose() {
    if (saving) return;
    setDraft(emptyDraft(null));
    setError("");
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateSewingOperationDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result: SewingOperationActionResult = await createSewingOperation(draft);
      if (result.ok) {
        setDraft(emptyDraft(null));
        setSaving(false);
        pushToast("Операция создана", "success");
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
      title="Новая операция пошива"
      description="Операция в каталоге с папками: наименование, стоимость, количество, время и оборудование цеха Пошив."
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
              <Field label="Папка">
                <select
                  className="w-full rounded-portal-sm border border-portal-border bg-portal-surface px-2 py-1.5 text-portal-body"
                  value={draft.folder_id ?? ""}
                  disabled={saving}
                  onChange={(event) => {
                    const raw = event.target.value;
                    update("folder_id", raw === "" ? null : Number(raw));
                  }}
                  aria-label="Папка"
                >
                  <option value="">Корень каталога</option>
                  {folderOptions.map((row) =>
                    row.kind === "folder" ? (
                      <option key={row.id} value={row.id}>
                        {"—".repeat(row.depth)} {row.name}
                      </option>
                    ) : null,
                  )}
                </select>
              </Field>
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
              <Field label="Описание">
                <Input
                  maxLength={256}
                  value={draft.description}
                  onChange={(event) => update("description", event.target.value)}
                  disabled={saving}
                  placeholder="Необязательно"
                />
              </Field>
              <Field label="Оборудование (цех Пошив)">
                <SewingOperationEquipmentPicker
                  idPrefix="create-sewing-wc"
                  workCenters={sewingWorkCenters}
                  selectedIds={draft.work_center_ids}
                  disabled={saving}
                  onChange={(ids) => update("work_center_ids", ids)}
                />
              </Field>
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
