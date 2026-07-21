"use client";

import { ArrowDownUp, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DemoActionDialog } from "@/components/ui/demo-action-dialog";
import { PageToolbar } from "@/components/ui/page-header";
import { salesCurrency } from "@/lib/demo-data/sales";
import type { Client } from "@/types/sales";

type ClientsTableProps = { clients: Client[] };
type SortField = "name" | "salesAmount" | "lastContact";
type SortDirection = "asc" | "desc";

const statusLabels = { new: "Новый", active: "Активный", paused: "Приостановлен" } as const;
const statusClasses = { new: "bg-blue-50 text-blue-700", active: "bg-emerald-50 text-emerald-700", paused: "bg-slate-100 text-slate-600" } as const;

export function ClientsTable({ clients }: ClientsTableProps) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [responsible, setResponsible] = useState("");
  const [sortField, setSortField] = useState<SortField>("lastContact");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const changeSort = (field: SortField) => {
    if (field === sortField) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDirection("asc"); }
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
      <section className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:grid-cols-3 lg:px-6" aria-label="Статистика по клиентам">
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-3"><p className="text-xs text-slate-500">Всего клиентов</p><strong className="mt-1 block text-xl text-slate-950">{clients.length}</strong></article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-3"><p className="text-xs text-slate-500">Активные</p><strong className="mt-1 block text-xl text-slate-950">{clients.filter((client) => client.status === "active").length}</strong></article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-3"><p className="text-xs text-slate-500">Общая сумма продаж</p><strong className="mt-1 block text-xl text-slate-950">{salesCurrency(clients.reduce((sum, client) => sum + client.salesAmount, 0))}</strong></article>
      </section>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
        <label className="flex h-10 min-w-60 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 lg:max-w-sm"><Search size={17} className="text-slate-400" /><span className="sr-only">Поиск клиентов</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Клиент, контакт, телефон, email…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        <select value={type} onChange={(event) => setType(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Тип: все</option>{types.map((value) => <option key={value}>{value}</option>)}</select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Статус: все</option><option value="new">Новый</option><option value="active">Активный</option><option value="paused">Приостановлен</option></select>
        <select value={responsible} onChange={(event) => setResponsible(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Ответственный: все</option>{managers.map((value) => <option key={value}>{value}</option>)}</select>
        {hasFilters ? <Button onClick={() => { setQuery(""); setType(""); setStatus(""); setResponsible(""); }}>Сбросить</Button> : null}
      </div>
      <div className="overflow-x-auto bg-white">
        <table className="w-full min-w-[1500px] border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr>
            <SortableHeading label="Клиент" active={sortField === "name"} onClick={() => changeSort("name")} />
            {["Тип", "Контактное лицо", "Телефон", "Email", "Город", "Вид спорта"].map((label) => <th key={label} className="border-b border-slate-200 px-4 py-3">{label}</th>)}
            <th className="border-b border-slate-200 px-4 py-3 text-right">Заказы</th>
            <SortableHeading label="Сумма продаж" active={sortField === "salesAmount"} onClick={() => changeSort("salesAmount")} />
            <SortableHeading label="Последний контакт" active={sortField === "lastContact"} onClick={() => changeSort("lastContact")} />
            <th className="border-b border-slate-200 px-4 py-3">Ответственный</th><th className="border-b border-slate-200 px-4 py-3">Статус</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">{visibleClients.map((client) => (
            <tr key={client.id} className="hover:bg-blue-50/40">
              <td className="px-4 py-3 font-semibold text-slate-900">{client.name}</td><td className="px-4 py-3 text-slate-600">{client.type}</td><td className="px-4 py-3 text-slate-700">{client.contact}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{client.phone}</td><td className="px-4 py-3 text-blue-700">{client.email}</td><td className="px-4 py-3 text-slate-600">{client.city}</td><td className="px-4 py-3 text-slate-600">{client.sport}</td>
              <td className="px-4 py-3 text-right font-medium text-slate-700">{client.ordersCount}</td><td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{salesCurrency(client.salesAmount)}</td><td className="whitespace-nowrap px-4 py-3 text-slate-600">{client.lastContact}</td><td className="whitespace-nowrap px-4 py-3 text-slate-600">{client.responsible.name}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClasses[client.status]}`}>{statusLabels[client.status]}</span></td>
            </tr>
          ))}</tbody>
        </table>
        {!visibleClients.length ? <div className="border-t border-slate-200 px-6 py-16 text-center"><h2 className="font-semibold text-slate-800">Клиенты не найдены</h2><p className="mt-1 text-sm text-slate-500">Измените поисковый запрос или сбросьте фильтры.</p></div> : null}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 lg:px-6"><span>Показано: {visibleClients.length} из {clients.length}</span><span>Продажи по выборке: {salesCurrency(visibleClients.reduce((sum, client) => sum + client.salesAmount, 0))}</span></footer>
      <DemoActionDialog open={dialogOpen} title="Добавить клиента" onClose={() => setDialogOpen(false)} />
    </div>
  );
}

function SortableHeading({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <th className="border-b border-slate-200 px-4 py-3"><button type="button" onClick={onClick} className={`flex items-center gap-1.5 whitespace-nowrap hover:text-blue-700 ${active ? "text-blue-700" : ""}`}>{label}<ArrowDownUp size={13} /></button></th>;
}
