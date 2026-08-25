"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveEmployeeRecord } from "@/app/(workspace)/settings/organizations/employees/employee-actions";
import { SimpleEntityCard } from "@/components/entity/simple-entity-card";
import { Button } from "@/components/ui/button";
import { EntityHeader } from "@/components/ui/entity-header";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  toEmployeeDraft,
  type EmployeeDraft,
  type EmployeeView,
} from "@/lib/settings/employees";
import type { OrganizationView } from "@/lib/settings/organizations";

type Props = {
  employee: EmployeeView;
  organizations: OrganizationView[];
};

/** PT-05 employee card (`DS-PT-05`). */
export function EmployeeCard({ employee, organizations }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<EmployeeDraft>(() => toEmployeeDraft(employee));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const orgOptions = organizations.some((item) => item.id === employee.organizationId)
    ? organizations
    : [
        {
          id: employee.organizationId,
          name: employee.organizationName,
          legalForm: "",
          taxId: "",
          ogrn: "",
          kpp: "",
          taxSystem: "",
          director: "",
          legalAddress: "",
          isActive: true,
        } satisfies OrganizationView,
        ...organizations,
      ];

  const setField = <K extends keyof EmployeeDraft>(
    key: K,
    value: EmployeeDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <SimpleEntityCard
      header={
        <EntityHeader
          eyebrow={
            <Link
              href="/settings/organizations/employees"
              className="text-portal-primary hover:underline"
            >
              Сотрудники
            </Link>
          }
          title={employee.fullName}
          description="Кадровый справочник организации. Логин и роли — в кабинете Пользователи."
          status={
            <StatusBadge
              tone={employee.isActive ? "success" : "neutral"}
              size="compact"
            >
              {employee.isActive ? "Работает" : "Архив"}
            </StatusBadge>
          }
        />
      }
    >
      <SectionCard
        title="Карточка сотрудника"
        description="Связь с PlatformUser отложена. Подразделение — свободный текст."
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
              const result = await saveEmployeeRecord(employee.id, draft);
              if (!result.ok) {
                setError(result.message);
                return;
              }
              router.refresh();
            });
          }}
        >
          <Field label="ФИО" htmlFor="employee-name" required className="sm:col-span-2">
            <Input
              id="employee-name"
              value={draft.fullName}
              onChange={(event) => setField("fullName", event.target.value)}
            />
          </Field>
          <Field label="Организация" htmlFor="employee-org" required>
            <Select
              id="employee-org"
              value={draft.organizationId === "" ? "" : String(draft.organizationId)}
              onChange={(event) =>
                setField(
                  "organizationId",
                  event.target.value === "" ? "" : Number(event.target.value),
                )
              }
            >
              {orgOptions.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                  {org.isActive ? "" : " (архив)"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Должность" htmlFor="employee-position">
            <Input
              id="employee-position"
              value={draft.position}
              onChange={(event) => setField("position", event.target.value)}
            />
          </Field>
          <Field label="Подразделение" htmlFor="employee-department">
            <Input
              id="employee-department"
              value={draft.department}
              onChange={(event) => setField("department", event.target.value)}
            />
          </Field>
          <Field label="Телефон" htmlFor="employee-phone">
            <Input
              id="employee-phone"
              value={draft.phone}
              onChange={(event) => setField("phone", event.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor="employee-email">
            <Input
              id="employee-email"
              type="email"
              value={draft.email}
              onChange={(event) => setField("email", event.target.value)}
            />
          </Field>
          <Field label="Дата приёма" htmlFor="employee-hired">
            <Input
              id="employee-hired"
              type="date"
              value={draft.employmentDate}
              onChange={(event) => setField("employmentDate", event.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox
              id="employee-active"
              label="Работает"
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
