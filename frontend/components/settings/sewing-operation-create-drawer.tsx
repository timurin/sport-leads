"use client";

import { type FormEvent, useState } from "react";

import {
  createSewingOperation,
  type SewingOperationActionResult,
} from "@/app/(workspace)/settings/catalogs/sewing_operations/sewing-operation-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Field, Input } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import {
  validateSewingOperationDraft,
  type SewingOperation,
  type SewingOperationCreateDraft,
} from "@/lib/sewing-operations";

const emptyDraft: SewingOperationCreateDraft = {
  name: "",
  cost: "",
};

type SewingOperationCreateDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (operation: SewingOperation) => void;
};

/** CreateDrawer host for sewing operations (`6.3.5`, ADR-013). */
export function SewingOperationCreateDrawer({
  open,
  onClose,
  onCreated,
}: SewingOperationCreateDrawerProps) {
  const { push: pushToast } = useToast();
  const [draft, setDraft] = useState<SewingOperationCreateDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof SewingOperationCreateDraft>(
    field: K,
    value: SewingOperationCreateDraft[K],
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
    const validationError = validateSewingOperationDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result: SewingOperationActionResult = await createSewingOperation({
        name: draft.name,
        cost: draft.cost,
      });
      if (result.ok) {
        setDraft(emptyDraft);
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
      description="Плоский справочник: наименование и стоимость."
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
              <Field label="Стоимость" required>
                <Input
                  required
                  inputMode="decimal"
                  value={draft.cost}
                  onChange={(event) => update("cost", event.target.value)}
                  disabled={saving}
                  placeholder="0,00"
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
