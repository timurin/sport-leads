"use client";

import { useState, useTransition } from "react";

import {
  createClientBankAccount,
  deleteClientBankAccount,
  saveClientRequisites,
  setPrimaryClientBankAccount,
} from "@/app/(workspace)/sales/clients/[clientId]/client-requisites-actions";
import { findClientDuplicates } from "@/app/(workspace)/sales/clients/client-segment-actions";
import { ClientDuplicateWarning } from "@/components/sales/client-segments-section";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SectionCard } from "@/components/ui/section-card";
import {
  emptyBankDraft,
  requisitesToDraft,
  validateBankDraft,
  validateInn,
  validateKpp,
  validateOgrn,
  type ClientBankAccountDraft,
  type ClientRequisitesDraft,
  type ClientRequisitesView,
} from "@/lib/sales/client-requisites";
import {
  duplicateMatchLabel,
  type ClientDuplicateCandidate,
} from "@/lib/sales/client-segments";

type Props = {
  clientId: number;
  requisites: ClientRequisitesView;
  contactName: string;
  companyName: string;
  phone: string;
};

export function ClientLegalSection({
  clientId,
  requisites,
  contactName,
  companyName,
  phone,
}: Props) {
  const [draft, setDraft] = useState<ClientRequisitesDraft>(() =>
    requisitesToDraft(requisites),
  );
  const [bankDraft, setBankDraft] = useState<ClientBankAccountDraft>(emptyBankDraft);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ClientDuplicateCandidate[]>([]);
  const [pending, startTransition] = useTransition();

  const run = (task: () => Promise<{ ok: true } | { ok: false; message: string }>) => {
    startTransition(async () => {
      setError(null);
      const result = await task();
      if (!result.ok) setError(result.message);
    });
  };

  return (
    <SectionCard
      title="Юр. реквизиты"
      description="ИНН, адреса и банковские счета клиента. Пустые поля не заменяются demo-данными."
      size="compact"
    >
      {error ? (
        <InlineAlert tone="danger" size="compact">
          {error}
        </InlineAlert>
      ) : null}
      <ClientDuplicateWarning
        candidates={candidates}
        labels={duplicateMatchLabel}
      />

      <form
        className="grid min-w-0 gap-portal-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const innError = validateInn(draft.inn);
          const kppError = validateKpp(draft.kpp);
          const ogrnError = validateOgrn(draft.ogrn);
          const message = innError ?? kppError ?? ogrnError;
          if (message) {
            setError(message);
            return;
          }
          const phoneValue = phone.trim() === "—" ? "" : phone;
          startTransition(async () => {
            setError(null);
            const dupes = await findClientDuplicates({
              name: companyName || contactName,
              phone: phoneValue,
              inn: draft.inn,
              excludeClientId: clientId,
            });
            if (dupes.ok) setCandidates(dupes.candidates);
            const result = await saveClientRequisites(clientId, draft);
            if (!result.ok) setError(result.message);
          });
        }}
      >
        <Field label="ИНН" htmlFor="client-inn">
          <Input
            id="client-inn"
            value={draft.inn}
            onChange={(event) => setDraft({ ...draft, inn: event.target.value })}
            inputMode="numeric"
          />
        </Field>
        <Field label="КПП" htmlFor="client-kpp">
          <Input
            id="client-kpp"
            value={draft.kpp}
            onChange={(event) => setDraft({ ...draft, kpp: event.target.value })}
            inputMode="numeric"
          />
        </Field>
        <Field label="ОГРН" htmlFor="client-ogrn" className="sm:col-span-2">
          <Input
            id="client-ogrn"
            value={draft.ogrn}
            onChange={(event) => setDraft({ ...draft, ogrn: event.target.value })}
            inputMode="numeric"
          />
        </Field>
        <Field label="Юридический адрес" htmlFor="client-legal" className="sm:col-span-2">
          <Textarea
            id="client-legal"
            rows={2}
            value={draft.legalAddress}
            onChange={(event) =>
              setDraft({ ...draft, legalAddress: event.target.value })
            }
          />
        </Field>
        <Field label="Фактический адрес" htmlFor="client-actual" className="sm:col-span-2">
          <Textarea
            id="client-actual"
            rows={2}
            value={draft.actualAddress}
            onChange={(event) =>
              setDraft({ ...draft, actualAddress: event.target.value })
            }
          />
        </Field>
        <div>
          <Button type="submit" variant="primary" size="compact" disabled={pending}>
            Сохранить реквизиты
          </Button>
        </div>
      </form>

      <div className="mt-portal-5">
        <h3 className="mb-portal-3 text-portal-body font-semibold text-portal-text">
          Банковские счета
        </h3>
        {requisites.bankAccounts.length === 0 ? (
          <EmptyState
            title="Счетов пока нет"
            description="Добавьте расчётный счёт клиента. Список не заполняется demo-данными."
            size="compact"
          />
        ) : (
          <ul className="mb-portal-4 grid gap-portal-2">
            {requisites.bankAccounts.map((account) => (
              <li
                key={account.id}
                className="flex min-w-0 flex-wrap items-center justify-between gap-portal-2 rounded-portal-md border border-portal-border px-portal-3 py-portal-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-portal-text">
                    {account.bankName}
                    {account.isPrimary ? " · основной" : ""}
                  </p>
                  <p className="truncate text-portal-caption text-portal-muted">
                    БИК {account.bik} · {account.accountNumber}
                  </p>
                </div>
                <div className="flex flex-wrap gap-portal-2">
                  {!account.isPrimary ? (
                    <Button
                      type="button"
                      size="compact"
                      disabled={pending}
                      onClick={() =>
                        run(() => setPrimaryClientBankAccount(clientId, account.id))
                      }
                    >
                      Сделать основным
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="danger"
                    size="compact"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm("Удалить счёт?")) return;
                      run(() => deleteClientBankAccount(clientId, account.id));
                    }}
                  >
                    Удалить
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form
          className="grid min-w-0 gap-portal-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const message = validateBankDraft(bankDraft);
            if (message) {
              setError(message);
              return;
            }
            run(async () => {
              const result = await createClientBankAccount(clientId, bankDraft);
              if (result.ok) setBankDraft(emptyBankDraft());
              return result;
            });
          }}
        >
          <Field label="Банк" htmlFor="bank-name" className="sm:col-span-2">
            <Input
              id="bank-name"
              value={bankDraft.bankName}
              onChange={(event) =>
                setBankDraft({ ...bankDraft, bankName: event.target.value })
              }
            />
          </Field>
          <Field label="БИК" htmlFor="bank-bik">
            <Input
              id="bank-bik"
              value={bankDraft.bik}
              onChange={(event) =>
                setBankDraft({ ...bankDraft, bik: event.target.value })
              }
              inputMode="numeric"
            />
          </Field>
          <Field label="Расчётный счёт" htmlFor="bank-account">
            <Input
              id="bank-account"
              value={bankDraft.accountNumber}
              onChange={(event) =>
                setBankDraft({ ...bankDraft, accountNumber: event.target.value })
              }
              inputMode="numeric"
            />
          </Field>
          <Field label="Корр. счёт" htmlFor="bank-corr" className="sm:col-span-2">
            <Input
              id="bank-corr"
              value={bankDraft.corrAccount}
              onChange={(event) =>
                setBankDraft({ ...bankDraft, corrAccount: event.target.value })
              }
              inputMode="numeric"
            />
          </Field>
          <Checkbox
            label="Основной счёт"
            checked={bankDraft.isPrimary}
            onChange={(event) =>
              setBankDraft({ ...bankDraft, isPrimary: event.target.checked })
            }
          />
          <div>
            <Button type="submit" size="compact" disabled={pending}>
              Добавить счёт
            </Button>
          </div>
        </form>
      </div>
    </SectionCard>
  );
}
