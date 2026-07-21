"use client";

import { Ellipsis, Mail, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import {
  LeadContactDeleteDialog,
  LeadContactDialog,
  communicationChannelOptions,
  type ContactDraft,
  type ContactDialogResult,
} from "@/components/sales/lead-contact-dialog";
import {
  deleteLeadContact,
  saveLeadContact,
} from "@/app/(workspace)/sales/leads/[leadId]/lead-contact-actions";
import { saveLeadCustomerProfile } from "@/app/(workspace)/sales/leads/[leadId]/lead-customer-actions";
import { Button } from "@/components/ui/button";
import { CityAutocomplete } from "@/components/ui/city-autocomplete";
import { InlineEditActions } from "@/components/ui/entity-link";
import {
  getWebsiteHref,
  optionalText,
  validateContactFields,
  validateCustomerFields,
} from "@/lib/sales/lead-customer";
import type {
  CommunicationChannel,
  LeadContact,
  LeadCustomer,
  LeadCustomerType,
} from "@/types/sales";

const fieldClass = "mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const customerTypeLabels: Record<LeadCustomerType, string> = {
  person: "Физическое лицо",
  sole_proprietor: "ИП",
  company: "Организация",
};
const channelLabels = Object.fromEntries(
  communicationChannelOptions.map((option) => [option.value, option.label]),
) as Record<CommunicationChannel, string>;

type CustomerDraft = {
  type: LeadCustomerType | "";
  organizationName: string;
  website: string;
  city: string;
  region: string;
  address: string;
  taxId: string;
  comment: string;
  contactName: string;
  position: string;
  phone: string;
  email: string;
  preferredChannel: CommunicationChannel;
};

type CustomerErrors = Partial<Record<"contactName" | "phone" | "email" | "taxId", string>>;
type DialogState =
  | { kind: "contact"; contact: LeadContact | null }
  | { kind: "delete"; contact: LeadContact }
  | null;

function createDraft(customer: LeadCustomer): CustomerDraft {
  const primary = customer.contacts.find((contact) => contact.isPrimary);
  return {
    type: customer.type ?? "",
    organizationName: customer.organizationName ?? "",
    website: customer.website ?? "",
    city: customer.city ?? "",
    region: customer.region ?? "",
    address: customer.address ?? "",
    taxId: customer.taxId ?? "",
    comment: customer.comment ?? "",
    contactName: primary?.name ?? "",
    position: primary?.position ?? "",
    phone: primary?.phone ?? "",
    email: primary?.email ?? "",
    preferredChannel: primary?.preferredChannel ?? "unspecified",
  };
}

function display(value?: string) {
  return value?.trim() || "Не указано";
}

