"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { createDesignProjectAction } from "@/app/(workspace)/design/projects/design-project-actions";
import { Button, IconButton } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
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
import { EntityLink } from "@/components/ui/entity-link";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  designProjectStatusLabel,
  designProjectStatusTone,
  filterDesignProjectsClient,
  type DesignProjectListItem,
} from "@/lib/design/design-projects";

type SalesOrderOption = {
  salesOrderId: number;
  salesOrderNumber: string;
  title: string;
};

const STATUS_FILTER_ITEMS: { value: string; label: string }[] = [
  { value: "", label: "Все статусы" },
  { value: "draft", label: "Черновик" },
  { value: "in_progress", label: "В работе" },
  { value: "ready", label: "Готов" },
  { value: "archived", label: "В архиве" },
];

/** PT-02 design projects list (ADR-021 / 10.1.1.4). */
export function DesignProjectsWorkspace({
  projects,
  salesOrderOptions,
}: {
  projects: DesignProjectListItem[];
  salesOrderOptions: SalesOrderOption[];
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [salesOrderId, setSalesOrderId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const byQuery = filterDesignProjectsClient(projects, query);
    if (!statusFilter) return byQuery;
    return byQuery.filter((row) => row.status === statusFilter);
  }, [projects, query, statusFilter]);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    const id = Number(salesOrderId.trim());
    if (!Number.isSafeInteger(id) || id <= 0) {
      setError("Выберите заказ покупателя");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createDesignProjectAction({
      sales_order_id: id,
      title: title.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast("Дизайн-проект создан", "success");
    setCreateOpen(false);
    setSalesOrderId("");
    setTitle("");
    setNotes("");
    router.push(`/design/projects/${result.project.id}`);
    router.refresh();
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <CreateDrawer
        open={createOpen}
        title="Новый дизайн-проект"
        description="Версионируемый контейнер макетов по заказу покупателя (ADR-021)."
        onClose={() => {
          if (saving) return;
          setCreateOpen(false);
          setError(null);
        }}
        variant="overlay"
      >
        <form onSubmit={onCreate} className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 space-y-portal-4 overflow-y-auto p-portal-6">
            <Field label="Заказ покупателя" required>
              <Select
                autoFocus
                required
                value={salesOrderId}
                onChange={(event) => setSalesOrderId(event.target.value)}
                disabled={saving}
              >
                <option value="">Выберите заказ…</option>
                {salesOrderOptions.map((option) => (
                  <option key={option.salesOrderId} value={option.salesOrderId}>
                    {option.salesOrderNumber}
                    {option.title ? ` · ${option.title}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Название">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={saving}
                placeholder="Например, макет формы"
              />
            </Field>
            <Field label="Примечание">
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={saving}
              />
            </Field>
            {salesOrderOptions.length === 0 ? (
              <p className="text-portal-caption text-portal-muted">
                Нет заказов покупателя. Создайте заказ в Продажах.
              </p>
            ) : null}
            {error ? (
              <p className="text-portal-body text-portal-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <footer className="flex justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
            <Button
              type="button"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Создание…" : "Создать"}
            </Button>
          </footer>
        </form>
      </CreateDrawer>

      <PageToolbar
        start={
          <div className="flex min-w-0 w-full flex-col gap-portal-2 md:flex-row md:items-center">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по № DP / заказу / названию"
              size="compact"
              className="min-w-0 w-full flex-1"
              aria-label="Поиск дизайн-проектов"
            />
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              size="compact"
              className="w-full md:w-48"
              aria-label="Фильтр по статусу"
            >
              {STATUS_FILTER_ITEMS.map((item) => (
                <option key={item.value || "all"} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <IconButton
              label="Создать дизайн-проект"
              variant="primary"
              className="self-start flex-none"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        }
      />

      <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
        {filtered.length === 0 ? (
          <EmptyState
            title="Нет дизайн-проектов"
            description="Создайте проект по заказу покупателя."
          />
        ) : (
          <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Номер</DataTableHeaderCell>
                  <DataTableHeaderCell>Название</DataTableHeaderCell>
                  <DataTableHeaderCell>Заказ покупателя</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                  <DataTableHeaderCell>Версии</DataTableHeaderCell>
                  <DataTableHeaderCell>Current</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((row) => (
                  <DataTableRow key={row.id}>
                    <DataTableCell>
                      <EntityLink href={`/design/projects/${row.id}`}>
                        {row.number}
                      </EntityLink>
                    </DataTableCell>
                    <DataTableCell>{row.title?.trim() || "—"}</DataTableCell>
                    <DataTableCell>
                      <Link
                        href={`/sales/orders/${row.sales_order_id}`}
                        className="text-portal-primary hover:underline"
                      >
                        {row.sales_order_number?.trim() || `#${row.sales_order_id}`}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge
                        size="compact"
                        tone={designProjectStatusTone(row.status)}
                      >
                        {designProjectStatusLabel(row.status)}
                      </StatusBadge>
                    </DataTableCell>
                    <DataTableCell>{row.version_count}</DataTableCell>
                    <DataTableCell>
                      {row.current_version_no != null
                        ? `v${row.current_version_no}`
                        : "—"}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            <ListTotals primary={`Всего: ${filtered.length} проектов`} />
          </DataTableFrame>
        )}
      </section>
    </div>
  );
}
