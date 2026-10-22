"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  LINK_EFFECT,
  UNLINK_EFFECT,
  freeAccounts,
  freeEmployees,
  prepareLink,
  prepareUnlink,
  type MappingAccount,
  type MappingEmployee,
} from "@/lib/settings/employee-user-link";
import {
  accountExceptionHref,
  employeeCardHref,
} from "@/lib/settings/employee-access-routes";

type WriteResult = {
  ok: boolean;
  message?: string;
  conflict?: boolean;
};

type Props = {
  mode: "employee" | "account";
  employeeId: number | null;
  account: MappingAccount | null;
  accounts: MappingAccount[];
  employees: MappingEmployee[];
  state: "linked" | "unlinked" | "forbidden" | "unavailable" | "loading";
  statusMessage?: string | null;
  pickerError?: string | null;
  onLink: (accountId: number, employeeId: number, reason: string) => Promise<WriteResult>;
  onUnlink: (
    accountId: number,
    expectedEmployeeId: number,
    reason: string,
  ) => Promise<WriteResult>;
  onRefresh: () => void;
};

export function EmployeeUserLinkPanel({
  mode,
  employeeId,
  account,
  accounts,
  employees,
  state,
  statusMessage,
  pickerError = null,
  onLink,
  onUnlink,
  onRefresh,
}: Props) {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const openAccounts = freeAccounts(accounts);
  const openEmployees = freeEmployees(employees, accounts, includeArchived);
  const linkedEmployee = employees.find((row) => row.id === account?.employeeId);

  const fail = async (result: WriteResult) => {
    setError(result.message ?? "Связь не изменена.");
    if (result.conflict) onRefresh();
  };

  const submitLink = async () => {
    const chosenAccount =
      mode === "employee"
        ? (accounts.find((row) => String(row.id) === selectedAccountId) ?? null)
        : account;
    const chosenEmployeeId = mode === "employee" ? employeeId : Number(selectedEmployeeId);
    const owner =
      chosenEmployeeId != null
        ? (accounts.find((row) => row.employeeId === chosenEmployeeId) ?? null)
        : null;
    const command = prepareLink({
      account: chosenAccount,
      employeeId: chosenEmployeeId ?? 0,
      employeeOwnerAccountId: owner?.id ?? null,
      reason,
    });
    if (!command.ok || !("employee_id" in command.body)) {
      setError(command.ok ? "Команда связи не собрана." : command.message);
      return;
    }
    setPending(true);
    setError(null);
    const result = await onLink(command.accountId, command.body.employee_id, command.body.reason);
    setPending(false);
    if (!result.ok) {
      await fail(result);
      return;
    }
    setReason("");
    setSelectedAccountId("");
    setSelectedEmployeeId("");
  };

  const submitUnlink = async () => {
    if (account == null) return;
    const command = prepareUnlink({
      accountId: account.id,
      expectedEmployeeId: account.employeeId,
      reason,
      confirmed,
    });
    if (!command.ok || !("expected_employee_id" in command.body)) {
      setError(command.ok ? "Команда отвязки не собрана." : command.message);
      return;
    }
    setPending(true);
    setError(null);
    const result = await onUnlink(
      command.accountId,
      command.body.expected_employee_id,
      command.body.reason,
    );
    setPending(false);
    if (!result.ok) {
      await fail(result);
      return;
    }
    setReason("");
    setConfirmed(false);
  };

  return (
    <div className="space-y-portal-3" data-employee-user-link={state}>
      {state === "loading" ? (
        <p className="text-portal-body text-portal-muted">Проверяем учётную запись…</p>
      ) : null}
      {state === "forbidden" || state === "unavailable" ? (
        <InlineAlert tone="danger" size="compact">
          {statusMessage}
        </InlineAlert>
      ) : null}
      {state === "unlinked" ? (
        <p className="text-portal-body text-portal-text">
          {mode === "employee"
            ? "Нет учётной записи."
            : "Учётная запись не связана с сотрудником."}
        </p>
      ) : null}
      {state === "linked" && account != null ? (
        <div className="space-y-portal-2">
          <p className="text-portal-body text-portal-text">
            Привязана учётная запись{" "}
            <span className="font-medium">{account.login}</span>
            {account.displayName ? ` · ${account.displayName}` : ""}
          </p>
          <p>
            <Link
              href={
                account.employeeId != null
                  ? employeeCardHref(account.employeeId, "access")
                  : accountExceptionHref(account.id)
              }
              className="font-semibold text-portal-primary hover:underline"
            >
              {account.employeeId != null
                ? (linkedEmployee?.fullName ?? `Сотрудник #${account.employeeId}`)
                : "Учётная запись без сотрудника"}
            </Link>
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="text-portal-caption text-portal-danger" role="alert">
          {error}
        </p>
      ) : null}

      {state === "unlinked" ? (
        <div className="space-y-portal-3">
          <p className="text-portal-caption text-portal-muted">{LINK_EFFECT}</p>
          {pickerError ? (
            <InlineAlert tone="danger" size="compact">
              {pickerError}
            </InlineAlert>
          ) : null}
          {mode === "employee" && openAccounts.length === 0 ? (
            <p className="text-portal-caption text-portal-muted">
              Свободных учёток нет. Приглашение не создаёт эту связь.
            </p>
          ) : null}
          {mode === "employee" ? (
            <Field label="Свободная учётная запись" htmlFor="employee-link-account">
              <Select
                id="employee-link-account"
                value={selectedAccountId}
                onChange={(event) => setSelectedAccountId(event.target.value)}
                disabled={pending}
              >
                <option value="">Выберите логин</option>
                {openAccounts.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.login}
                    {row.displayName ? ` · ${row.displayName}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <>
              <Field label="Свободный сотрудник" htmlFor="employee-link-person">
                <Select
                  id="employee-link-person"
                  value={selectedEmployeeId}
                  onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  disabled={pending}
                >
                  <option value="">Выберите сотрудника</option>
                  {openEmployees.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.fullName}
                      {row.isActive ? "" : " (архив)"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Checkbox
                label="Показать архивных сотрудников"
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
                disabled={pending}
              />
            </>
          )}
          <Field label="Причина" htmlFor="employee-link-reason">
            <Textarea
              id="employee-link-reason"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              disabled={pending}
            />
          </Field>
          <Button
            type="button"
            variant="primary"
            disabled={pending}
            data-employee-link-submit
            onClick={() => {
              void submitLink();
            }}
          >
            {pending ? "Сохранение…" : "Привязать"}
          </Button>
        </div>
      ) : null}

      {state === "linked" && account != null ? (
        <div className="space-y-portal-3">
          <p className="text-portal-caption text-portal-muted">{UNLINK_EFFECT}</p>
          <Checkbox
            label="Подтверждаю отвязку"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={pending}
            data-employee-unlink-confirm
          />
          <Field label="Причина" htmlFor="employee-unlink-reason">
            <Textarea
              id="employee-unlink-reason"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              disabled={pending}
            />
          </Field>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            data-employee-unlink-submit
            onClick={() => {
              void submitUnlink();
            }}
          >
            {pending ? "Сохранение…" : "Отвязать"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
