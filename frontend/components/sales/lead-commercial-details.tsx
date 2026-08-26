"use client";

import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";

import { saveLeadCommercialDetails } from "@/app/(workspace)/sales/leads/[leadId]/lead-commercial-actions";
import { LeadCardCustomFields } from "@/components/sales/lead-card-custom-fields";
import { Button, IconButton } from "@/components/ui/button";
import { CityAutocomplete } from "@/components/ui/city-autocomplete";
import {
  formatCommercialDate,
  formatCurrency,
  formatQuantity,
  parseNonNegativeNumber,
  parsePercent,
  parsePositiveInteger,
  validateCommercialDates,
} from "@/lib/sales/lead-commercial";
import {
  deliveryMethods,
  leadDirections,
  productCategories,
  sports,
  type LeadCommercialDetailsData,
  type Priority,
} from "@/types/sales";
import type { LeadCardField, LeadCardFieldBlock } from "@/lib/sales/lead-card-fields";

const fieldClass = "mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const priorityOptions: ReadonlyArray<{ value: Priority; label: string }> = [
  { value: "low", label: "Низкий" },
  { value: "medium", label: "Средний" },
  { value: "high", label: "Высокий" },
  { value: "urgent", label: "Срочный" },
];
const priorityLabels = Object.fromEntries(priorityOptions.map((option) => [option.value, option.label])) as Record<Priority, string>;
const priorityClasses: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-50 text-amber-800",
  high: "bg-orange-50 text-orange-800",
  urgent: "bg-red-50 text-red-700",
};

type CommercialDraft = {
  direction: string;
  sport: string;
  productCategory: string;
  needDescription: string;
  estimatedQuantity: string;
  preliminaryBudget: string;
  estimatedAmount: string;
  discountPercent: string;
  probability: string;
  plannedOrderDate: string;
  desiredReadyDate: string;
  deliveryCity: string;
  deliveryAddress: string;
  deliveryMethod: string;
  deliveryComment: string;
  source: string;
  campaign: string;
  utmDescription: string;
  priority: string;
};

type CommercialErrors = Partial<Record<
  "estimatedQuantity" | "preliminaryBudget" | "estimatedAmount" | "discountPercent" | "probability",
  string
>>;

type CompactSection = "interest" | "delivery" | "metrics";

type LeadCommercialChange = {
  commercial: LeadCommercialDetailsData;
  source: string | null;
  estimatedAmount: number | null;
  probability: number | null;
};

function optionalText(value: string) {
  return value.trim() || undefined;
}

function productSummary(commercial: LeadCommercialDetailsData, includeQuantity = false, skipSport = false) {
  const parts = [commercial.productCategory, skipSport ? undefined : commercial.sport, commercial.productType]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));
  let summary = "";
  if (parts.length > 0) {
    summary = parts.join(" · ");
  } else {
    const need = commercial.needDescription?.trim();
    if (need) {
      summary = need.split("\n")[0]!.slice(0, 80);
    }
  }
  if (includeQuantity && commercial.estimatedQuantity) {
    const qty = `${commercial.estimatedQuantity} шт`;
    summary = summary ? `${summary} · ${qty}` : qty;
  }
  return summary;
}

function createDraft(
  commercial: LeadCommercialDetailsData,
  source: string | null,
  probability: number | null,
  estimatedAmount: number | null,
): CommercialDraft {
  return {
    direction: commercial.direction ?? "",
    sport: commercial.sport ?? "",
    productCategory: commercial.productCategory ?? "",
    needDescription: commercial.needDescription ?? "",
    estimatedQuantity: commercial.estimatedQuantity?.toString() ?? "",
    preliminaryBudget: commercial.preliminaryBudget?.toString() ?? "",
    estimatedAmount: estimatedAmount?.toString() ?? "",
    discountPercent: commercial.discountPercent?.toString() ?? "",
    probability: probability?.toString() ?? "",
    plannedOrderDate: commercial.plannedOrderDate ?? "",
    desiredReadyDate: commercial.desiredReadyDate ?? "",
    deliveryCity: commercial.deliveryCity ?? "",
    deliveryAddress: commercial.deliveryAddress ?? "",
    deliveryMethod: commercial.deliveryMethod ?? "",
    deliveryComment: commercial.deliveryComment ?? "",
    source: source ?? "",
    campaign: commercial.campaign ?? "",
    utmDescription: commercial.utmDescription ?? "",
    priority: commercial.priority ?? "",
  };
}

