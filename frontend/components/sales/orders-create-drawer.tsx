"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  createClientAction,
  createSalesOrderAction,
} from "@/app/(workspace)/sales/orders/order-create-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { controlClassName } from "@/lib/design-system/control-styles";

export type OrderCreateOption = {
  id: number;
  label: string;
};

export type OrderCreateClientOption = OrderCreateOption & {
  organizationId: number | null;
  organizationLabel: string | null;
  responsibleId: number | null;
};

/**
 * Order create drawer (`0.4.2`): client typeahead, optional org, session responsible.
 */
export function OrdersCreateDrawer({
  open,
  onClose,
  clients: initialClients,
  sessionResponsibleId,
  sessionResponsibleLabel,
}: {
  open: boolean;
  onClose: () => void;
  clients: OrderCreateClientOption[];
  sessionResponsibleId: number | null;
  sessionResponsibleLabel: string | null;
}) {
  const router = useRouter();
  const listboxId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState(initialClients);
  const [title, setTitle] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [organizationLabel, setOrganizationLabel] = useState("");
  const [orgMissingMessage, setOrgMissingMessage] = useState(false);
  const [isNewClient, setIsNewClient] = useState(false);
  const [createOrganization, setCreateOrganization] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [ogrn, setOgrn] = useState("");
  const [number, setNumber] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setClients(initialClients);
    }
  }, [open, initialClients]);

  const suggestions = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    return clients
      .filter((item) => item.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [clientQuery, clients]);

  function reset() {
    setError(null);
    setClients(initialClients);
    setTitle("");
    setClientQuery("");
    setSelectedClientId(null);
    setSuggestionsOpen(false);
    setActiveIndex(0);
    setOrganizationId(null);
    setOrganizationLabel("");
    setOrgMissingMessage(false);
    setIsNewClient(false);
    setCreateOrganization(false);
    setOrgName("");
    setTaxId("");
    setOgrn("");
    setNumber("");
    setDescription("");
  }

  function handleClose() {
    if (pending) return;
    reset();
    onClose();
  }

  function selectExistingClient(item: OrderCreateClientOption) {
    setSelectedClientId(item.id);
    setClientQuery(item.label);
    setIsNewClient(false);
    setCreateOrganization(false);
    setSuggestionsOpen(false);
    setOrgName("");
    setTaxId("");
    setOgrn("");
    if (item.organizationId != null) {
      setOrganizationId(item.organizationId);
      setOrganizationLabel(item.organizationLabel ?? `Организация #${item.organizationId}`);
      setOrgMissingMessage(false);
    } else {
      setOrganizationId(null);
      setOrganizationLabel("");
      setOrgMissingMessage(true);
    }
  }

  function onClientQueryChange(value: string) {
    setClientQuery(value);
    setSelectedClientId(null);
    setOrganizationId(null);
    setOrganizationLabel("");
    setOrgMissingMessage(false);
    setSuggestionsOpen(true);
    setActiveIndex(0);

    const exact = clients.find(
      (item) => item.label.toLowerCase() === value.trim().toLowerCase(),
    );
    if (exact) {
      selectExistingClient(exact);
      return;
    }
    if (value.trim()) {
      setIsNewClient(true);
    } else {
      setIsNewClient(false);
      setCreateOrganization(false);
      setOrgName("");
      setTaxId("");
      setOgrn("");
    }
  }

  function onToggleCreateOrganization(checked: boolean) {
    setCreateOrganization(checked);
    if (!checked) {
      setOrgName("");
      setTaxId("");
      setOgrn("");
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (sessionResponsibleId == null) {
      setError(
        "У учётной записи нет связанного сотрудника (SalesUser). Назначьте sales_user_id в настройках пользователя.",
      );
      return;
    }
    if (!title.trim()) {
      setError("Укажите название заказа.");
      return;
    }
    if (!clientQuery.trim()) {
      setError("Укажите клиента.");
      return;
    }
    if (selectedClientId == null && createOrganization && !orgName.trim()) {
      setError("Укажите наименование организации или снимите «Создать организацию?».");
      return;
    }

    startTransition(async () => {
      let resolvedClientId = selectedClientId;
      let resolvedOrganizationId = organizationId;

      if (resolvedClientId == null) {
        const label = clientQuery.trim();
        const created = await createClientAction({
          contact_name: label,
          company_name: label,
          responsible_id: sessionResponsibleId,
          organization_name: createOrganization ? orgName.trim() : null,
          tax_id: createOrganization ? taxId.trim() || null : null,
          ogrn: createOrganization ? ogrn.trim() || null : null,
        });
        if (!created.ok) {
          setError(created.message);
          return;
        }
        resolvedClientId = Number(created.clientId);
        resolvedOrganizationId = createOrganization ? created.organizationId : null;
        setClients((current) => [
          {
            id: resolvedClientId!,
            label: created.label,
            organizationId: resolvedOrganizationId,
            organizationLabel: createOrganization ? orgName.trim() : null,
            responsibleId: created.responsibleId,
          },
          ...current,
        ]);
      }

      const result = await createSalesOrderAction({
        client_id: resolvedClientId,
        organization_id: resolvedOrganizationId,
        responsible_id: sessionResponsibleId,
        title: title.trim(),
        number: number.trim() || null,
        description: description.trim() || null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      reset();
      onClose();
      router.push(`/sales/orders/${result.orderId}`);
      router.refresh();
    });
  }

  const expanded = suggestionsOpen && clientQuery.trim().length > 0 && selectedClientId == null;

  return (
    <CreateDrawer
      open={open}
      title="Создать заказ"
      description="Клиент с подсказками; организация необязательна. Ответственный — из текущей сессии."
      onClose={handleClose}
      variant="overlay"
    >
      <form onSubmit={onSubmit} className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-portal-4 overflow-y-auto p-portal-6">
          {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

          <Field label="Название" required htmlFor="order-create-title">
            <Input
              id="order-create-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              disabled={pending}
              maxLength={255}
            />
          </Field>

          <Field
            label="Клиент"
            required
            htmlFor="order-create-client"
            help="Начните ввод — выберите из списка или создайте нового."
          >
            <div className="relative">
              <input
                id="order-create-client"
                type="text"
                role="combobox"
                autoComplete="off"
                value={clientQuery}
                disabled={pending}
                aria-autocomplete="list"
                aria-expanded={expanded}
                aria-controls={expanded ? listboxId : undefined}
                className={controlClassName()}
                onChange={(event) => onClientQueryChange(event.target.value)}
                onFocus={() => setSuggestionsOpen(true)}
                onBlur={() => setSuggestionsOpen(false)}
                onKeyDown={(event) => {
                  if (!expanded || suggestions.length === 0) return;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((i) => (i + 1) % suggestions.length);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    selectExistingClient(suggestions[Math.min(activeIndex, suggestions.length - 1)]);
                  }
                }}
              />
              {expanded ? (
                <div
                  id={listboxId}
                  role="listbox"
                  className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-portal-border bg-portal-surface p-1 shadow-lg"
                >
                  {suggestions.length > 0 ? (
                    suggestions.map((item, index) => {
                      const active = index === Math.min(activeIndex, suggestions.length - 1);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => selectExistingClient(item)}
                          className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
                            active
                              ? "bg-portal-surface-secondary text-portal-primary"
                              : "text-portal-text hover:bg-portal-surface-secondary"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })
                  ) : (
                    <p className="px-3 py-2 text-xs text-portal-muted">
                      Совпадений нет — будет создан новый клиент.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </Field>

          {isNewClient && selectedClientId == null ? (
            <div className="space-y-portal-3 rounded-portal-md border border-portal-border p-portal-3">
              <Checkbox
                id="order-create-org-toggle"
                label="Создать организацию?"
                checked={createOrganization}
                disabled={pending}
                onChange={(event) => onToggleCreateOrganization(event.target.checked)}
              />
              {createOrganization ? (
                <>
                  <Field
                    label="Организация (наименование)"
                    required
                    htmlFor="order-create-org-name"
                  >
                    <Input
                      id="order-create-org-name"
                      value={orgName}
                      onChange={(event) => setOrgName(event.target.value)}
                      required
                      disabled={pending}
                      maxLength={255}
                    />
                  </Field>
                  <Field label="ИНН" htmlFor="order-create-inn">
                    <Input
                      id="order-create-inn"
                      value={taxId}
                      onChange={(event) => setTaxId(event.target.value)}
                      disabled={pending}
                      maxLength={12}
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label="ОГРН" htmlFor="order-create-ogrn">
                    <Input
                      id="order-create-ogrn"
                      value={ogrn}
                      onChange={(event) => setOgrn(event.target.value)}
                      disabled={pending}
                      maxLength={15}
                      inputMode="numeric"
                    />
                  </Field>
                </>
              ) : (
                <p className="text-portal-caption text-portal-muted">
                  Клиент будет создан без организации.
                </p>
              )}
            </div>
          ) : (
            <Field
              label="Организация"
              htmlFor="order-create-org"
              help="Необязательное поле."
            >
              <Input
                id="order-create-org"
                value={organizationLabel}
                readOnly
                disabled={pending}
                placeholder="—"
              />
              {orgMissingMessage ? (
                <p className="mt-portal-1 text-portal-caption text-portal-danger" role="status">
                  Организация не найдена.
                </p>
              ) : null}
            </Field>
          )}

          <Field label="Ответственный" htmlFor="order-create-resp">
            <Input
              id="order-create-resp"
              value={sessionResponsibleLabel ?? "Не назначен в сессии"}
              readOnly
              disabled
            />
          </Field>

          <Field
            label="Номер заказа"
            htmlFor="order-create-number"
            help="Пусто = авто SO-ГГГГ-######."
          >
            <Input
              id="order-create-number"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              disabled={pending}
              maxLength={50}
              placeholder="Авто"
            />
          </Field>
          <Field label="Описание" htmlFor="order-create-description">
            <Textarea
              id="order-create-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={pending}
              rows={4}
            />
          </Field>
        </div>
        <footer className="flex items-center justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
          <Button type="button" disabled={pending} onClick={handleClose}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Создание…" : "Создать"}
          </Button>
        </footer>
      </form>
    </CreateDrawer>
  );
}