function createLocalContactId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `lead-contact-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function DataItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  type = "text",
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  type?: "text" | "email" | "tel";
  error?: string;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;
  return (
    <label htmlFor={id} className="text-sm font-medium text-slate-700">
      {label}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? <span id={errorId} className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}

export function LeadCustomerDetails({
  customer,
  leadId,
  contactPersistence,
  onCustomerChange,
  embedded = false,
  compact = false,
}: {
  customer: LeadCustomer;
  leadId: string;
  contactPersistence: "api" | "local";
  onCustomerChange: (customer: LeadCustomer) => void;
  embedded?: boolean;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState<CustomerDraft>(() => createDraft(customer));
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [dialog, setDialog] = useState<DialogState>(null);
  const [notice, setNotice] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const primaryContact = customer.contacts.find((contact) => contact.isPrimary) ?? null;

  function updateDraft<Field extends keyof CustomerDraft>(field: Field, value: CustomerDraft[Field]) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === "contactName" || field === "phone" || field === "email" || field === "taxId") {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  function startEditing() {
    setDraft(createDraft(customer));
    setErrors({});
    setNotice("");
    setEditing(true);
  }

  function cancelEditing() {
    setDraft(createDraft(customer));
    setErrors({});
    setEditing(false);
  }

  function mergePersistedContacts(
    persisted: LeadContact[],
    savedContactId?: string,
    savedMessenger?: string,
  ) {
    return persisted.map((contact) => ({
      ...contact,
      messenger: contact.id === savedContactId
        ? optionalText(savedMessenger ?? "")
        : customer.contacts.find((current) => current.id === contact.id)?.messenger,
    }));
  }

  async function saveCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fieldErrors = validateCustomerFields(draft);
    const contactErrors = validateContactFields({
      name: draft.contactName,
      email: draft.email,
      phone: draft.phone,
    });
    const nextErrors: CustomerErrors = {
      ...fieldErrors,
      contactName: contactErrors.name,
    };
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    const primary = customer.contacts.find((contact) => contact.isPrimary);
    const nextPrimary: LeadContact = {
      id: primary?.id ?? createLocalContactId(),
      name: draft.contactName.trim(),
      position: optionalText(draft.position),
      phone: optionalText(draft.phone),
      email: optionalText(draft.email),
      messenger: primary?.messenger,
      preferredChannel: draft.preferredChannel,
      isPrimary: true,
    };
    const contacts = primary
      ? customer.contacts.map((contact) => contact.id === primary.id
        ? nextPrimary
        : { ...contact, isPrimary: false })
      : [nextPrimary, ...customer.contacts.map((contact) => ({ ...contact, isPrimary: false }))];

    const nextCustomer: LeadCustomer = {
      type: draft.type || undefined,
      organizationName: optionalText(draft.organizationName),
      website: optionalText(draft.website),
      city: optionalText(draft.city),
      region: optionalText(draft.region),
      address: optionalText(draft.address),
      taxId: optionalText(draft.taxId),
      comment: optionalText(draft.comment),
      contacts,
    };

    if (contactPersistence === "api") {
      setSavingCustomer(true);
      setNotice("");
      const profileResult = await saveLeadCustomerProfile(leadId, {
        type: nextCustomer.type,
        organizationName: nextCustomer.organizationName,
        taxId: nextCustomer.taxId,
        website: nextCustomer.website,
        city: nextCustomer.city,
        region: nextCustomer.region,
        address: nextCustomer.address,
        comment: nextCustomer.comment,
      });
      if (!profileResult.ok) {
        setSavingCustomer(false);
        setNotice(profileResult.message);
        return;
      }
      const result = await saveLeadContact(leadId, primary?.id ?? null, {
        name: nextPrimary.name,
        position: nextPrimary.position,
        phone: nextPrimary.phone,
        email: nextPrimary.email,
        preferredChannel: nextPrimary.preferredChannel,
        isPrimary: true,
      });
      setSavingCustomer(false);
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      nextCustomer.type = profileResult.customer.type;
      nextCustomer.organizationName = profileResult.customer.organizationName;
      nextCustomer.taxId = profileResult.customer.taxId;
      nextCustomer.website = profileResult.customer.website;
      nextCustomer.city = profileResult.customer.city;
      nextCustomer.region = profileResult.customer.region;
      nextCustomer.address = profileResult.customer.address;
      nextCustomer.comment = profileResult.customer.comment;
      nextCustomer.contacts = mergePersistedContacts(result.contacts, result.savedContactId, nextPrimary.messenger);
    }

    onCustomerChange(nextCustomer);
    setEditing(false);
    setNotice(contactPersistence === "api"
      ? "Профиль клиента и основной контакт сохранены в backend."
      : "Demo-режим: изменения сохранены только локально.");
  }

  function openDialog(nextDialog: Exclude<DialogState, null>, trigger: HTMLElement) {
    dialogTriggerRef.current = trigger;
    setNotice("");
    setDialog(nextDialog);
  }

  function closeDialog() {
    setDialog(null);
    window.requestAnimationFrame(() => dialogTriggerRef.current?.focus());
  }

  async function saveContact(contactDraft: ContactDraft): Promise<ContactDialogResult> {
    const editingContact = dialog?.kind === "contact" ? dialog.contact : null;
    const makePrimary = contactDraft.isPrimary || customer.contacts.length === 0;
    const contact: LeadContact = {
      id: editingContact?.id ?? createLocalContactId(),
      name: contactDraft.name.trim(),
      position: optionalText(contactDraft.position),
      phone: optionalText(contactDraft.phone),
      email: optionalText(contactDraft.email),
      messenger: optionalText(contactDraft.messenger),
      preferredChannel: contactDraft.preferredChannel,
      isPrimary: makePrimary,
    };
    const contacts = editingContact
      ? customer.contacts.map((item) => {
        if (item.id === editingContact.id) {
          return contact;
        }
        return makePrimary ? { ...item, isPrimary: false } : { ...item };
      })
      : [
        ...customer.contacts.map((item) => makePrimary ? { ...item, isPrimary: false } : { ...item }),
        contact,
      ];

    if (contactPersistence === "api") {
      const result = await saveLeadContact(leadId, editingContact?.id ?? null, {
        name: contact.name,
        position: contact.position,
        phone: contact.phone,
        email: contact.email,
        preferredChannel: contact.preferredChannel,
        isPrimary: makePrimary,
      });
      if (!result.ok) {
        setNotice(result.message);
        return result;
      }
      onCustomerChange({
        ...customer,
        contacts: mergePersistedContacts(result.contacts, result.savedContactId, contact.messenger),
      });
      setNotice(result.message);
      closeDialog();
      return result;
    }

    onCustomerChange({ ...customer, contacts });
    const message = editingContact ? "Контакт обновлён только локально." : "Контакт добавлен только локально.";
    setNotice(`Demo-режим: ${message}`);
    closeDialog();
    return { ok: true, message };
  }

  function requestDelete(contact: LeadContact, trigger: HTMLElement) {
    if (contact.isPrimary) {
      setNotice("Основной контакт нельзя удалить. Сначала назначьте основным другой контакт.");
      return;
    }
    openDialog({ kind: "delete", contact }, trigger);
  }

  async function confirmDelete(): Promise<ContactDialogResult> {
    if (dialog?.kind !== "delete") {
      return { ok: false, message: "Контакт для удаления не выбран." };
    }
    const contactId = dialog.contact.id;
    if (contactPersistence === "api") {
      const result = await deleteLeadContact(leadId, contactId);
      if (!result.ok) {
        setNotice(result.message);
        return result;
      }
      onCustomerChange({ ...customer, contacts: mergePersistedContacts(result.contacts) });
      setNotice(result.message);
      closeDialog();
      return result;
    }

    onCustomerChange({
      ...customer,
      contacts: customer.contacts.filter((contact) => contact.id !== contactId),
    });
    const message = "Контакт удалён только из локального состояния.";
    setNotice(`Demo-режим: ${message}`);
    closeDialog();
    return { ok: true, message };
  }

  const hasCustomerData = Boolean(
    customer.type
    || customer.organizationName
    || customer.website
    || customer.city
    || customer.region
    || customer.address
    || customer.taxId
    || customer.comment
    || customer.contacts.length,
  );

  return (
    <section className={`${embedded ? `min-w-0 ${compact ? "p-3.5" : "p-4 sm:p-5"}` : "min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"} lead-customer-details ${compact ? "lead-compact-details" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-950">{compact ? "A) Основная информация" : "Данные клиента"}</h2>
          {!compact ? <p className="mt-1 text-sm text-slate-500">Сведения о клиенте и контактных лицах лида.</p> : null}
        </div>
        {!editing && hasCustomerData ? (
          <InlineEditActions
            editing={false}
            onEdit={startEditing}
            editLabel="Редактировать"
            disabled={savingCustomer}
          />
        ) : null}
      </div>

      {editing ? (
        <form onSubmit={saveCustomer} className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label htmlFor="customer-type" className="text-sm font-medium text-slate-700">
              Тип клиента
              <select
                id="customer-type"
                value={draft.type}
                onChange={(event) => updateDraft("type", event.target.value as LeadCustomerType | "")}
                className={fieldClass}
              >
                <option value="">Не указано</option>
                {Object.entries(customerTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <TextField id="customer-organization" label="Название организации" value={draft.organizationName} onChange={(value) => updateDraft("organizationName", value)} />
            <TextField id="customer-tax-id" label="ИНН" value={draft.taxId} error={errors.taxId} onChange={(value) => updateDraft("taxId", value)} />
            <TextField id="customer-website" label="Сайт" value={draft.website} onChange={(value) => updateDraft("website", value)} />
            <CityAutocomplete id="customer-city" label="Город" value={draft.city} onChange={(value) => updateDraft("city", value)} inputClassName={fieldClass} />
            <TextField id="customer-region" label="Регион" value={draft.region} onChange={(value) => updateDraft("region", value)} />
            <div className="sm:col-span-2">
              <TextField id="customer-address" label="Адрес" value={draft.address} onChange={(value) => updateDraft("address", value)} />
            </div>
          </div>

          <h3 className="mt-5 border-t border-slate-200 pt-4 text-sm font-semibold text-slate-950">Основной контакт</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <TextField id="customer-contact-name" label="ФИО контактного лица" value={draft.contactName} error={errors.contactName} onChange={(value) => updateDraft("contactName", value)} />
            <TextField id="customer-contact-position" label="Должность" value={draft.position} onChange={(value) => updateDraft("position", value)} />
            <TextField id="customer-contact-phone" label="Телефон" type="tel" value={draft.phone} error={errors.phone} onChange={(value) => updateDraft("phone", value)} />
            <TextField id="customer-contact-email" label="Email" type="email" value={draft.email} error={errors.email} onChange={(value) => updateDraft("email", value)} />
            <label htmlFor="customer-contact-channel" className="text-sm font-medium text-slate-700">
              Предпочтительный канал
              <select
                id="customer-contact-channel"
                value={draft.preferredChannel}
                onChange={(event) => updateDraft("preferredChannel", event.target.value as CommunicationChannel)}
                className={fieldClass}
              >
                {communicationChannelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>

          <label htmlFor="customer-comment" className="mt-5 block text-sm font-medium text-slate-700">
            Комментарий
            <textarea
              id="customer-comment"
              rows={4}
              value={draft.comment}
              onChange={(event) => updateDraft("comment", event.target.value)}
              className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" onClick={cancelEditing} disabled={savingCustomer}>Отмена</Button>
            <Button type="submit" variant="primary" disabled={savingCustomer}>{savingCustomer ? "Сохранение…" : "Сохранить"}</Button>
          </div>
        </form>
      ) : hasCustomerData ? (
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Клиент</h3>
            <dl className="mt-2.5 grid gap-x-5 gap-y-3 sm:grid-cols-2">
              <DataItem label="Тип">{customer.type ? customerTypeLabels[customer.type] : "Не указано"}</DataItem>
              <DataItem label="Организация">{display(customer.organizationName)}</DataItem>
              <DataItem label="ИНН">{display(customer.taxId)}</DataItem>
              <DataItem label="Сайт">
                {customer.website ? <a href={getWebsiteHref(customer.website)} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">{customer.website}</a> : "Не указано"}
              </DataItem>
              <DataItem label="Город">{display(customer.city)}</DataItem>
              <DataItem label="Регион">{display(customer.region)}</DataItem>
              <DataItem label="Адрес">{display(customer.address)}</DataItem>
            </dl>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-950">Основной контакт</h3>
            {primaryContact ? (
              <dl className="mt-2.5 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                <DataItem label="Имя">{display(primaryContact.name)}</DataItem>
                <DataItem label="Должность">{display(primaryContact.position)}</DataItem>
                <DataItem label="Телефон">
                  {primaryContact.phone ? <a href={`tel:${primaryContact.phone}`} className="inline-flex items-center gap-1.5 text-blue-700 hover:underline"><Phone size={14} />{primaryContact.phone}</a> : "Не указано"}
                </DataItem>
                <DataItem label="Email">
                  {primaryContact.email ? <a href={`mailto:${primaryContact.email}`} className="inline-flex items-center gap-1.5 text-blue-700 hover:underline"><Mail size={14} />{primaryContact.email}</a> : "Не указано"}
                </DataItem>
                <DataItem label="Канал связи">{channelLabels[primaryContact.preferredChannel]}</DataItem>
              </dl>
            ) : <p className="mt-3 text-sm text-slate-500">Основной контакт не назначен.</p>}
          </div>

          {!compact ? <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-950">Комментарий</h3>
            <p className="mt-2 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-slate-600">{display(customer.comment)}</p>
          </div> : null}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">Данные клиента пока не заполнены</p>
          <Button type="button" onClick={startEditing} className="mt-4">Добавить данные</Button>
        </div>
      )}

      {!editing ? (
        <details open={!compact} className="mt-4 border-t border-slate-200 pt-3">
          <summary className={`${compact ? "cursor-pointer text-xs font-semibold text-blue-700" : "sr-only"}`}>Дополнительные данные и контакты</summary>
        <div className={compact ? "mt-3" : ""}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Контактные лица</h3>
              <p className="mt-1 text-sm text-slate-500">Дополнительные контакты клиента.</p>
            </div>
            <Button type="button" onClick={(event) => openDialog({ kind: "contact", contact: null }, event.currentTarget)}>
              <Plus size={16} /> Добавить контакт
            </Button>
          </div>

          {customer.contacts.length ? (
            <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
              {customer.contacts.map((contact) => (
                <article key={contact.id} className="lead-contact-row grid min-w-0 gap-2 px-1 py-2.5 text-sm">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="truncate font-semibold text-slate-950">{display(contact.name)}</h4>{contact.isPrimary ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">Основной</span> : null}</div><p className="mt-0.5 truncate text-xs text-slate-500">{display(contact.position)}</p></div>
                  <p className="min-w-0 truncate">{contact.phone ? <a href={`tel:${contact.phone}`} className="text-blue-700 hover:underline">{contact.phone}</a> : <span className="text-slate-500">Телефон не указан</span>}</p>
                  <p className="min-w-0 [overflow-wrap:anywhere]">{contact.email ? <a href={`mailto:${contact.email}`} className="text-blue-700 hover:underline">{contact.email}</a> : <span className="text-slate-500">Email не указан</span>}</p>
                  <div className="min-w-0"><p className="truncate text-slate-600">{channelLabels[contact.preferredChannel]}</p>{contact.messenger ? <p className="truncate text-xs text-slate-500">{contact.messenger}</p> : null}</div>
                  <details className="relative justify-self-start lead-contact-actions">
                    <summary aria-label={`Действия с контактом ${contact.name}`} className="flex size-8 cursor-pointer list-none items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden"><Ellipsis size={17} /></summary>
                    <div className="absolute right-0 z-30 mt-1 w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                      <button type="button" onClick={(event) => openDialog({ kind: "contact", contact }, event.currentTarget)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><Pencil size={14} /> Редактировать</button>
                      <button type="button" onClick={(event) => requestDelete(contact, event.currentTarget)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"><Trash2 size={14} /> Удалить</button>
                    </div>
                  </details>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-7 text-center">
              <p className="text-sm text-slate-500">Контактные лица не добавлены</p>
            </div>
          )}
        </div>
        </details>
      ) : null}

      {notice ? <p className="mt-4 text-sm text-slate-600" role="status" aria-live="polite">{notice}</p> : null}

      {dialog?.kind === "contact" ? (
        <LeadContactDialog contact={dialog.contact} persistent={contactPersistence === "api"} onClose={closeDialog} onSave={saveContact} />
      ) : null}
      {dialog?.kind === "delete" ? (
        <LeadContactDeleteDialog contact={dialog.contact} persistent={contactPersistence === "api"} onCancel={closeDialog} onConfirm={confirmDelete} />
      ) : null}
    </section>
  );
}
