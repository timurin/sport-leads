"use client";

import { ArrowDownUp, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { DemoCreateDrawer } from "@/components/ui/demo-create-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { Input, Select } from "@/components/ui/form-controls";
import { ListTotals, Pagination } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { salesCurrency } from "@/lib/demo-data/sales";
import type { Client } from "@/types/sales";

type ClientsTableProps = { clients: Client[] };
type SortField = "name" | "salesAmount" | "lastContact";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 25;

const statusLabels = { new: "Новый", active: "Активный", paused: "Приостановлен" } as const;
const statusTones = {
  new: "primary",
  active: "success",
  paused: "neutral",
} as const;

export function ClientsTable({ clients }: ClientsTableProps) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [responsible, setResponsible] = useState("");
  const [sortField, setSortField] = useState<SortField>("lastContact");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  const types = [...new Set(clients.map((client) => client.type))];
  const managers = [...new Set(clients.map((client) => client.responsible.name))];

  const visibleClients = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru");
    return clients.filter((client) => {
      const searchText = [client.name, client.contact, client.phone, client.email, client.city, client.sport].join(" ").toLocaleLowerCase("ru");
      return (!normalizedQuery || searchText.includes(normalizedQuery)) && (!type || client.type === type) && (!status || client.status === status) && (!responsible || client.responsible.name === responsible);
    }).sort((first, second) => {
      let comparison = 0;
      if (sortField === "name") comparison = first.name.localeCompare(second.name, "ru");
      if (sortField === "salesAmount") comparison = first.salesAmount - second.salesAmount;
      if (sortField === "lastContact") comparison = first.lastContactOrder - second.lastContactOrder;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [clients, query, responsible, sortDirection, sortField, status, type]);

  const pageCount = Math.max(1, Math.ceil(visibleClients.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = visibleClients.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const changeSort = (field: SortField) => {
    if (field === sortField) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDirection("asc"); }
    setPage(1);
  };
  const hasFilters = Boolean(query || type || status || responsible);

  return (
    <div>
      <PageToolbar
        end={
          <Button variant="primary" onClick={() => setDialogOpen(true)}>
            Создать клиента
          </Button>
        }
      />
      <section className="grid gap-portal-3 border-b border-portal-border bg-portal-surface-secondary px-portal-4 py-portal-4 sm:grid-cols-3 lg:px-portal-6" aria-label="Статистика по клиентам">
        <article className="rounded-portal-lg border border-portal-border bg-portal-surface px-portal-4 py-portal-3"><p className="text-portal-caption text-portal-muted">Всего клиентов</p><strong className="mt-1 block text-portal-page text-portal-text">{clients.length}</strong></article>
        <article className="rounded-portal-lg border border-portal-border bg-portal-surface px-portal-4 py-portal-3"><p className="text-portal-caption text-portal-muted">Активные</p><strong className="mt-1 block text-portal-page text-portal-text">{clients.filter((client) => client.status === "active").length}</strong></article>
        <article className="rounded-portal-lg border border-portal-border bg-portal-surface px-portal-4 py-portal-3"><p className="text-portal-caption text-portal-muted">Общая сумма продаж</p><strong className="mt-1 block text-portal-page text-portal-text">{salesCurrency(clients.reduce((sum, client) => sum + client.salesAmount, 0))}</strong></article>
      </section>
      <FilterToolbar>
        <div className="relative min-w-60 flex-1 lg:max-w-sm">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-portal-muted" />
          <Input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="Клиент, контакт, телефон, email…"
            className="pl-9"
            aria-label="Поиск клиентов"
          />
        </div>
        <Select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}>
          <option value="">Тип: все</option>
          {types.map((value) => <option key={value}>{value}</option>)}
        </Select>
        <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">Статус: все</option>
          <option value="new">Новый</option>
          <option value="active">Активный</option>
          <option value="paused">Приостановлен</option>
        </Select>
        <Select value={responsible} onChange={(event) => { setResponsible(event.target.value); setPage(1); }}>
          <option value="">Ответственный: все</option>
          {managers.map((value) => <option key={value}>{value}</option>)}
        </Select>
        {hasFilters ? (
          <Button onClick={() => { setQuery(""); setType(""); setStatus(""); setResponsible(""); setPage(1); }}>
            Сбросить
          </Button>
        ) : null}
      </FilterToolbar>
      <DataTableFrame className="rounded-none border-x-0 shadow-none">
        <DataTable minWidthClassName="min-w-[1500px]">
          <DataTableHead>
            <tr>
              <SortableHeading label="Клиент" active={sortField === "name"} onClick={() => changeSort("name")} />
              {["Тип", "Контактное лицо", "Телефон", "Email", "Город", "Вид спорта"].map((label) => (
                <DataTableHeaderCell key={label}>{label}</DataTableHeaderCell>
              ))}
              <DataTableHeaderCell align="right">Заказы</DataTableHeaderCell>
              <SortableHeading label="Сумма продаж" active={sortField === "salesAmount"} onClick={() => changeSort("salesAmount")} />
              <SortableHeading label="Последний контакт" active={sortField === "lastContact"} onClick={() => changeSort("lastContact")} />
              <DataTableHeaderCell>Ответственный</DataTableHeaderCell>
              <DataTableHeaderCell>Статус</DataTableHeaderCell>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {pageRows.map((client) => (
              <DataTableRow key={client.id}>
                <DataTableCell className="font-semibold">{client.name}</DataTableCell>
                <DataTableCell className="text-portal-muted">{client.type}</DataTableCell>
                <DataTableCell>{client.contact}</DataTableCell>
                <DataTableCell className="whitespace-nowrap text-portal-muted">{client.phone}</DataTableCell>
                <DataTableCell className="text-portal-primary">{client.email}</DataTableCell>
                <DataTableCell className="text-portal-muted">{client.city}</DataTableCell>
                <DataTableCell className="text-portal-muted">{client.sport}</DataTableCell>
                <DataTableCell align="right" className="font-medium">{client.ordersCount}</DataTableCell>
                <DataTableCell className="whitespace-nowrap font-semibold">{salesCurrency(client.salesAmount)}</DataTableCell>
                <DataTableCell className="whitespace-nowrap text-portal-muted">{client.lastContact}</DataTableCell>
                <DataTableCell className="whitespace-nowrap text-portal-muted">{client.responsible.name}</DataTableCell>
                <DataTableCell>
                  <StatusBadge tone={statusTones[client.status]} size="compact">
                    {statusLabels[client.status]}
                  </StatusBadge>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
        {!visibleClients.length ? (
          <div className="border-t border-portal-border p-portal-6">
            <EmptyState
              title="Клиенты не найдены"
              description="Измените поисковый запрос или сбросьте фильтры."
              size="compact"
            />
          </div>
        ) : null}
      </DataTableFrame>
      <ListTotals
        primary={`Показано: ${pageRows.length} из ${visibleClients.length} (всего ${clients.length})`}
        secondary={`Продажи по выборке: ${salesCurrency(visibleClients.reduce((sum, client) => sum + client.salesAmount, 0))}`}
      />
      {visibleClients.length > PAGE_SIZE ? (
        <Pagination
          page={safePage}
          pageSize={PAGE_SIZE}
          total={visibleClients.length}
          onPageChange={setPage}
        />
      ) : null}
      <DemoCreateDrawer open={dialogOpen} title="Добавить клиента" onClose={() => setDialogOpen(false)} />
    </div>
  );
}

function SortableHeading({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <DataTableHeaderCell>
      <button
        type="button"
        onClick={onClick}
        className={[
          "inline-flex items-center gap-1.5 whitespace-nowrap font-inherit text-inherit uppercase tracking-wide",
          "text-portal-caption font-semibold",
          active ? "text-portal-primary" : "text-portal-muted",
          "hover:text-portal-primary",
        ].join(" ")}
      >
        {label}
        <ArrowDownUp size={13} aria-hidden="true" />
      </button>
    </DataTableHeaderCell>
  );
}
