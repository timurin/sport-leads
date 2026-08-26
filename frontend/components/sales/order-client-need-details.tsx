"use client";

import { ExternalLink, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import {
  saveOrderClientNeed,
  type OrderClientNeedInput,
} from "@/app/(workspace)/sales/orders/[orderId]/order-client-need-actions";
import {
  listOrderPartyClients,
  listOrderPartyOrganizations,
  saveOrderClient,
  saveOrderOrganization,
  type PartyOption,
} from "@/app/(workspace)/sales/orders/[orderId]/order-party-actions";
import { Button, IconButton } from "@/components/ui/button";
import { EntityLink } from "@/components/ui/entity-link";
import type { SalesOrderDetails } from "@/lib/sales/order-details";
import { productCategories, sports, leadCreateSourceOptions } from "@/types/sales";

const fieldClass =
  "mt-1 h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

type Draft = {
  clientId: string;
  organizationId: string;
  sport: string;
  productCategory: string;
  quantity: string;
  desiredDate: string;
  source: string;
  description: string;
};

function toDraft(order: SalesOrderDetails): Draft {
  return {
    clientId: order.clientId,
    organizationId: order.organizationId ?? "",
    sport: order.sportValue,
    productCategory: order.productCategoryValue,
    quantity: order.quantityValue,
    desiredDate: order.desiredDateValue,
    source: order.sourceValue,
    description: order.descriptionValue,
  };
}

function display(value: string) {
  return value.trim() || "Не указано";
}

function sourceLabel(value: string) {
  const match = leadCreateSourceOptions.find((option) => option.value === value);
  return match?.label ?? value;
}

function sourceSelectOptions(current: string) {
  const known = new Set<string>(leadCreateSourceOptions.map((option) => option.value));
  if (current.trim() && !known.has(current)) {
    return [...leadCreateSourceOptions, { value: current, label: current }];
  }
  return [...leadCreateSourceOptions];
}

function hasClientNeed(order: SalesOrderDetails) {
  return Boolean(
    order.sportValue.trim()
    || order.productCategoryValue.trim()
    || order.quantityValue.trim()
    || order.desiredDateValue.trim()
    || order.sourceValue.trim()
    || order.descriptionValue.trim(),
  );
}

export function OrderClientNeedDetails({
  order,
  sourceLeadContactName,
  sourceLeadMessageCount,
  className = "",
  compact = false,
  onSaved,
}: {
  order: SalesOrderDetails;
  sourceLeadContactName?: string | null;
  sourceLeadMessageCount?: number;
  className?: string;
  /** Narrow aside layout: no outer SectionCard chrome. */
  compact?: boolean;
  onSaved: (next: SalesOrderDetails) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(order));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [clients, setClients] = useState<PartyOption[]>([]);
  const [organizations, setOrganizations] = useState<PartyOption[]>([]);
  const needFilled = hasClientNeed(order);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    void (async () => {
      const [nextClients, nextOrgs] = await Promise.all([
        listOrderPartyClients(),
        listOrderPartyOrganizations(),
      ]);
      if (!cancelled) {
        setClients(nextClients);
        setOrganizations(nextOrgs);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editing]);

  function startEditing() {
    setDraft(toDraft(order));
    setError("");
    setNotice("");
    setEditing(true);
  }

  function cancel() {
    setDraft(toDraft(order));
    setError("");
    setEditing(false);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const nextClientId = Number(draft.clientId);
    if (!Number.isInteger(nextClientId) || nextClientId <= 0) {
      setError("Выберите клиента.");
      setSaving(false);
      return;
    }

    let current = order;
    if (String(nextClientId) !== order.clientId) {
      const clientResult = await saveOrderClient(order.id, nextClientId);
      if (!clientResult.ok) {
        setError(clientResult.message);
        setSaving(false);
        return;
      }
      current = clientResult.order;
    }

    const nextOrgId = draft.organizationId.trim() ? Number(draft.organizationId) : null;
    const currentOrgId = current.organizationId ? Number(current.organizationId) : null;
    if (nextOrgId !== currentOrgId) {
      if (nextOrgId !== null && !Number.isInteger(nextOrgId)) {
        setError("Некорректная организация.");
        setSaving(false);
        return;
      }
      const orgResult = await saveOrderOrganization(current.id, nextOrgId);
      if (!orgResult.ok) {
        setError(orgResult.message);
        setSaving(false);
        return;
      }
      current = orgResult.order;
    }

    const quantityRaw = draft.quantity.trim();
    let quantity: number | null = null;
    if (quantityRaw) {
      const parsed = Number(quantityRaw);
      if (!Number.isInteger(parsed) || parsed < 0) {
        setError("Количество должно быть целым числом ≥ 0.");
        setSaving(false);
        return;
      }
      quantity = parsed;
    }
    const payload: OrderClientNeedInput = {
      sport: draft.sport.trim() || null,
      productCategory: draft.productCategory.trim() || null,
      quantity,
      desiredDate: draft.desiredDate.trim() || null,
      source: draft.source.trim() || null,
      description: draft.description.trim() || null,
      syncToLead: Boolean(current.leadId),
    };
    const result = await saveOrderClientNeed(current.id, payload);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved(result.order);
    setDraft(toDraft(result.order));
    setEditing(false);
    setNotice(
      current.leadId
        ? "Сведения сохранены; потребность синхронизирована с лидом."
        : "Сведения сохранены.",
    );
  }

  const headerActions = editing ? null : (
    <div className="flex items-center gap-1">
      {needFilled || order.clientName ? (
        <IconButton
          label="Редактировать основные сведения"
          variant="secondary"
          onClick={startEditing}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </IconButton>
      ) : (
        <IconButton
          label="Заполнить основные сведения"
          variant="primary"
          onClick={startEditing}
        >
          <Plus className="size-4" aria-hidden="true" />
        </IconButton>
      )}
    </div>
  );

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Основные сведения</h2>
          <p className="mt-0.5 text-xs text-slate-500">Клиент, организация и потребность</p>
        </div>
        {headerActions}
      </div>

      {editing ? (
        <form className="mt-3 space-y-3" onSubmit={onSubmit}>
          <div className="grid gap-3">
            <label className="min-w-0 text-sm font-medium text-slate-700">
              Клиент
              <select
                className={fieldClass}
                value={draft.clientId}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, clientId: event.target.value }))
                }
                required
              >
                <option value="">Выберите клиента</option>
                {clients.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
                {!clients.some((item) => String(item.id) === draft.clientId) && draft.clientId ? (
                  <option value={draft.clientId}>{order.clientName}</option>
                ) : null}
              </select>
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700">
              Организация
              <select
                className={fieldClass}
                value={draft.organizationId}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, organizationId: event.target.value }))
                }
              >
                <option value="">Не указана</option>
                {organizations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
                {draft.organizationId
                  && !organizations.some((item) => String(item.id) === draft.organizationId) ? (
                  <option value={draft.organizationId}>{order.organizationName}</option>
                ) : null}
              </select>
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700">
              Вид спорта
              <select
                className={fieldClass}
                value={draft.sport}
                onChange={(event) => setDraft((current) => ({ ...current, sport: event.target.value }))}
              >
                <option value="">Не указано</option>
                {sports.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700">
              Категория продукции
              <select
                className={fieldClass}
                value={draft.productCategory}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, productCategory: event.target.value }))
                }
              >
                <option value="">Не указано</option>
                {productCategories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700">
              Дата отгрузки
              <input
                type="date"
                className={fieldClass}
                value={draft.desiredDate}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, desiredDate: event.target.value }))
                }
              />
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700">
              Источник
              <select
                className={fieldClass}
                value={draft.source}
                onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))}
              >
                <option value="">Не указано</option>
                {sourceSelectOptions(draft.source).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700">
              Описание потребности
              <textarea
                rows={3}
                maxLength={3000}
                className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
          </div>
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
            <Button type="button" onClick={cancel} disabled={saving}>
              Отмена
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-3 space-y-3">
          <dl className="grid gap-y-2.5">
            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-500">Клиент</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900">
                <EntityLink href={order.clientHref}>{order.clientName}</EntityLink>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-500">Организация</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900">
                {order.organizationHref ? (
                  <EntityLink href={order.organizationHref}>{order.organizationName}</EntityLink>
                ) : (
                  order.organizationName
                )}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-500">Исходный лид</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900">
                {order.sourceLeadHref ? (
                  <EntityLink href={order.sourceLeadHref} className="inline-flex items-center gap-1">
                    Открыть лид <ExternalLink size={14} aria-hidden="true" />
                  </EntityLink>
                ) : (
                  <span className="text-portal-muted">Без лида</span>
                )}
              </dd>
            </div>
            {sourceLeadContactName ? (
              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-500">Контакт лида</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">
                  {sourceLeadContactName}
                  {sourceLeadMessageCount !== undefined ? ` · ${sourceLeadMessageCount} сообщ.` : ""}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="border-t border-portal-border pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Потребность
            </h3>
            {needFilled ? (
              <dl className="mt-2 grid gap-y-2.5">
                <div>
                  <dt className="text-xs text-slate-500">Спорт</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">{display(order.sportValue)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Категория</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">
                    {display(order.productCategoryValue)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Дата отгрузки</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">{order.desiredDate}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Источник</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">{display(sourceLabel(order.sourceValue))}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Описание</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm font-medium text-slate-900">
                    {display(order.descriptionValue)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Не заполнена — нажмите карандаш.</p>
            )}
          </div>
        </div>
      )}

      {notice ? (
        <p className="mt-3 text-sm text-slate-600" role="status">
          {notice}
        </p>
      ) : null}
    </>
  );

  if (compact) {
    return <div className={`min-w-0 ${className}`}>{body}</div>;
  }

  return (
    <section
      className={`min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-3 shadow-portal-card ${className}`}
    >
      {body}
    </section>
  );
}
