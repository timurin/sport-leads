"use client";

import { Pencil, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";

import {
  listTechnicalCardClientCandidates,
  listTechnicalCardResponsibleCandidates,
  updateTechnicalCardClientAction,
  updateTechnicalCardDesiredDateAction,
  updateTechnicalCardOrderNumberAction,
  updateTechnicalCardResponsibleAction,
  type TechnicalCardClientCandidate,
  type TechnicalCardResponsibleCandidate,
} from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { StandaloneTechCardLinkPanel } from "@/components/production/standalone-tech-card-link-panel";
import { ClientCreateDrawer } from "@/components/sales/client-create-drawer";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SectionCard } from "@/components/ui/section-card";
import { controlClassName } from "@/lib/design-system/control-styles";
import {
  MONTH_LABELS_RU,
  WEEKDAY_LABELS_RU,
  monthGrid,
  parseIsoDate,
  toIsoDate,
  yearOptions,
} from "@/lib/production/tech-card-due-date";
import { formatDesiredDate } from "@/lib/production/tech-cards";
import type { ApiTechnicalCard } from "@/lib/sales/order-tech-cards-api";

type TechCardOrderDataCardProps = {
  card: ApiTechnicalCard;
  documentNumber: string;
  disabled?: boolean;
};

function candidateLabel(row: TechnicalCardResponsibleCandidate): string {
  const name = row.display_name.trim();
  return name || row.login;
}

