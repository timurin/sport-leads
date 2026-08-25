"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveOrganizationRecord } from "@/app/(workspace)/settings/organizations/organization-actions";
import { SimpleEntityCard } from "@/components/entity/simple-entity-card";
import { Button } from "@/components/ui/button";
import { EntityHeader } from "@/components/ui/entity-header";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  toOrganizationDraft,
  type OrganizationDraft,
  type OrganizationView,
} from "@/lib/settings/organizations";

type Props = {
  organization: OrganizationView;
};

/** PT-05 organization card (`DS-PT-05`). */
export function OrganizationCard({ organization }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<OrganizationDraft>(() =>
    toOrganizationDraft(organization),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setField = <K extends keyof OrganizationDraft>(
    key: K,
    value: OrganizationDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <SimpleEntityCard
      header={
        <EntityHeader
          eyebrow={
            <Link href="/settings/organizations" className="text-portal-primary hover:underline">
              Организации
            </Link>
          }
          title={organization.name}
          description="Юридическое лицо компании для заказов и документов"
          status={
            <StatusBadge
              tone={organization.isActive ? "success" : "neutral"}
              size="compact"
            >
              {organization.isActive ? "Активна" : "Архив"}
            </StatusBadge>
          }
        />
      }
    >
      <SectionCard
        title="Реквизиты"
        description="Поля Organization (ADR-002). Банки, сотрудники и склады — отдельные этапы."
        size="compact"
      >
        {error ? (
          <InlineAlert tone="danger" size="compact">
            {error}
          </InlineAlert>
        ) : null}
        <form
          className="grid min-w-0 gap-portal-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              setError(null);
              const result = await saveOrganizationRecord(organization.id, draft);
              if (!result.ok) {
                setError(result.message);
                return;
              }
              router.refresh();
            });
          }}
        >
          <Field label="Наименование" htmlFor="org-name" required className="sm:col-span-2">
            <Input
              id="org-name"
              value={draft.name}
              onChange={(event) => setField("name", event.target.value)}
            />
          </Field>
          <Field label="Орг. форма" htmlFor="org-form">
            <Input
              id="org-form"
              value={draft.legalForm}
              onChange={(event) => setField("legalForm", event.target.value)}
            />
          </Field>
          <Field label="ИНН" htmlFor="org-inn">
            <Input
              id="org-inn"
              value={draft.taxId}
              onChange={(event) => setField("taxId", event.target.value)}
            />
          </Field>
          <Field label="КПП" htmlFor="org-kpp">
            <Input
              id="org-kpp"
              value={draft.kpp}
              onChange={(event) => setField("kpp", event.target.value)}
            />
          </Field>
          <Field label="ОГРН" htmlFor="org-ogrn">
            <Input
              id="org-ogrn"
              value={draft.ogrn}
              onChange={(event) => setField("ogrn", event.target.value)}
            />
          </Field>
          <Field label="Налогообложение" htmlFor="org-tax-system">
            <Input
              id="org-tax-system"
              value={draft.taxSystem}
              onChange={(event) => setField("taxSystem", event.target.value)}
            />
          </Field>
          <Field label="Руководитель" htmlFor="org-director">
            <Input
              id="org-director"
              value={draft.director}
              onChange={(event) => setField("director", event.target.value)}
            />
          </Field>
          <Field label="Юридический адрес" htmlFor="org-address" className="sm:col-span-2">
            <Textarea
              id="org-address"
              value={draft.legalAddress}
              onChange={(event) => setField("legalAddress", event.target.value)}
              rows={3}
            />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox
              id="org-active"
              label="Активна"
              checked={draft.isActive}
              onChange={(event) => setField("isActive", event.target.checked)}
            />
          </div>
          <div className="flex justify-end gap-portal-2 sm:col-span-2">
            <Button type="submit" variant="primary" disabled={pending}>
              Сохранить
            </Button>
          </div>
        </form>
      </SectionCard>
    </SimpleEntityCard>
  );
}
