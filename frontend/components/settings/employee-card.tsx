"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { saveEmployeeRecord } from "@/app/(workspace)/settings/organizations/employees/employee-actions";
import { EmployeeAccessSection } from "@/components/settings/employee-access-section";
import { EmployeeNavDialog } from "@/components/settings/employee-nav-dialog";
import { useEmployeeNav } from "@/components/settings/employee-nav-context";
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
import {
  employeeCardHref,
  employeesListHref,
  type EmployeeCardTab,
  type EmployeeListFilters,
} from "@/lib/settings/employee-access-routes";

type Props = {
  employee: EmployeeView;
  organizations: OrganizationView[];
  tab?: EmployeeCardTab;
  filters?: EmployeeListFilters;
  presentation?: "page" | "dialog";
  onDirtyChange?: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
};

/** PT-05 employee card (`DS-PT-05`). */
export function EmployeeCard({
  employee,
  organizations,
  tab = "main",
  filters = {},
  presentation = "page",
  onDirtyChange,
  onPendingChange,
}: Props) {
  const router = useRouter();
  const nav = useEmployeeNav();
  const restored = useRef(false);
  const [draft, setDraft] = useState<EmployeeDraft>(() => toEmployeeDraft(employee));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const saved = toEmployeeDraft(employee);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const remembered = nav?.drafts[employee.id];
    if (remembered) setDraft(remembered);
  }, [employee.id, nav]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

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
    setDraft((current) => {
      const next = { ...current, [key]: value };
      nav?.setDraft(employee.id, next);
      return next;
    });
  };

  const header = (
        <EntityHeader
          eyebrow={
            <Link
              href={employeesListHref(filters)}
              className="text-portal-primary hover:underline"
            >
              Сотрудники
            </Link>
          }
          title={employee.fullName}
          description="Кадровые поля сотрудника. Логин, роли и пароль остаются у учётной записи."
          status={
            <StatusBadge
              tone={employee.isActive ? "success" : "neutral"}
              size="compact"
            >
              {employee.isActive ? "Работает" : "Архив"}
            </StatusBadge>
          }
        />
  );
  const body = (
    <>
      <nav className="flex flex-wrap gap-portal-3 text-portal-caption" aria-label="Разделы карточки">
        <Link
          href={employeeCardHref(employee.id, "main", filters)}
          replace
          scroll={false}
          data-employee-tab="main"
          aria-current={tab === "main" ? "page" : undefined}
          className={tab === "main" ? "font-semibold text-portal-text" : "text-portal-primary hover:underline"}
        >
          Основное
        </Link>
        <Link
          href={employeeCardHref(employee.id, "access", filters)}
          replace
          scroll={false}
          data-employee-tab="access"
          aria-current={tab === "access" ? "page" : undefined}
          className={tab === "access" ? "font-semibold text-portal-text" : "text-portal-primary hover:underline"}
        >
          Доступ к платформе
        </Link>
      </nav>
      {tab === "main" ? (
      <SectionCard
        title="Карточка сотрудника"
        description="ФИО, должность и контакты хранятся только здесь. Подразделение — свободный текст."
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
              nav?.clearDraft(employee.id);
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
      ) : (
      <SectionCard
        title="Доступ к платформе"
        description="Связь с учётной записью не копирует кадровые поля и не заменяет группы доступа."
        size="compact"
      >
        <EmployeeAccessSection employeeId={employee.id} filters={filters} />
      </SectionCard>
      )}
    </>
  );

  if (presentation === "dialog") {
    return <div data-employee-card={employee.id}>{body}</div>;
  }
  return (
    <SimpleEntityCard header={header}>
      {body}
    </SimpleEntityCard>
  );
}

export function EmployeeCardModal({
  inert = false,
  ...props
}: Props & { inert?: boolean }) {
  const router = useRouter();
  const nav = useEmployeeNav();
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <EmployeeNavDialog
      title={props.employee.fullName}
      level={1}
      dirty={dirty}
      pending={pending}
      inert={inert}
      onClose={() => router.back()}
      onDiscard={() => {
        nav?.clearDraft(props.employee.id);
        router.back();
      }}
    >
      <EmployeeCard
        {...props}
        presentation="dialog"
        onDirtyChange={setDirty}
        onPendingChange={setPending}
      />
    </EmployeeNavDialog>
  );
}
