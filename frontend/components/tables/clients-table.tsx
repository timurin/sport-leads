"use client";

import Link from "next/link";
import { ArrowDownUp, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { PageLayout, ResponsiveGrid } from "@/components/layout/page-layout";
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
import { InlineAlert } from "@/components/ui/inline-alert";
import { PageToolbar } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ClientFolderTree } from "@/components/sales/client-folder-tree";
import { moveClientToFolder } from "@/app/(workspace)/sales/clients/client-folder-actions";
import {
  clientMatchesFolderScope,
  type ClientFolderScope,
  type ClientFolderView,
} from "@/lib/sales/client-folders";
import type { Client } from "@/types/sales";

type ClientsTableProps = {
  clients: Client[];
  folders?: ClientFolderView[];
  loadError?: string;
  foldersError?: string;
};
type SortField = "name" | "salesAmount" | "lastContact";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 25;

const salesCurrency = (value: number) => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;

const statusLabels = { new: "Новый", active: "Активный", paused: "Приостановлен" } as const;
const statusTones = {
  new: "primary",
  active: "success",
  paused: "neutral",
} as const;

/** PT-02 client list workspace (`DS-PT-02`). Folders `2.2.4`. */
export function ClientsTable({
  clients,
  folders = [],
  loadError,
  foldersError,
}: ClientsTableProps) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [responsible, setResponsible] = useState("");
  const [folderScope, setFolderScope] = useState<ClientFolderScope>("all");
  const [sortField, setSortField] = useState<SortField>("lastContact");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  const types = [...new Set(clients.map((client) => client.type))];
  const managers = [...new Set(clients.map((client) => client.responsible.name))];

  const visibleClients = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru");
    return clients
      .filter((client) => {
        const searchText = [client.name, client.contact, client.phone, client.email, client.city, client.sport]
          .join(" ")
          .toLocaleLowerCase("ru");
        return (
          (!normalizedQuery || searchText.includes(normalizedQuery)) &&
          (!type || client.type === type) &&
          (!status || client.status === status) &&
          (!responsible || client.responsible.name === responsible) &&
          clientMatchesFolderScope(client.folderId, folderScope, folders)
        );
      })
      .sort((first, second) => {
        let comparison = 0;
        if (sortField === "name") comparison = first.name.localeCompare(second.name, "ru");
        if (sortField === "salesAmount") comparison = first.salesAmount - second.salesAmount;
        if (sortField === "lastContact") comparison = first.lastContactOrder - second.lastContactOrder;
        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [clients, folderScope, folders, query, responsible, sortDirection, sortField, status, type]);

  const pageCount = Math.max(1, Math.ceil(visibleClients.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = visibleClients.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const changeSort = (field: SortField) => {
    if (field === sortField) setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDirection("asc");
    }
    setPage(1);
  };
  const hasFilters = Boolean(query || type || status || responsible || folderScope !== "all");
  const resetFilters = () => {
    setQuery("");
    setType("");
    setStatus("");
    setResponsible("");
    setFolderScope("all");
    setPage(1);
  };
  const folderCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const folder of folders) {
      counts.set(
        folder.id,
        clients.filter((client) =>
          clientMatchesFolderScope(client.folderId, folder.id, folders),
        ).length,
      );
    }
    return counts;
  }, [clients, folders]);
  const unfiledCount = clients.filter((client) => client.folderId == null).length;

  const activeCount = clients.filter((client) => client.status === "active").length;
  const salesTotal = salesCurrency(clients.reduce((sum, client) => sum + client.salesAmount, 0));
  const selectionSales = salesCurrency(
    visibleClients.reduce((sum, client) => sum + client.salesAmount, 0),
  );

  return (
    <PageLayout>
      <PageToolbar
        end={
          <Button variant="primary" onClick={() => setDialogOpen(true)}>
            Создать клиента
          </Button>
        }
      />

      {loadError ? (
        <InlineAlert
          className="rounded-none border-x-0 border-t-0 border-b lg:px-portal-6"
          tone="danger"
          size="compact"
        >
          {loadError}
        </InlineAlert>
      ) : null}

      <section
        className="border-b border-portal-border bg-portal-surface-secondary px-portal-4 py-portal-4 lg:px-portal-6"
        aria-label="Статистика по клиентам"
      >
        <ResponsiveGrid minItemWidth="small" gap="default">
          <MetricCard label="Всего клиентов" value={clients.length} />
          <MetricCard label="Активные" value={activeCount} tone="success" />
          <MetricCard label="Общая сумма продаж" value={salesTotal} tone="primary" />
        </ResponsiveGrid>
      </section>

      <div className="grid min-w-0 gap-portal-4 border-b border-portal-border px-portal-4 py-portal-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-portal-6">
        <ClientFolderTree
          folders={folders}
          scope={folderScope}
          onScopeChange={(next) => {
            setFolderScope(next);
            setPage(1);
          }}
          unfiledCount={unfiledCount}
          counts={folderCounts}
          loadError={foldersError}
        />
        <div className="min-w-0">
      <FilterToolbar label="Фильтры клиентов">
        <div className="relative min-w-0 w-full md:min-w-60 md:flex-1 lg:max-w-sm">
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-portal-muted"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Клиент, контакт, телефон, email…"
            className="pl-9"
            aria-label="Поиск клиентов"
          />
        </div>
        <Select
          className="w-full md:w-auto md:min-w-40"
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setPage(1);
          }}
          aria-label="Тип клиента"
        >
          <option value="">Тип: все</option>
          {types.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
        <Select
          className="w-full md:w-auto md:min-w-40"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          aria-label="Статус клиента"
        >
          <option value="">Статус: все</option>
          <option value="new">Новый</option>
          <option value="active">Активный</option>
          <option value="paused">Приостановлен</option>
        </Select>
        <Select
          className="w-full md:w-auto md:min-w-44"
          value={responsible}
          onChange={(event) => {
            setResponsible(event.target.value);
            setPage(1);
          }}
          aria-label="Ответственный"
        >
          <option value="">Ответственный: все</option>
          {managers.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
        {hasFilters ? (
          <Button type="button" className="w-full md:w-auto" onClick={resetFilters}>
            Сбросить
          </Button>
        ) : null}
      </FilterToolbar>

      {/* Desktop / tablet table — local x-scroll only (`DS-PT-02`) */}
      <div className="hidden min-w-0 md:block">
        <DataTableFrame className="rounded-none border-x-0 shadow-none">
          <DataTable minWidthClassName="min-w-[1100px]">
            <DataTableHead>
              <tr>
                <SortableHeading
                  label="Клиент"
                  active={sortField === "name"}
                  onClick={() => changeSort("name")}
                />
                {["Папка", "Тип", "Контактное лицо", "Телефон", "Email", "Город", "Вид спорта"].map(
                  (label) => (
                    <DataTableHeaderCell key={label}>{label}</DataTableHeaderCell>
                  ),
                )}
                <DataTableHeaderCell align="right">Заказы</DataTableHeaderCell>
                <SortableHeading
                  label="Сумма продаж"
                  active={sortField === "salesAmount"}
                  onClick={() => changeSort("salesAmount")}
                />
                <SortableHeading
                  label="Последний контакт"
                  active={sortField === "lastContact"}
                  onClick={() => changeSort("lastContact")}
                />
                <DataTableHeaderCell>Ответственный</DataTableHeaderCell>
                <DataTableHeaderCell>Статус</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {pageRows.map((client) => (
                <DataTableRow key={client.id}>
                  <DataTableCell className="font-semibold">
                    <Link
                      href={`/sales/clients/${client.id}`}
                      className="text-portal-text hover:text-portal-primary hover:underline"
                    >
                      {client.name}
                    </Link>
                  </DataTableCell>
                  <DataTableCell>
                    <ClientFolderSelect
                      clientId={Number(client.id)}
                      folderId={client.folderId}
                      folders={folders}
                    />
                  </DataTableCell>
                  <DataTableCell className="text-portal-muted">{client.type}</DataTableCell>
                  <DataTableCell>{client.contact}</DataTableCell>
                  <DataTableCell className="whitespace-nowrap text-portal-muted">
                    {client.phone}
                  </DataTableCell>
                  <DataTableCell className="text-portal-primary">{client.email}</DataTableCell>
                  <DataTableCell className="text-portal-muted">{client.city}</DataTableCell>
                  <DataTableCell className="text-portal-muted">{client.sport}</DataTableCell>
                  <DataTableCell align="right" className="font-medium">
                    {client.ordersCount}
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap font-semibold">
                    {salesCurrency(client.salesAmount)}
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap text-portal-muted">
                    {client.lastContact}
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap text-portal-muted">
                    {client.responsible.name}
                  </DataTableCell>
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
      </div>

      {/* Mobile card stack — no page horizontal overflow */}
      <div className="min-w-0 space-y-portal-3 border-b border-portal-border bg-portal-surface-secondary p-portal-3 md:hidden">
        {!visibleClients.length ? (
          <EmptyState
            title="Клиенты не найдены"
            description="Измените поисковый запрос или сбросьте фильтры."
            size="compact"
          />
        ) : (
          pageRows.map((client) => (
            <article
              key={client.id}
              className="min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 shadow-portal-sm"
            >
              <div className="flex min-w-0 items-start justify-between gap-portal-3">
                <div className="min-w-0">
                  <h3 className="truncate text-portal-body font-semibold text-portal-text">
                    <Link
                      href={`/sales/clients/${client.id}`}
                      className="hover:text-portal-primary hover:underline"
                    >
                      {client.name}
                    </Link>
                  </h3>
                  <p className="mt-1 truncate text-portal-caption text-portal-muted">
                    {client.folderName ?? "Без папки"} · {client.type} · {client.city}
                  </p>
                </div>
                <StatusBadge tone={statusTones[client.status]} size="compact">
                  {statusLabels[client.status]}
                </StatusBadge>
              </div>
              <dl className="mt-portal-3 grid min-w-0 gap-portal-2 text-portal-caption">
                <div className="flex min-w-0 justify-between gap-portal-3">
                  <dt className="text-portal-muted">Контакт</dt>
                  <dd className="min-w-0 truncate text-right font-medium text-portal-text">
                    {client.contact}
                  </dd>
                </div>
                <div className="flex min-w-0 justify-between gap-portal-3">
                  <dt className="text-portal-muted">Телефон</dt>
                  <dd className="shrink-0 text-right text-portal-text">{client.phone}</dd>
                </div>
                <div className="flex min-w-0 justify-between gap-portal-3">
                  <dt className="text-portal-muted">Продажи</dt>
                  <dd className="shrink-0 text-right font-semibold text-portal-text">
                    {salesCurrency(client.salesAmount)}
                  </dd>
                </div>
                <div className="flex min-w-0 justify-between gap-portal-3">
                  <dt className="text-portal-muted">Ответственный</dt>
                  <dd className="min-w-0 truncate text-right text-portal-text">
                    {client.responsible.name}
                  </dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </div>

        </div>
      </div>

      <ListTotals
        primary={`Показано: ${pageRows.length} из ${visibleClients.length} (всего ${clients.length})`}
        secondary={`Продажи по выборке: ${selectionSales}`}
      />
      {visibleClients.length > PAGE_SIZE ? (
        <Pagination
          page={safePage}
          pageSize={PAGE_SIZE}
          total={visibleClients.length}
          onPageChange={setPage}
        />
      ) : null}

      <DemoCreateDrawer
        open={dialogOpen}
        title="Добавить клиента"
        onClose={() => setDialogOpen(false)}
      />
    </PageLayout>
  );
}

function ClientFolderSelect({
  clientId,
  folderId,
  folders,
}: {
  clientId: number;
  folderId: number | null;
  folders: ClientFolderView[];
}) {
  return (
    <Select
      className="min-w-36 max-w-44"
      value={folderId == null ? "" : String(folderId)}
      aria-label="Папка клиента"
      onChange={async (event) => {
        const next = event.target.value;
        const result = await moveClientToFolder(clientId, next === "" ? null : Number(next));
        if (!result.ok) window.alert(result.message);
      }}
    >
      <option value="">Без папки</option>
      {folders.map((folder) => (
        <option key={folder.id} value={folder.id}>
          {folder.name}
        </option>
      ))}
    </Select>
  );
}

function SortableHeading({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
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