function display(value?: string | null) {
  return value?.trim() || "Не указано";
}

function DataItem({ label, children, emphasized = false }: { label: string; children: React.ReactNode; emphasized?: boolean }) {
  return (
    <div className="lead-detail-pair min-w-0">
      <dt className="min-w-0 text-xs font-normal text-slate-500">{label}</dt>
      <dd className={`mt-1 min-w-0 break-normal font-normal leading-snug ${emphasized ? "text-sm text-slate-900" : "text-sm text-slate-800"}`}>{children}</dd>
    </div>
  );
}

function FormSection({ title, children, stacked = false }: { title: string; children: React.ReactNode; stacked?: boolean }) {
  return (
    <fieldset className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
      <legend className="mb-3 text-sm font-semibold text-slate-950">{title}</legend>
      <div className={`grid min-w-0 gap-3 ${stacked ? "" : "sm:grid-cols-2"}`}>{children}</div>
    </fieldset>
  );
}

function TextField({ id, label, value, type = "text", min, max, step, error, onChange }: {
  id: string;
  label: string;
  value: string;
  type?: "text" | "date" | "number";
  min?: number;
  max?: number;
  step?: number;
  error?: string;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;
  return (
    <label htmlFor={id} className="min-w-0 text-sm font-medium text-slate-700">
      {label}
      <input
        id={id}
        type={type}
        min={min}
        max={max}
        step={step}
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

function SelectField({ id, label, value, options, onChange }: {
  id: string;
  label: string;
  value: string;
  options: ReadonlyArray<string | { value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="min-w-0 text-sm font-medium text-slate-700">
      {label}
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass}>
        <option value="">Не указано</option>
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          const label = typeof option === "string" ? option : option.label;
          return <option key={value} value={value}>{label}</option>;
        })}
      </select>
    </label>
  );
}

