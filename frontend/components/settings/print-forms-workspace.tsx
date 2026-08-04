"use client";

import Link from "next/link";
import { FilePlus2, FilterX, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createPrintForm } from "@/app/(workspace)/settings/print-forms/print-form-actions";
import { Button, IconButton } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  emptyPrintFormDraft,
  filterPrintForms,
  getCurrentVersion,
  printFormBindingTypeOptions,
  printFormStatusLabels,
  printFormOutputFormatOptions,
  validatePrintFormDraft,
  type PrintForm,
  type PrintFormBindingType,
  type PrintFormDraft,
  type PrintFormOutputFormat,
} from "@/lib/print-forms";

function bindingLabel(bindingType: string): string {
  return (
    printFormBindingTypeOptions.find((item) => item.value === bindingType)?.label ??
    bindingType
  );
}

function statusTone(status: string): "neutral" | "success" | "warning" {
  if (status === "active") return "success";
  if (status === "draft") return "warning";
  return "neutral";
}

export function PrintFormsWorkspace({
  items: initialItems,
  canWrite,
}: {
  items: PrintForm[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [rows, setRows] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [draft, setDraft] = useState<PrintFormDraft>(emptyPrintFormDraft);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterPrintForms(rows, query, activeOnly),
    [rows, query, activeOnly],
  );
  const statusHint = canWrite
    ? "Реестр доступен для создания и редактирования"
    : "Режим просмотра. Для записи нужно право print_forms.write";

  const create = async () => {
    if (!canWrite) return;
    setError(null);
    const validation = validatePrintFormDraft(draft);
    if (validation) {
      setError(validation);
      return;
    }
    setCreating(true);
    const result = await createPrintForm(draft);
    setCreating(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setRows((current) =>
      [result.item, ...current].sort((a, b) =>
        b.updated_at.localeCompare(a.updated_at),
      ),
    );
    setDraft(emptyPrintFormDraft());
    pushToast("Печатная форма создана", "success");
    router.push(`/settings/print-forms/${result.item.id}`);
    router.refresh();
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageToolbar
        start={
          <div className="min-w-0">
            <p className="text-portal-body font-semibold text-portal-text">
              Печатные формы
            </p>
            <p className="text-portal-caption text-portal-muted">
              Реестр шаблонов печати Administration (`18.3.5`)
            </p>
          </div>
        }
        end={
          <div className="flex flex-wrap items-center gap-portal-2">
            <span className="text-portal-caption text-portal-muted">
              {statusHint}
            </span>
            <IconButton
              label="Сбросить фильтры"
              variant="secondary"
              className="flex-none"
              onClick={() => {
                setQuery("");
                setActiveOnly(false);
              }}
            >
              <FilterX className="size-4" aria-hidden="true" />
            </IconButton>
            <Button
              type="button"
              variant="primary"
              disabled={!canWrite || creating}
              onClick={() => {
                const element = document.getElementById(
                  "print-form-create-code",
                ) as HTMLInputElement | null;
                element?.focus();
              }}
            >
              <FilePlus2 className="size-4" aria-hidden="true" />
              Создать
            </Button>
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto bg-portal-surface">
        <div className="border-b border-portal-border px-portal-4 py-portal-3 sm:px-portal-6">
          <p className="mb-portal-2 text-portal-caption text-portal-muted">
            <Link href="/settings" className="text-portal-primary hover:underline">
              Настройки
            </Link>
            {" · "}
            Платформа
            {" · "}
            Печатные формы
          </p>
          <div className="mb-portal-3 grid gap-portal-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по коду, названию или привязке"
              className="min-w-0 w-full"
              aria-label="Поиск печатных форм"
            />
            <label className="flex items-center gap-portal-2 text-portal-caption text-portal-muted">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(event) => setActiveOnly(event.target.checked)}
                aria-label="Только активные"
              />
              Только активные
            </label>
          </div>
          {canWrite ? (
            <div className="grid gap-portal-3 md:grid-cols-2 xl:grid-cols-5">
              <Field label="Код" htmlFor="print-form-create-code">
                <Input
                  id="print-form-create-code"
                  value={draft.code}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, code: event.target.value }))
                  }
                  disabled={creating}
                />
              </Field>
              <Field label="Название" htmlFor="print-form-create-title">
                <Input
                  id="print-form-create-title"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, title: event.target.value }))
                  }
                  disabled={creating}
                />
              </Field>
              <Field label="Тип привязки" htmlFor="print-form-create-binding-type">
                <select
                  id="print-form-create-binding-type"
                  value={draft.binding_type}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      binding_type: event.target.value as PrintFormBindingType,
                    }))
                  }
                  disabled={creating}
                  className="h-portal-control-default w-full rounded-portal-md border border-portal-border bg-portal-surface px-portal-3 text-portal-body text-portal-text outline-none"
                >
                  {printFormBindingTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ключ привязки" htmlFor="print-form-create-binding-key">
                <Input
                  id="print-form-create-binding-key"
                  value={draft.binding_key}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      binding_key: event.target.value,
                    }))
                  }
                  disabled={creating}
                />
              </Field>
              <Field label="Формат" htmlFor="print-form-create-output-format">
                <div className="flex gap-portal-2">
                  <select
                    id="print-form-create-output-format"
                    value={draft.output_format}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        output_format: event.target.value as PrintFormOutputFormat,
                      }))
                    }
                    disabled={creating}
                    className="h-portal-control-default min-w-0 flex-1 rounded-portal-md border border-portal-border bg-portal-surface px-portal-3 text-portal-body text-portal-text outline-none"
                  >
                    {printFormOutputFormatOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={creating}
                    onClick={() => void create()}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    {creating ? "Создание…" : "Добавить"}
                  </Button>
                </div>
              </Field>
            </div>
          ) : null}
          {error ? (
            <p className="mt-portal-2 text-portal-caption text-portal-danger" role="alert">
              {error}
            </p>
          ) : null}
          {!canWrite ? (
            <p className="mt-portal-2 text-portal-caption text-portal-muted">
              Создание скрыто, потому что у текущего пользователя нет права
              {" "}
              <code>print_forms.write</code>.
            </p>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Нет печатных форм"
            description={
              rows.length === 0
                ? "Создайте первую печатную форму для документа, модели или справочника."
                : "Измените поиск или снимите фильтр «Только активные»."
            }
          />
        ) : (
          <>
            <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
              <DataTable minWidthClassName="min-w-[920px]">
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell>Код / название</DataTableHeaderCell>
                    <DataTableHeaderCell>Привязка</DataTableHeaderCell>
                    <DataTableHeaderCell>Формат</DataTableHeaderCell>
                    <DataTableHeaderCell>Текущая версия</DataTableHeaderCell>
                    <DataTableHeaderCell className="w-28">Статус</DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {filtered.map((item) => {
                    const currentVersion = getCurrentVersion(item);
                    return (
                      <DataTableRow key={item.id}>
                        <DataTableCell>
                          <Link
                            href={`/settings/print-forms/${item.id}`}
                            className="font-medium text-portal-primary hover:underline"
                          >
                            {item.title}
                          </Link>
                          <div className="mt-1 text-portal-caption text-portal-muted">
                            {item.code}
                          </div>
                        </DataTableCell>
                        <DataTableCell>
                          <div className="font-medium text-portal-text">
                            {bindingLabel(item.binding_type)}
                          </div>
                          <div className="mt-1 text-portal-caption text-portal-muted">
                            {item.binding_key}
                          </div>
                        </DataTableCell>
                        <DataTableCell>{item.output_format.toUpperCase()}</DataTableCell>
                        <DataTableCell>
                          {currentVersion ? (
                            <>
                              <div className="font-medium text-portal-text">
                                v{currentVersion.version_no} · {currentVersion.template_label}
                              </div>
                              <div className="mt-1 text-portal-caption text-portal-muted">
                                {currentVersion.status === "published"
                                  ? "Опубликована"
                                  : currentVersion.status}
                              </div>
                            </>
                          ) : (
                            <span className="text-portal-caption text-portal-muted">
                              Нет версии
                            </span>
                          )}
                        </DataTableCell>
                        <DataTableCell>
                          <StatusBadge
                            size="compact"
                            tone={statusTone(item.status)}
                          >
                            {printFormStatusLabels[item.status] ?? item.status}
                          </StatusBadge>
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            </DataTableFrame>
            <ListTotals
              className="border-t border-portal-border px-portal-4 py-portal-3 sm:px-portal-6"
              primary={`${filtered.length} из ${rows.length}`}
            />
          </>
        )}
      </div>
    </div>
  );
}
