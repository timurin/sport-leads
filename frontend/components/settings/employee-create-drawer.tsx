"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createEmployeeRecord } from "@/app/(workspace)/settings/organizations/employees/employee-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  emptyEmployeeDraft,
  validateEmployeeEmail,
  type EmployeeDraft,
} from "@/lib/settings/employees";
import type { OrganizationView } from "@/lib/settings/organizations";

type Props = {
  open: boolean;
  onClose: () => void;
  organizations: OrganizationView[];
};

export function EmployeeCreateDrawer({ open, onClose, organizations }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<EmployeeDraft>(() => emptyEmployeeDraft());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const activeOrgs = organizations.filter((item) => item.isActive);

  const reset = () => {
    setDraft(emptyEmployeeDraft());
    setError(null);
  };

  return (
    <CreateDrawer
      open={open}
      title="Новый сотрудник"
      description="Кадровая карточка в организации. Это не кабинет Пользователи и не demo-справочник."
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
          if (!draft.fullName.trim()) {
            setError("Укажите ФИО");
            return;
          }
          if (draft.organizationId === "") {
            setError("Выберите организацию");
            return;
          }
          const emailError = validateEmployeeEmail(draft.email);
          if (emailError) {
            setError(emailError);
            return;
          }
          startTransition(async () => {
            setError(null);
            const result = await createEmployeeRecord(draft);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            reset();
            onClose();
            router.push(`/settings/organizations/employees/${result.id}`);
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
          {activeOrgs.length === 0 ? (
            <InlineAlert tone="warning" size="compact">
              Сначала создайте организацию в справочнике юридических лиц.
            </InlineAlert>
          ) : null}
          <Field label="ФИО" htmlFor="employee-create-name" required>
            <Input
              id="employee-create-name"
              value={draft.fullName}
              onChange={(event) =>
                setDraft((current) => ({ ...current, fullName: event.target.value }))
              }
            />
          </Field>
          <Field label="Организация" htmlFor="employee-create-org" required>
            <Select
              id="employee-create-org"
              value={draft.organizationId === "" ? "" : String(draft.organizationId)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  organizationId: event.target.value === "" ? "" : Number(event.target.value),
                }))
              }
            >
              <option value="">Выберите организацию</option>
              {activeOrgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Должность" htmlFor="employee-create-position">
            <Input
              id="employee-create-position"
              value={draft.position}
              onChange={(event) =>
                setDraft((current) => ({ ...current, position: event.target.value }))
              }
            />
          </Field>
          <Field label="Подразделение" htmlFor="employee-create-department">
            <Input
              id="employee-create-department"
              value={draft.department}
              onChange={(event) =>
                setDraft((current) => ({ ...current, department: event.target.value }))
              }
              placeholder="Свободный текст, не отдельный справочник"
            />
          </Field>
          <Field label="Телефон" htmlFor="employee-create-phone">
            <Input
              id="employee-create-phone"
              value={draft.phone}
              onChange={(event) =>
                setDraft((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </Field>
        </div>
        <div className="flex shrink-0 justify-end gap-portal-2 border-t border-portal-border px-portal-4 py-portal-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={pending || activeOrgs.length === 0}
          >
            Создать
          </Button>
        </div>
      </form>
    </CreateDrawer>
  );
}
