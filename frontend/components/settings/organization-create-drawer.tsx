"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createOrganizationRecord } from "@/app/(workspace)/settings/organizations/organization-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Field, Input } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  emptyOrganizationDraft,
  type OrganizationDraft,
} from "@/lib/settings/organizations";
import { validateInn } from "@/lib/sales/client-requisites";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function OrganizationCreateDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<OrganizationDraft>(() => emptyOrganizationDraft());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setDraft(emptyOrganizationDraft());
    setError(null);
  };

  return (
    <CreateDrawer
      open={open}
      title="Новая организация"
      description="Наши юридические лица для заказов и документов. Не demo-справочник."
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
          const innError = validateInn(draft.taxId);
          if (innError) {
            setError(innError);
            return;
          }
          startTransition(async () => {
            setError(null);
            const result = await createOrganizationRecord(draft);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            reset();
            onClose();
            router.push(`/settings/organizations/${result.id}`);
            router.refresh();
          });
        }}
      >
        <div className="min-h-0 flex-1 space-y-portal-3 overflow-y-auto px-portal-4 py-portal-4">
          {error ? (
            <InlineAlert tone="danger" size="compact">
              {error}
            </InlineAlert>
          ) : null}
          <Field label="Наименование" htmlFor="org-create-name" required>
            <Input
              id="org-create-name"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
            />
          </Field>
          <Field label="ИНН" htmlFor="org-create-inn">
            <Input
              id="org-create-inn"
              value={draft.taxId}
              onChange={(event) =>
                setDraft((current) => ({ ...current, taxId: event.target.value }))
              }
            />
          </Field>
          <Field label="Орг. форма" htmlFor="org-create-form">
            <Input
              id="org-create-form"
              value={draft.legalForm}
              onChange={(event) =>
                setDraft((current) => ({ ...current, legalForm: event.target.value }))
              }
              placeholder="ООО, ИП…"
            />
          </Field>
        </div>
        <div className="flex shrink-0 justify-end gap-portal-2 border-t border-portal-border px-portal-4 py-portal-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            Создать
          </Button>
        </div>
      </form>
    </CreateDrawer>
  );
}
