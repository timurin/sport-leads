"use client";

import { type FormEvent, useState } from "react";

import {
  createProductType,
  type ProductTypeActionResult,
} from "@/app/(workspace)/settings/catalogs/product-types/product-type-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Checkbox, Field, Input } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import {
  validateProductTypeDraft,
  type ProductType,
  type ProductTypeDraft,
} from "@/lib/product-types";

const emptyDraft: ProductTypeDraft = {
  name: "",
  is_active: true,
  sort_order: "0",
};

type ProductTypeCreateDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (productType: ProductType) => void;
};

/** CreateDrawer host for product types (`6.1.14`, ADR-013). */
export function ProductTypeCreateDrawer({
  open,
  onClose,
  onCreated,
}: ProductTypeCreateDrawerProps) {
  const { push: pushToast } = useToast();
  const [draft, setDraft] = useState<ProductTypeDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof ProductTypeDraft>(
    field: K,
    value: ProductTypeDraft[K],
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
    const validationError = validateProductTypeDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result: ProductTypeActionResult = await createProductType(draft);
      if (result.ok) {
        setDraft(emptyDraft);
        setSaving(false);
        pushToast("Вид изделия создан", "success");
        onCreated?.(result.productType);
        onClose();
        return;
      }
      setError(result.message);
    } catch {
      setError("Не удалось связаться с API. Вид изделия не создан.");
    }
    setSaving(false);
  }

  return (
    <CreateDrawer
      open={open}
      title="Новый вид изделия"
      description="Справочник базы лекал: наименование, активность и порядок."
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
              <Field label="Порядок" required>
                <Input
                  required
                  inputMode="numeric"
                  value={draft.sort_order}
                  onChange={(event) => update("sort_order", event.target.value)}
                  disabled={saving}
                />
              </Field>
              <Checkbox
                checked={draft.is_active}
                onChange={(event) => update("is_active", event.target.checked)}
                disabled={saving}
                label="Активен"
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
