"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createSupplierRecord } from "@/app/(workspace)/purchases/suppliers/supplier-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Field, Input } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  emptySupplierDraft,
  type SupplierDraft,
} from "@/lib/purchases/suppliers";
import { validateInn } from "@/lib/sales/client-requisites";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SupplierCreateDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<SupplierDraft>(() => emptySupplierDraft());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setDraft(emptySupplierDraft());
    setError(null);
  };

  return (
    <CreateDrawer
      open={open}
      title="Новый поставщик"
      description="Справочник закупок (ADR-033). Не CRM-клиент."
      onClose={() => {
        reset();
        onClose();
      }}
      variant="overlay"
    >
      <form
        className="flex h-full min-h-0 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.name.trim()) {
            setError("Укажите наименование");
            return;
          }
          const innError = validateInn(draft.inn);
          if (innError) {
            setError(innError);
            return;
          }
          startTransition(async () => {
            setError(null);
            const result = await createSupplierRecord(draft);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            reset();
            onClose();
            router.push(`/purchases/suppliers/${result.id}`);
            router.refresh();
          });
        }}
      >
        <div className="min-h-0 flex-1 space-y-portal-3 overflow-y-auto p-portal-4">
          {error ? (
            <InlineAlert tone="danger" size="compact">
              {error}
            </InlineAlert>
          ) : null}
          <Field label="Наименование" htmlFor="supplier-create-name" required>
            <Input
              id="supplier-create-name"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
              autoFocus
            />
          </Field>
          <Field label="Код" htmlFor="supplier-create-code">
            <Input
              id="supplier-create-code"
              value={draft.code}
              onChange={(event) =>
                setDraft((current) => ({ ...current, code: event.target.value }))
              }
            />
          </Field>
          <Field label="ИНН" htmlFor="supplier-create-inn">
            <Input
              id="supplier-create-inn"
              value={draft.inn}
              onChange={(event) =>
                setDraft((current) => ({ ...current, inn: event.target.value }))
              }
            />
          </Field>
        </div>
        <div className="flex shrink-0 justify-end gap-portal-2 border-t border-portal-border p-portal-4">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Создание…" : "Создать"}
          </Button>
        </div>
      </form>
    </CreateDrawer>
  );
}