export function LeadCommercialDetails({
  commercial,
  source,
  estimatedAmount,
  probability,
  leadId,
  persistence,
  onChange,
  embedded = false,
  compact = false,
  hideQuantity = true,
  nextContactLabel,
  cardFields = [],
  canManageCardFields = false,
  onAddCardField,
  onDeleteCardField,
  onCardFieldValueChange,
  onPersistCardFields,
}: {
  commercial: LeadCommercialDetailsData;
  source: string | null;
  estimatedAmount: number | null;
  probability: number | null;
  leadId: string;
  persistence: "api" | "local";
  onChange: (change: LeadCommercialChange) => void;
  embedded?: boolean;
  compact?: boolean;
  hideQuantity?: boolean;
  nextContactLabel?: string;
  cardFields?: LeadCardField[];
  canManageCardFields?: boolean;
  onAddCardField?: (block: LeadCardFieldBlock, label: string) => Promise<void> | void;
  onDeleteCardField?: (id: number) => Promise<void> | void;
  onCardFieldValueChange?: (id: number, value: string) => void;
  onPersistCardFields?: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [editingSection, setEditingSection] = useState<CompactSection | null>(null);
  const [draft, setDraft] = useState(() => createDraft(commercial, source, probability, estimatedAmount));
  const [errors, setErrors] = useState<CommercialErrors>({});
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateDraft(field: keyof CommercialDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice("");
    setSaveError("");
  }

  function startEditing() {
    setDraft(createDraft(commercial, source, probability, estimatedAmount));
    setErrors({});
    setNotice("");
    setSaveError("");
    setEditing(true);
  }

  function cancelEditing() {
    setDraft(createDraft(commercial, source, probability, estimatedAmount));
    setErrors({});
    setSaveError("");
    setEditing(false);
  }

  function startSectionEditing(section: CompactSection) {
    setDraft(createDraft(commercial, source, probability, estimatedAmount));
    setErrors({});
    setNotice("");
    setSaveError("");
    setEditingSection(section);
  }

  function cancelSectionEditing() {
    setDraft(createDraft(commercial, source, probability, estimatedAmount));
    setErrors({});
    setSaveError("");
    setEditingSection(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const estimatedQuantity = hideQuantity
      ? { value: commercial.estimatedQuantity, error: undefined }
      : parsePositiveInteger(draft.estimatedQuantity);
    const preliminaryBudget = parseNonNegativeNumber(draft.preliminaryBudget);
    const nextAmount = parseNonNegativeNumber(draft.estimatedAmount);
    const discountPercent = parsePercent(draft.discountPercent);
    const nextProbability = parsePercent(draft.probability);
    const nextErrors: CommercialErrors = {
      estimatedQuantity: estimatedQuantity.error,
      preliminaryBudget: compact ? undefined : preliminaryBudget.error,
      estimatedAmount: nextAmount.error,
      discountPercent: discountPercent.error,
      probability: nextProbability.error,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setSaveError("");
    const dateError = validateCommercialDates(draft.plannedOrderDate, draft.desiredReadyDate);
    if (dateError) {
      setSaveError(dateError);
      return;
    }

    // Preserve hidden SoT fields (`20.1`) except desiredReadyDate (Дата отгрузки, `26.1.4`).
    let change: LeadCommercialChange = {
      source: draft.source.trim() || null,
      estimatedAmount: nextAmount.value ?? null,
      probability: nextProbability.value ?? null,
      commercial: {
        direction: draft.direction ? draft.direction as LeadCommercialDetailsData["direction"] : undefined,
        sport: draft.sport ? draft.sport as LeadCommercialDetailsData["sport"] : undefined,
        productCategory: draft.productCategory ? draft.productCategory as LeadCommercialDetailsData["productCategory"] : undefined,
        productType: commercial.productType,
        needDescription: optionalText(draft.needDescription),
        estimatedQuantity: hideQuantity ? commercial.estimatedQuantity : estimatedQuantity.value,
        kitQuantity: commercial.kitQuantity,
        sizeComment: commercial.sizeComment,
        preliminaryBudget: compact ? commercial.preliminaryBudget : preliminaryBudget.value,
        discountPercent: discountPercent.value,
        plannedOrderDate: optionalText(draft.plannedOrderDate),
        desiredReadyDate: optionalText(draft.desiredReadyDate),
        eventDate: commercial.eventDate,
        deliveryCity: optionalText(draft.deliveryCity),
        deliveryAddress: optionalText(draft.deliveryAddress),
        deliveryMethod: draft.deliveryMethod ? draft.deliveryMethod as LeadCommercialDetailsData["deliveryMethod"] : undefined,
        deliveryComment: optionalText(draft.deliveryComment),
        campaign: optionalText(draft.campaign),
        utmDescription: optionalText(draft.utmDescription),
        priority: draft.priority ? draft.priority as Priority : undefined,
      },
    };

    if (persistence === "api") {
      setSaving(true);
      setSaveError("");
      const result = await saveLeadCommercialDetails(leadId, {
        source: change.source,
        direction: change.commercial.direction,
        sport: change.commercial.sport,
        productCategory: change.commercial.productCategory,
        needDescription: change.commercial.needDescription,
        estimatedQuantity: change.commercial.estimatedQuantity,
        preliminaryBudget: change.commercial.preliminaryBudget ?? null,
        estimatedAmount: change.estimatedAmount,
        discountPercent: change.commercial.discountPercent ?? null,
        probability: change.probability,
        plannedOrderDate: change.commercial.plannedOrderDate,
        desiredReadyDate: change.commercial.desiredReadyDate,
        deliveryCity: change.commercial.deliveryCity,
        deliveryAddress: change.commercial.deliveryAddress,
        deliveryMethod: change.commercial.deliveryMethod,
        deliveryComment: change.commercial.deliveryComment,
        campaign: change.commercial.campaign,
        utmDescription: change.commercial.utmDescription,
        priority: change.commercial.priority,
      });
      setSaving(false);
      if (!result.ok) {
        setSaveError(result.message);
        return;
      }
      change = {
        ...change,
        source: result.persisted.source,
        estimatedAmount: result.persisted.estimatedAmount,
        probability: result.persisted.probability,
        commercial: { ...result.persisted.commercial },
      };
    }

    onChange(change);
    setEditing(false);
    setEditingSection(null);
    if (onPersistCardFields) {
      await onPersistCardFields();
    }
    setNotice(persistence === "api"
      ? "Коммерческие параметры сохранены в backend."
      : "Demo-режим: коммерческие параметры сохранены только локально.");
  }

  const hasData = Boolean(
    Object.values(commercial).some((value) => value !== undefined && value !== "")
    || source
    || estimatedAmount !== null
    || probability !== null,
  );

  const customFieldHandlers = {
    onAdd: onAddCardField ?? (async () => undefined),
    onDelete: onDeleteCardField ?? (async () => undefined),
    onValueChange: onCardFieldValueChange ?? (() => undefined),
  };

  function compactChrome(title: string, section: CompactSection, formId: string) {
    const sectionEditing = editingSection === section;
    return (
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-medium tracking-normal text-slate-900">{title}</h2>
        <div className="flex shrink-0 items-center gap-0.5">
          {sectionEditing ? (
            <>
              <IconButton type="button" label="Отмена" onClick={cancelSectionEditing} disabled={saving}>
                <X size={16} aria-hidden="true" />
              </IconButton>
              <IconButton type="submit" form={formId} label="Сохранить" disabled={saving}>
                <Check size={16} aria-hidden="true" />
              </IconButton>
            </>
          ) : (
            <IconButton type="button" label="Редактировать" onClick={() => startSectionEditing(section)}>
              <Pencil size={16} aria-hidden="true" />
            </IconButton>
          )}
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <section className="lead-commercial-details lead-compact-details min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface p-4 shadow-portal-card">
          {compactChrome("Интерес", "interest", "lead-interest-form")}
          {editingSection === "interest" ? (
            <form id="lead-interest-form" onSubmit={save} className="grid gap-3">
              <SelectField id="compact-direction" label="Направление" value={draft.direction} options={leadDirections} onChange={(value) => updateDraft("direction", value)} />
              <SelectField id="compact-category" label="Категория продукции" value={draft.productCategory} options={productCategories} onChange={(value) => updateDraft("productCategory", value)} />
              <label htmlFor="compact-notes" className="min-w-0 text-sm font-medium text-slate-700">
                Заметки о клиенте
                <textarea id="compact-notes" rows={2} maxLength={3000} value={draft.needDescription} onChange={(event) => updateDraft("needDescription", event.target.value)} className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </label>
              <TextField id="compact-amount" label="Сумма, ₽" type="number" min={0} step={0.01} value={draft.estimatedAmount} error={errors.estimatedAmount} onChange={(value) => updateDraft("estimatedAmount", value)} />
              <TextField id="compact-production-date" label="Дата входа в производство" type="date" value={draft.plannedOrderDate} onChange={(value) => updateDraft("plannedOrderDate", value)} />
              <TextField id="compact-ship-date" label="Дата отгрузки" type="date" value={draft.desiredReadyDate} onChange={(value) => updateDraft("desiredReadyDate", value)} />
              <LeadCardCustomFields block="interest" fields={cardFields} editing canManage={canManageCardFields} {...customFieldHandlers} />
              {saveError ? <p className="text-sm text-red-700" role="alert">{saveError}</p> : null}
            </form>
          ) : (
            <>
              <dl className="lead-fact-kv">
                <DataItem label="Направление">{display(commercial.direction)}</DataItem>
                <DataItem label="Категория продукции">{display(commercial.productCategory)}</DataItem>
                <DataItem label="Заметки о клиенте">{display(commercial.needDescription)}</DataItem>
                <DataItem label="Сумма" emphasized>{formatCurrency(estimatedAmount)}</DataItem>
                <DataItem label="Дата входа в производство">{formatCommercialDate(commercial.plannedOrderDate)}</DataItem>
                <DataItem label="Дата отгрузки">{formatCommercialDate(commercial.desiredReadyDate)}</DataItem>
                <DataItem label="Изделие">{display(productSummary(commercial, !hideQuantity, true))}</DataItem>
                <DataItem label="Следующий контакт">{nextContactLabel ?? "не запланирован"}</DataItem>
              </dl>
              <div className="mt-3">
                <LeadCardCustomFields block="interest" fields={cardFields} editing={false} canManage={canManageCardFields} {...customFieldHandlers} />
              </div>
            </>
          )}
        </section>

        <section className="lead-commercial-details lead-compact-details min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface p-4 shadow-portal-card">
          {compactChrome("Доставка", "delivery", "lead-delivery-form")}
          {editingSection === "delivery" ? (
            <form id="lead-delivery-form" onSubmit={save} className="grid gap-3">
              <CityAutocomplete id="compact-delivery-city" label="Город доставки" value={draft.deliveryCity} onChange={(value) => updateDraft("deliveryCity", value)} className="min-w-0" inputClassName={fieldClass} />
              <TextField id="compact-delivery-address" label="Адрес доставки" value={draft.deliveryAddress} onChange={(value) => updateDraft("deliveryAddress", value)} />
              <SelectField id="compact-delivery-method" label="Способ доставки" value={draft.deliveryMethod} options={deliveryMethods} onChange={(value) => updateDraft("deliveryMethod", value)} />
              <TextField id="compact-delivery-comment" label="Комментарий по доставке" value={draft.deliveryComment} onChange={(value) => updateDraft("deliveryComment", value)} />
              <LeadCardCustomFields block="delivery" fields={cardFields} editing canManage={canManageCardFields} {...customFieldHandlers} />
              {saveError ? <p className="text-sm text-red-700" role="alert">{saveError}</p> : null}
            </form>
          ) : (
            <>
              <dl className="lead-fact-kv">
                <DataItem label="Город">{display(commercial.deliveryCity)}</DataItem>
                <DataItem label="Способ">{display(commercial.deliveryMethod)}</DataItem>
                <DataItem label="Адрес">{display(commercial.deliveryAddress)}</DataItem>
                <DataItem label="Комментарий">{display(commercial.deliveryComment)}</DataItem>
              </dl>
              <div className="mt-3">
                <LeadCardCustomFields block="delivery" fields={cardFields} editing={false} canManage={canManageCardFields} {...customFieldHandlers} />
              </div>
            </>
          )}
        </section>

        <section className="lead-commercial-details lead-compact-details min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface p-4 shadow-portal-card">
          {compactChrome("Метрики", "metrics", "lead-metrics-form")}
          {editingSection === "metrics" ? (
            <form id="lead-metrics-form" onSubmit={save} className="grid gap-3">
              <TextField id="compact-source" label="Источник лида" value={draft.source} onChange={(value) => updateDraft("source", value)} />
              <TextField id="compact-campaign" label="Рекламная кампания" value={draft.campaign} onChange={(value) => updateDraft("campaign", value)} />
              <SelectField id="compact-priority" label="Приоритет" value={draft.priority} options={priorityOptions} onChange={(value) => updateDraft("priority", value)} />
              <TextField id="compact-utm" label="Метка или UTM-описание" value={draft.utmDescription} onChange={(value) => updateDraft("utmDescription", value)} />
              <LeadCardCustomFields block="metrics" fields={cardFields} editing canManage={canManageCardFields} {...customFieldHandlers} />
              {saveError ? <p className="text-sm text-red-700" role="alert">{saveError}</p> : null}
            </form>
          ) : (
            <>
              <dl className="lead-fact-kv">
                <DataItem label="Источник">{display(source)}</DataItem>
                <DataItem label="Кампания">{display(commercial.campaign)}</DataItem>
                <DataItem label="UTM-описание">{display(commercial.utmDescription)}</DataItem>
                <DataItem label="Приоритет">{commercial.priority ? <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClasses[commercial.priority]}`}>{priorityLabels[commercial.priority]}</span> : "Не указано"}</DataItem>
              </dl>
              <div className="mt-3">
                <LeadCardCustomFields block="metrics" fields={cardFields} editing={false} canManage={canManageCardFields} {...customFieldHandlers} />
              </div>
            </>
          )}
        </section>
        {notice ? <p className="text-sm text-slate-600" role="status" aria-live="polite">{notice}</p> : null}
      </div>
    );
  }

  return (
    <section className={`${embedded ? `min-w-0 ${compact ? "p-4" : "p-4 sm:p-5"}` : "min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"} lead-commercial-details ${compact ? "lead-compact-details" : ""}`}>
      <div className={`flex ${compact ? "mb-3.5 items-center justify-between gap-3" : "flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"}`}>
        {compact ? (
          <h2 className="text-[15px] font-bold tracking-tight text-slate-950">Интерес</h2>
        ) : (
        <div>
          <h2 className="text-sm font-bold text-slate-950">Коммерческие параметры</h2>
          <p className="mt-1 text-sm text-slate-500">Потребность клиента и предварительные условия будущего заказа.</p>
        </div>
        )}
        {compact ? (
          <div className="flex shrink-0 items-center gap-0.5">
            {editing ? (
              <>
                <IconButton type="button" label="Отмена" onClick={cancelEditing} disabled={saving}>
                  <X size={16} aria-hidden="true" />
                </IconButton>
                <IconButton type="submit" form="lead-commercial-form" label="Сохранить" disabled={saving}>
                  <Check size={16} aria-hidden="true" />
                </IconButton>
              </>
            ) : (
              <IconButton type="button" label="Редактировать" onClick={startEditing}>
                <Pencil size={16} aria-hidden="true" />
              </IconButton>
            )}
          </div>
        ) : !editing && hasData ? (
          <Button type="button" onClick={startEditing}>Редактировать</Button>
        ) : null}
      </div>

      {editing ? (
        <form id="lead-commercial-form" onSubmit={save} className="mt-4 space-y-5">
          <FormSection title="Классификация потребности" stacked={compact}>
            <SelectField id="commercial-direction" label="Направление" value={draft.direction} options={leadDirections} onChange={(value) => updateDraft("direction", value)} />
            <SelectField id="commercial-sport" label="Вид спорта" value={draft.sport} options={sports} onChange={(value) => updateDraft("sport", value)} />
            <SelectField id="commercial-category" label="Категория продукции" value={draft.productCategory} options={productCategories} onChange={(value) => updateDraft("productCategory", value)} />
            <label htmlFor="commercial-description" className="min-w-0 text-sm font-medium text-slate-700 sm:col-span-2">
              Описание потребности
              <textarea id="commercial-description" rows={4} maxLength={3000} value={draft.needDescription} onChange={(event) => updateDraft("needDescription", event.target.value)} className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              <span className="mt-1 block text-right text-xs text-slate-500">{draft.needDescription.length} / 3000</span>
            </label>
          </FormSection>

          <FormSection title={hideQuantity ? "Сумма" : "Количество и бюджет"} stacked={compact}>
            {hideQuantity ? null : (
            <TextField id="commercial-quantity" label="Количество изделий" type="number" min={1} step={1} value={draft.estimatedQuantity} error={errors.estimatedQuantity} onChange={(value) => updateDraft("estimatedQuantity", value)} />
            )}
            <TextField id="commercial-amount" label="Сумма, ₽" type="number" min={0} step={0.01} value={draft.estimatedAmount} error={errors.estimatedAmount} onChange={(value) => updateDraft("estimatedAmount", value)} />
            {compact ? null : (
            <TextField id="commercial-budget" label="Предварительный бюджет, ₽" type="number" min={0} step={0.01} value={draft.preliminaryBudget} error={errors.preliminaryBudget} onChange={(value) => updateDraft("preliminaryBudget", value)} />
            )}
            <TextField id="commercial-discount" label="Скидка, %" type="number" min={0} max={100} step={0.01} value={draft.discountPercent} error={errors.discountPercent} onChange={(value) => updateDraft("discountPercent", value)} />
            <TextField id="commercial-probability" label="Вероятность сделки, %" type="number" min={0} max={100} step={0.01} value={draft.probability} error={errors.probability} onChange={(value) => updateDraft("probability", value)} />
          </FormSection>

          <FormSection title="Сроки" stacked={compact}>
            <TextField id="commercial-order-date" label="Дата входа в производство" type="date" value={draft.plannedOrderDate} onChange={(value) => updateDraft("plannedOrderDate", value)} />
            <TextField id="commercial-ship-date" label="Дата отгрузки" type="date" value={draft.desiredReadyDate} onChange={(value) => updateDraft("desiredReadyDate", value)} />
          </FormSection>

          <FormSection title="Доставка" stacked={compact}>
            <CityAutocomplete id="commercial-delivery-city" label="Город доставки" value={draft.deliveryCity} onChange={(value) => updateDraft("deliveryCity", value)} className="min-w-0" inputClassName={fieldClass} />
            <TextField id="commercial-delivery-address" label="Адрес доставки" value={draft.deliveryAddress} onChange={(value) => updateDraft("deliveryAddress", value)} />
            <SelectField id="commercial-delivery-method" label="Способ доставки" value={draft.deliveryMethod} options={deliveryMethods} onChange={(value) => updateDraft("deliveryMethod", value)} />
            <div className="sm:col-span-2"><TextField id="commercial-delivery-comment" label="Комментарий по доставке" value={draft.deliveryComment} onChange={(value) => updateDraft("deliveryComment", value)} /></div>
          </FormSection>

          <FormSection title="Источник и приоритет" stacked={compact}>
            {compact ? null : (
            <TextField id="commercial-source" label="Источник лида" value={draft.source} onChange={(value) => updateDraft("source", value)} />
            )}
            <TextField id="commercial-campaign" label="Рекламная кампания" value={draft.campaign} onChange={(value) => updateDraft("campaign", value)} />
            <SelectField id="commercial-priority" label="Приоритет" value={draft.priority} options={priorityOptions} onChange={(value) => updateDraft("priority", value)} />
            <div className="sm:col-span-2"><TextField id="commercial-utm" label="Метка или UTM-описание" value={draft.utmDescription} onChange={(value) => updateDraft("utmDescription", value)} /></div>
          </FormSection>

          {persistence === "api" ? (
            <p className="text-xs text-slate-500">Backend сохраняет направление, спорт, категорию, описание, количество, сумму лида, бюджет, скидку, вероятность, дату входа в производство, дату отгрузки, доставку, источник и приоритет. Скрытые поля потребности (тип/комплекты/размеры/дата мероприятия) не перезаписываются.</p>
          ) : null}
          {saveError ? <p className="text-sm text-red-700" role="alert">{saveError}</p> : null}

          {compact ? null : (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" onClick={cancelEditing} disabled={saving}>Отмена</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
          </div>
          )}
        </form>
      ) : hasData ? (
        <div className={`${compact ? "" : "mt-4 space-y-3"}`}>
          {compact ? (
            <dl className="lead-fact-kv">
              <DataItem label="Сумма" emphasized>{formatCurrency(estimatedAmount)}</DataItem>
              <DataItem label="Изделие">{display(productSummary(commercial, !hideQuantity))}</DataItem>
              <DataItem label="Следующий контакт">{nextContactLabel ?? "не запланирован"}</DataItem>
            </dl>
          ) : (
            <>
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Потребность</h3>
            <dl className="mt-2.5 grid gap-x-5 gap-y-3 sm:grid-cols-2">
              <DataItem label="Направление">{display(commercial.direction)}</DataItem>
              <DataItem label="Вид спорта">{display(commercial.sport)}</DataItem>
              <DataItem label="Категория">{display(commercial.productCategory)}</DataItem>
              {hideQuantity ? null : (
              <DataItem label="Количество изделий">{formatQuantity(commercial.estimatedQuantity)}</DataItem>
              )}
            </dl>
          </div>
          <div className="border-t border-slate-200 pt-3">
            <h3 className="text-sm font-semibold text-slate-950">Финансовые параметры</h3>
            <dl className="mt-2.5 grid gap-x-5 gap-y-3 sm:grid-cols-2">
              <DataItem label="Сумма" emphasized>{formatCurrency(estimatedAmount)}</DataItem>
              <DataItem label="Предварительный бюджет" emphasized>{formatCurrency(commercial.preliminaryBudget)}</DataItem>
              <DataItem label="Скидка" emphasized>{commercial.discountPercent === undefined ? "Не указано" : `${commercial.discountPercent}%`}</DataItem>
              <DataItem label="Вероятность" emphasized>{probability === null ? "Не указано" : `${probability}%`}</DataItem>
            </dl>
          </div>
            </>
          )}
          {compact ? null : (
          <details open className="border-t border-slate-200 pt-3">
            <summary className="sr-only">Дополнительно</summary>
          <div className="grid gap-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Сроки</h3>
              <dl className="mt-3 grid gap-3">
                <DataItem label="Дата входа в производство">{formatCommercialDate(commercial.plannedOrderDate)}</DataItem>
                <DataItem label="Дата отгрузки">{formatCommercialDate(commercial.desiredReadyDate)}</DataItem>
              </dl>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Доставка</h3>
              <dl className="lead-commercial-extra-grid mt-3 grid gap-x-5 gap-y-3">
                <DataItem label="Город">{display(commercial.deliveryCity)}</DataItem>
                <DataItem label="Способ">{display(commercial.deliveryMethod)}</DataItem>
                <div className="lead-commercial-extra-span"><DataItem label="Адрес">{display(commercial.deliveryAddress)}</DataItem></div>
                <div className="lead-commercial-extra-span"><DataItem label="Комментарий">{display(commercial.deliveryComment)}</DataItem></div>
              </dl>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-950">Источник и приоритет</h3>
            <dl className="mt-2.5 grid gap-x-5 gap-y-3 sm:grid-cols-2">
              <DataItem label="Источник">{display(source)}</DataItem>
              <DataItem label="Кампания">{display(commercial.campaign)}</DataItem>
              <DataItem label="UTM-описание">{display(commercial.utmDescription)}</DataItem>
              <DataItem label="Приоритет">{commercial.priority ? <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClasses[commercial.priority]}`}>{priorityLabels[commercial.priority]}</span> : "Не указано"}</DataItem>
            </dl>
          </div>
          </details>
          )}
          {compact ? null : (
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-950">Описание потребности</h3>
            <p className="mt-2 max-w-5xl whitespace-pre-wrap text-sm leading-6 text-slate-600">{display(commercial.needDescription)}</p>
          </div>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">Коммерческие параметры пока не заполнены</p>
          <Button type="button" onClick={startEditing} className="mt-4">Добавить параметры</Button>
        </div>
      )}

      {notice ? <p className="mt-4 text-sm text-slate-600" role="status" aria-live="polite">{notice}</p> : null}
    </section>
  );
}
