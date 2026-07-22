"use client";

import { type FormEvent, useState } from "react";

import {
  createProductModel,
  type ProductModelCreateResult,
} from "@/app/(workspace)/settings/catalogs/product-models/product-model-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import {
  PRODUCT_MODEL_SIZE_TYPE_LABELS,
  validateProductModelCreateDraft,
  type ProductModel,
  type ProductModelCreateDraft,
  type ProductModelSizeType,
} from "@/lib/product-models";

const emptyDraft: ProductModelCreateDraft = {
  article: "",
  name: "",
  size_type: "men",
  description: "",
};

type ProductModelCreateDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (model: ProductModel) => void;
};

/** CreateDrawer host for product models (`6.1.9`, ADR-013). */
export function ProductModelCreateDrawer({
  open,
  onClose,
  onCreated,
}: ProductModelCreateDrawerProps) {
  const { push: pushToast } = useToast();
  const [draft, setDraft] = useState<ProductModelCreateDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof ProductModelCreateDraft>(
    field: K,
    value: ProductModelCreateDraft[K],
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
    const validationError = validateProductModelCreateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result: ProductModelCreateResult = await createProductModel({
        article: draft.article,
        name: draft.name,
        size_type: draft.size_type,
        description: draft.description.trim() || null,
      });
      if (result.ok) {
        setDraft(emptyDraft);
        setSaving(false);
        pushToast("Модель создана", "success");
        onCreated?.(result.model);
        onClose();
        return;
      }
      setError(result.message);
    } catch {
      setError("Не удалось связаться с API. Модель не создана.");
    }
    setSaving(false);
  }

  return (
    <CreateDrawer
      open={open}
      title="Новая модель изделия"
      description="Модель создаётся в статусе «Черновик». Карточку можно открыть после сохранения."
      onClose={handleClose}
      variant="overlay"
    >
      <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-portal-5 overflow-y-auto p-portal-6">
          <div className="border-t border-portal-border pt-portal-5">
            <h3 className="mb-portal-4 text-portal-body font-semibold text-portal-text">
              Основные реквизиты
            </h3>
            <div className="grid gap-portal-4">
              <Field label="Артикул" required>
                <Input
                  autoFocus
                  required
                  maxLength={100}
                  value={draft.article}
                  onChange={(event) => update("article", event.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Название" required>
                <Input
                  required
                  maxLength={255}
                  value={draft.name}
                  onChange={(event) => update("name", event.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Тип размерной сетки" required>
                <Select
                  required
                  value={draft.size_type}
                  onChange={(event) =>
                    update(
                      "size_type",
                      event.target.value as ProductModelSizeType,
                    )
                  }
                  disabled={saving}
                >
                  {Object.entries(PRODUCT_MODEL_SIZE_TYPE_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </Select>
              </Field>
              <Field label="Описание">
                <Textarea
                  value={draft.description}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                  disabled={saving}
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