export function TechCardOrderDataCard({
  card,
  documentNumber,
  disabled = false,
}: TechCardOrderDataCardProps) {
  const router = useRouter();
  const listboxId = useId();
  const clientListboxId = useId();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<TechnicalCardResponsibleCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [clientCandidates, setClientCandidates] = useState<TechnicalCardClientCandidate[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const [clientActiveIndex, setClientActiveIndex] = useState(0);
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [draftOrderNumber, setDraftOrderNumber] = useState("");
  const [draftDesiredDate, setDraftDesiredDate] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth() + 1);

  const defaultId =
    card.responsible_platform_user_id ?? card.created_by_platform_user_id ?? null;
  const defaultLabel =
    card.responsible_name?.trim() || card.created_by_name?.trim() || "";
  const defaultClientId = card.client_id ?? null;
  const defaultClientLabel = card.client_name?.trim() || "";
  const requiresClient = card.sales_order_id != null;
  const requiresDueDate = card.sales_order_id == null;
  const isStandalone = card.sales_order_id == null;

  const extraRows = useMemo(() => {
    const rows: TechnicalCardResponsibleCandidate[] = [];
    if (card.responsible_platform_user_id != null) {
      rows.push({
        id: card.responsible_platform_user_id,
        login: "",
        display_name: card.responsible_name?.trim() || `Пользователь #${card.responsible_platform_user_id}`,
      });
    }
    if (
      card.created_by_platform_user_id != null &&
      card.created_by_platform_user_id !== card.responsible_platform_user_id
    ) {
      rows.push({
        id: card.created_by_platform_user_id,
        login: "",
        display_name: card.created_by_name?.trim() || `Пользователь #${card.created_by_platform_user_id}`,
      });
    }
    return rows;
  }, [
    card.created_by_name,
    card.created_by_platform_user_id,
    card.responsible_name,
    card.responsible_platform_user_id,
  ]);

  const options = useMemo(() => {
    const byId = new Map<number, TechnicalCardResponsibleCandidate>();
    for (const row of extraRows) byId.set(row.id, row);
    for (const row of candidates) byId.set(row.id, row);
    return [...byId.values()].sort((a, b) =>
      candidateLabel(a).localeCompare(candidateLabel(b), "ru"),
    );
  }, [candidates, extraRows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((row) => {
      const label = candidateLabel(row).toLowerCase();
      return label.includes(needle) || row.login.toLowerCase().includes(needle);
    });
  }, [options, query]);

  const clientOptions = useMemo(() => {
    const byId = new Map<number, TechnicalCardClientCandidate>();
    if (selectedClientId != null) {
      byId.set(selectedClientId, {
        id: selectedClientId,
        label: clientQuery.trim() || defaultClientLabel || `Клиент #${selectedClientId}`,
      });
    }
    for (const row of clientCandidates) byId.set(row.id, row);
    return [...byId.values()];
  }, [clientCandidates, clientQuery, defaultClientLabel, selectedClientId]);

  const expanded = open && !disabled && !pending;
  const clientExpanded = clientOpen && !disabled && !pending && !createClientOpen;

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    void (async () => {
      const result = await listTechnicalCardResponsibleCandidates();
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCandidates(result.candidates);
    })();
    return () => {
      cancelled = true;
    };
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const handle = window.setTimeout(() => {
      void (async () => {
        const result = await listTechnicalCardClientCandidates(clientQuery);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setClientCandidates(result.candidates);
      })();
    }, 200);
    return () => window.clearTimeout(handle);
  }, [clientQuery, editing]);

  const beginEdit = () => {
    const parsed = parseIsoDate(card.desired_date);
    const now = new Date();
    setSelectedId(defaultId);
    setQuery(defaultLabel);
    setSelectedClientId(defaultClientId);
    setClientQuery(defaultClientLabel);
    setDraftOrderNumber(card.order_number?.trim() || "");
    setDraftDesiredDate(parsed ? toIsoDate(parsed.year, parsed.month, parsed.day) : null);
    setViewYear(parsed?.year ?? now.getFullYear());
    setViewMonth(parsed?.month ?? now.getMonth() + 1);
    setError(null);
    setOpen(false);
    setClientOpen(false);
    setActiveIndex(0);
    setClientActiveIndex(0);
    setEditing(true);
  };

  const onCancel = () => {
    setEditing(false);
    setError(null);
    setOpen(false);
    setClientOpen(false);
    setCreateClientOpen(false);
    setPending(false);
  };

  const selectCandidate = (row: TechnicalCardResponsibleCandidate) => {
    setSelectedId(row.id);
    setQuery(candidateLabel(row));
    setOpen(false);
  };

  const selectClient = (row: TechnicalCardClientCandidate) => {
    setSelectedClientId(row.id);
    setClientQuery(row.label);
    setClientOpen(false);
  };

  const onSave = async () => {
    if (requiresClient && selectedClientId == null) {
      setError("Выберите клиента из каталога или создайте нового");
      return;
    }
    if (requiresDueDate && !draftDesiredDate) {
      setError("Укажите дату сдачи");
      return;
    }
    const persistId = selectedId ?? card.created_by_platform_user_id ?? null;
    setPending(true);
    setError(null);
    const managerResult = await updateTechnicalCardResponsibleAction(card.id, persistId);
    if (!managerResult.ok) {
      setPending(false);
      setError(managerResult.message ?? "Не удалось сохранить ответственного");
      return;
    }
    const clientResult = await updateTechnicalCardClientAction(card.id, selectedClientId);
    if (!clientResult.ok) {
      setPending(false);
      setError(clientResult.message ?? "Не удалось сохранить клиента");
      return;
    }
    if (isStandalone && card.order_group_id != null) {
      const nextOrderNumber = draftOrderNumber.trim();
      if (!nextOrderNumber) {
        setPending(false);
        setError("Укажите номер заказа");
        return;
      }
      if (nextOrderNumber !== (card.order_number ?? "").trim()) {
        const orderResult = await updateTechnicalCardOrderNumberAction(
          card.order_group_id,
          nextOrderNumber,
          card.id,
        );
        if (!orderResult.ok) {
          setPending(false);
          setError(orderResult.message ?? "Не удалось сохранить номер заказа");
          return;
        }
      }
    }
    const dateResult = await updateTechnicalCardDesiredDateAction(card.id, draftDesiredDate);
    setPending(false);
    if (!dateResult.ok) {
      setError(dateResult.message ?? "Не удалось сохранить дату сдачи");
      return;
    }
    setEditing(false);
    router.refresh();
  };

  const managerValue = card.responsible_name?.trim() || "";
  const dueDisplay = formatDesiredDate(card.desired_date);
  const orderDisplay = card.order_number?.trim() || "";
  const controlsDisabled = disabled || pending;
  const calendarYears = useMemo(
    () => yearOptions(viewYear, new Date().getFullYear()),
    [viewYear],
  );
  const calendarCells = useMemo(
    () => monthGrid(viewYear, viewMonth),
    [viewMonth, viewYear],
  );

  const onViewMonthYear = (nextYear: number, nextMonth: number) => {
    setViewYear(nextYear);
    setViewMonth(nextMonth);
  };

  return (
    <>
    <SectionCard
      title="Данные по заказу"
      size="compact"
      collapsed={false}
      actions={
        <div
          className="flex flex-wrap items-center gap-1"
          role="toolbar"
          aria-label="Правка данных по заказу"
          data-tech-card-order-data-chrome
        >
          {editing ? (
            <>
              <IconButton
                label="Отменить редактирование"
                variant="secondary"
                disabled={controlsDisabled}
                onClick={onCancel}
                data-tech-card-order-data-cancel
              >
                <X className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton
                label="Сохранить"
                variant="primary"
                disabled={controlsDisabled}
                onClick={() => void onSave()}
                data-tech-card-order-data-save
              >
                <Save className="size-4" aria-hidden="true" />
              </IconButton>
            </>
          ) : (
            <IconButton
              label="Редактировать данные по заказу"
              variant="secondary"
              disabled={disabled}
              onClick={beginEdit}
              data-tech-card-order-data-edit
            >
              <Pencil className="size-4" aria-hidden="true" />
            </IconButton>
          )}
        </div>
      }
    >
      <div
        data-tech-card-order-data
        data-tech-card-order-data-editing={editing ? "true" : "false"}
      >
        {editing ? (
          <div className="grid gap-portal-3">
            {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
            {isStandalone ? (
              <div data-tech-card-order-link>
                <StandaloneTechCardLinkPanel
                  cardId={card.id}
                  orderNumber={orderDisplay}
                  draftOrderNumber={draftOrderNumber}
                  onDraftOrderNumberChange={setDraftOrderNumber}
                  manualEditable
                  disabled={controlsDisabled}
                />
              </div>
            ) : (
              <Field label="Заказ">
                <Input value={orderDisplay} readOnly disabled={controlsDisabled} />
              </Field>
            )}
            <Field label="Номер техкарты">
              <Input value={documentNumber} readOnly disabled={controlsDisabled} />
            </Field>
            <Field label="Ответственный менеджер" htmlFor="tech-card-responsible">
              <div className="relative">
                <input
                  id="tech-card-responsible"
                  type="text"
                  role="combobox"
                  autoComplete="off"
                  value={query}
                  disabled={controlsDisabled}
                  placeholder="Выберите пользователя"
                  aria-autocomplete="list"
                  aria-expanded={expanded}
                  aria-controls={expanded ? listboxId : undefined}
                  data-tech-card-responsible-combobox
                  className={controlClassName()}
                  onChange={(event) => {
                    const next = event.target.value;
                    setQuery(next);
                    setOpen(true);
                    setActiveIndex(0);
                    if (!next.trim()) setSelectedId(null);
                  }}
                  onFocus={() => setOpen(true)}
                  onBlur={() => setOpen(false)}
                  onKeyDown={(event) => {
                    if (!expanded || filtered.length === 0) return;
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setActiveIndex((index) => (index + 1) % filtered.length);
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length);
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      const pick = filtered[Math.min(activeIndex, filtered.length - 1)];
                      if (pick) selectCandidate(pick);
                    }
                  }}
                />
                {expanded ? (
                  <div
                    id={listboxId}
                    role="listbox"
                    className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-portal-border bg-portal-surface p-1 shadow-lg"
                  >
                    {filtered.length > 0 ? (
                      filtered.map((item, index) => {
                        const active = index === Math.min(activeIndex, filtered.length - 1);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => selectCandidate(item)}
                            className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
                              active
                                ? "bg-portal-surface-secondary text-portal-primary"
                                : "text-portal-text hover:bg-portal-surface-secondary"
                            }`}
                          >
                            {candidateLabel(item)}
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-sm text-portal-muted">Нет пользователей</div>
                    )}
                  </div>
                ) : null}
              </div>
            </Field>
            <Field label="Клиент" htmlFor="tech-card-client">
              <div className="relative">
                <input
                  id="tech-card-client"
                  type="text"
                  role="combobox"
                  autoComplete="off"
                  value={clientQuery}
                  disabled={controlsDisabled}
                  placeholder="Начните ввод — выберите или создайте"
                  aria-autocomplete="list"
                  aria-expanded={clientExpanded}
                  aria-controls={clientExpanded ? clientListboxId : undefined}
                  data-tech-card-client-combobox
                  className={controlClassName()}
                  onChange={(event) => {
                    const next = event.target.value;
                    setClientQuery(next);
                    setClientOpen(true);
                    setClientActiveIndex(0);
                    if (!next.trim()) setSelectedClientId(null);
                  }}
                  onFocus={() => setClientOpen(true)}
                  onBlur={() => setClientOpen(false)}
                  onKeyDown={(event) => {
                    if (!clientExpanded || clientOptions.length === 0) return;
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setClientActiveIndex((index) => (index + 1) % clientOptions.length);
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setClientActiveIndex(
                        (index) => (index - 1 + clientOptions.length) % clientOptions.length,
                      );
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      const pick = clientOptions[Math.min(clientActiveIndex, clientOptions.length - 1)];
                      if (pick) selectClient(pick);
                    }
                  }}
                />
                {clientExpanded ? (
                  <div
                    id={clientListboxId}
                    role="listbox"
                    className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-portal-border bg-portal-surface p-1 shadow-lg"
                  >
                    {clientOptions.length > 0 ? (
                      clientOptions.map((item, index) => {
                        const active = index === Math.min(clientActiveIndex, clientOptions.length - 1);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setClientActiveIndex(index)}
                            onClick={() => selectClient(item)}
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
                      <div className="px-3 py-2 text-sm text-portal-muted">Совпадений нет</div>
                    )}
                    <button
                      type="button"
                      data-tech-card-client-create
                      className="mt-1 block w-full rounded-md px-3 py-2 text-left text-sm text-portal-primary hover:bg-portal-surface-secondary"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setClientOpen(false);
                        setCreateClientOpen(true);
                      }}
                    >
                      Создать клиента
                      {clientQuery.trim() ? ` «${clientQuery.trim()}»` : ""}
                    </button>
                  </div>
                ) : null}
              </div>
              {selectedClientId == null && clientQuery.trim() ? (
                <div className="mt-portal-2">
                  <Button
                    type="button"
                    size="compact"
                    variant="secondary"
                    data-tech-card-client-create
                    disabled={controlsDisabled}
                    onClick={() => setCreateClientOpen(true)}
                  >
                    Создать клиента
                  </Button>
                </div>
              ) : null}
            </Field>
            <Field label="Дата сдачи">
              <div
                className="grid gap-portal-2"
                data-tech-card-due-date-calendar
              >
                <p className="text-portal-body font-medium">
                  {formatDesiredDate(draftDesiredDate)}
                </p>
                <div className="grid grid-cols-2 gap-portal-2">
                  <Select
                    size="compact"
                    aria-label="Месяц"
                    data-tech-card-due-date-month
                    disabled={controlsDisabled}
                    value={String(viewMonth)}
                    onChange={(event) => {
                      onViewMonthYear(viewYear, Number(event.target.value));
                    }}
                  >
                    {MONTH_LABELS_RU.map((label, index) => (
                      <option key={label} value={String(index + 1)}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    size="compact"
                    aria-label="Год"
                    data-tech-card-due-date-year
                    disabled={controlsDisabled}
                    value={String(viewYear)}
                    onChange={(event) => {
                      onViewMonthYear(Number(event.target.value), viewMonth);
                    }}
                  >
                    {calendarYears.map((year) => (
                      <option key={year} value={String(year)}>
                        {year}
                      </option>
                    ))}
                  </Select>
                </div>
                <div
                  className="grid grid-cols-7 gap-px rounded-portal-md border border-portal-border bg-portal-border"
                  role="grid"
                  aria-label="Календарь даты сдачи"
                >
                  {WEEKDAY_LABELS_RU.map((label) => (
                    <div
                      key={label}
                      className="bg-portal-surface-secondary px-1 py-1 text-center text-portal-caption text-portal-muted"
                    >
                      {label}
                    </div>
                  ))}
                  {calendarCells.map((cell, index) =>
                    cell.iso ? (
                      <button
                        key={cell.iso}
                        type="button"
                        role="gridcell"
                        aria-selected={draftDesiredDate === cell.iso}
                        disabled={controlsDisabled}
                        data-tech-card-due-date-day={cell.iso}
                        className={
                          draftDesiredDate === cell.iso
                            ? "min-h-8 px-1 py-1 text-center text-portal-caption bg-portal-primary text-portal-primary-on hover:bg-portal-primary-hover"
                            : "min-h-8 bg-portal-surface px-1 py-1 text-center text-portal-caption text-portal-text hover:bg-portal-state-hover"
                        }
                        onClick={() => setDraftDesiredDate(cell.iso)}
                      >
                        {cell.day}
                      </button>
                    ) : (
                      <div
                        key={`pad-${index}`}
                        className="min-h-8 bg-portal-surface px-1 py-1"
                        aria-hidden="true"
                      />
                    ),
                  )}
                </div>
              </div>
            </Field>
          </div>
        ) : (
          <dl className="grid gap-portal-3">
            {isStandalone ? (
              <div data-tech-card-order-link>
                <StandaloneTechCardLinkPanel
                  cardId={card.id}
                  orderNumber={orderDisplay}
                  draftOrderNumber={orderDisplay}
                  onDraftOrderNumberChange={() => {}}
                  disabled={disabled}
                />
              </div>
            ) : (
              <div>
                <dt className="text-portal-caption text-portal-muted">Заказ</dt>
                <dd className="mt-1 text-portal-body">{orderDisplay || "—"}</dd>
              </div>
            )}
            <div>
              <dt className="text-portal-caption text-portal-muted">Номер техкарты</dt>
              <dd className="mt-1 text-portal-body font-medium">{documentNumber}</dd>
            </div>
            <div>
              <dt className="text-portal-caption text-portal-muted">Ответственный менеджер</dt>
              <dd className="mt-1 text-portal-body">{managerValue || "—"}</dd>
            </div>
            <div>
              <dt className="text-portal-caption text-portal-muted">Клиент</dt>
              <dd className="mt-1 text-portal-body">{card.client_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-portal-caption text-portal-muted">Дата сдачи</dt>
              <dd className="mt-1 text-portal-body">{dueDisplay}</dd>
            </div>
          </dl>
        )}
      </div>
    </SectionCard>
    <ClientCreateDrawer
      open={createClientOpen}
      initialContactName={clientQuery}
      onClose={() => setCreateClientOpen(false)}
      onCreated={(created) => {
        setSelectedClientId(created.id);
        setClientQuery(created.label);
        setClientCandidates((rows) => {
          const next = rows.filter((row) => row.id !== created.id);
          return [{ id: created.id, label: created.label }, ...next];
        });
      }}
    />
    </>
  );
}
