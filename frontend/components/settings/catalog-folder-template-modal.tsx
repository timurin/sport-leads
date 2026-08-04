"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Field, Select } from "@/components/ui/form-controls";
import type { ProductModelFolder } from "@/lib/product-models";
import type { SewingOperationTemplate } from "@/lib/sewing-operation-templates";

/** Bind one sewing-operation template to a product-model folder (`6.1.19`). */
export function CatalogFolderTemplateModal({
  open,
  folder,
  templates,
  busy = false,
  onClose,
  onSave,
}: {
  open: boolean;
  folder: ProductModelFolder | null;
  templates: SewingOperationTemplate[];
  busy?: boolean;
  onClose: () => void;
  onSave: (templateId: number | null) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (!open || folder == null) return;
    setSelected(
      folder.default_sewing_operation_template_id != null
        ? String(folder.default_sewing_operation_template_id)
        : "",
    );
  }, [open, folder]);

  if (!open || folder == null) return null;

  return (
    <CreateDrawer
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={`Шаблон операций: ${folder.name}`}
      description="Новые модели в этой папке получат вариант «Базовый» из выбранного шаблона. Существующие модели не меняются."
      variant="overlay"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-portal-4 overflow-y-auto p-portal-6">
          <Field label="Шаблон операций пошива">
            <Select
              value={selected}
              disabled={busy}
              onChange={(event) => setSelected(event.target.value)}
              aria-label="Шаблон операций пошива"
            >
              <option value="">Без шаблона</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.lines.length > 0
                    ? ` (${template.lines.length})`
                    : ""}
                </option>
              ))}
            </Select>
          </Field>
          {templates.length === 0 ? (
            <p className="text-portal-caption text-portal-muted">
              Шаблонов пока нет — создайте их в каталоге операций пошива.
            </p>
          ) : null}
        </div>
        <footer className="flex shrink-0 items-center justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
          <Button type="button" disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            onClick={() =>
              void onSave(selected === "" ? null : Number(selected))
            }
          >
            {busy ? "Сохранение…" : "Сохранить"}
          </Button>
        </footer>
      </div>
    </CreateDrawer>
  );
}
