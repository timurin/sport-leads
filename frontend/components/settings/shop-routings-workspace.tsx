"use client";

import Link from "next/link";
import { Copy, FilterX, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  copyShopRouting,
  deleteShopRouting,
} from "@/app/(workspace)/settings/catalogs/routings/routing-actions";
import { ShopRoutingCreateDrawer } from "@/components/settings/shop-routing-create-drawer";
import { IconButton } from "@/components/ui/button";
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
import { Input } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  filterShopRoutings,
  shopRoutingStageCount,
  type ShopRoutingTemplate,
} from "@/lib/shop-routings";
import type { ProductionStage } from "@/lib/production-stages";

/** PT-02 shop routings catalog list. */
export function ShopRoutingsWorkspace({
  routings,
  productionStages,
}: {
  routings: ShopRoutingTemplate[];
  productionStages: ProductionStage[];
}) {
  const router = useRouter();
  const [created, setCreated] = useState<ShopRoutingTemplate[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const byId = new Map<number, ShopRoutingTemplate>();
    for (const row of routings) byId.set(row.id, row);
    for (const row of created) byId.set(row.id, row);
    return Array.from(byId.values())
      .filter((row) => !removedIds.has(row.id))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [created, removedIds, routings]);

  const filtered = useMemo(
    () => filterShopRoutings(rows, query),
    [query, rows],
  );

  const clearFilters = () => setQuery("");

  const emptyDescription =
    rows.length === 0
      ? "Каталог пуст. Создайте первый маршрут через кнопку «+»."
      : "Измените поисковый запрос или сбросьте фильтры.";

  const handleCreated = (routing: ShopRoutingTemplate) => {
    setCreated((prev) => [
      routing,
      ...prev.filter((row) => row.id !== routing.id),
    ]);
    router.refresh();
  };

  const onCopy = async (row: ShopRoutingTemplate) => {
    setBusyId(row.id);
    setRowError(null);
    try {
      const result = await copyShopRouting(row.id);
      if (!result.ok) {
        setRowError(result.message);
        setBusyId(null);
        return;
      }
      setCreated((prev) => [
        result.routing,
        ...prev.filter((item) => item.id !== result.routing.id),
      ]);
      router.push(`/settings/catalogs/routings/${result.routing.id}`);
      router.refresh();
    } catch {
      setRowError("Не удалось скопировать маршрут.");
      setBusyId(null);
    }
  };

  const onDelete = async (row: ShopRoutingTemplate) => {
    if (!window.confirm(`Удалить маршрут «${row.name}»?`)) return;
    setBusyId(row.id);
    setRowError(null);
    try {
      const result = await deleteShopRouting(row.id);
      if (!result.ok) {
        setRowError(result.message);
        setBusyId(null);
        return;
      }
      setRemovedIds((prev) => new Set(prev).add(row.id));
      router.refresh();
    } catch {
      setRowError("Не удалось удалить маршрут.");
    }
    setBusyId(null);
  };

  const rowActions = (row: ShopRoutingTemplate) => {
    const busy = busyId === row.id;
    const href = `/settings/catalogs/routings/${row.id}`;
    return (
      <div className="flex items-center gap-1" role="group" aria-label="Действия">
        <IconButton
          label={`Копировать ${row.name}`}
          variant="secondary"
          disabled={busy}
          onClick={() => void onCopy(row)}
        >
          <Copy className="size-4" aria-hidden="true" />
        </IconButton>
        <IconButton
          label={`Редактировать ${row.name}`}
          disabled={busy}
          onClick={() => router.push(href)}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </IconButton>
        <IconButton
          label={`Удалить ${row.name}`}
          disabled={busy}
          onClick={() => void onDelete(row)}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </IconButton>
      </div>
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ShopRoutingCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
        productionStages={productionStages}
      />

      <PageToolbar
        start={
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по наименованию или коду"
            className="min-w-0 w-full flex-1"
            aria-label="Поиск маршрутов"
          />
        }
        end={
          <div className="flex flex-wrap items-center gap-1">
            <IconButton
              label="Создать маршрут"
              variant="primary"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Сбросить фильтры"
              variant="secondary"
              onClick={clearFilters}
            >
              <FilterX className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        }
      />

      {rowError ? (
        <p className="border-b border-portal-danger/30 bg-portal-danger-soft px-portal-4 py-portal-2 text-portal-caption text-portal-danger">
          {rowError}
        </p>
      ) : null}

      <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
        <div className="hidden min-w-0 md:block">
          <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
            <DataTable minWidthClassName="min-w-[720px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-36">Код</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-28">Этапов</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-28">Статус</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-36">Действия</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((row) => (
                  <DataTableRow key={row.id}>
                    <DataTableCell>
                      <Link
                        href={`/settings/catalogs/routings/${row.id}`}
                        className="font-medium text-portal-primary hover:underline"
                      >
                        {row.name}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="font-mono text-portal-caption text-portal-muted">
                        {row.code ?? "—"}
                      </span>
                    </DataTableCell>
                    <DataTableCell>{shopRoutingStageCount(row)}</DataTableCell>
                    <DataTableCell>
                      <StatusBadge
                        size="compact"
                        tone={row.is_active ? "success" : "neutral"}
                      >
                        {row.is_active ? "Активен" : "Отключён"}
                      </StatusBadge>
                    </DataTableCell>
                    <DataTableCell>{rowActions(row)}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        </div>

        <div className="space-y-portal-3 p-portal-4 md:hidden">
          {filtered.map((row) => (
            <div
              key={row.id}
              className="rounded-portal-md border border-portal-border bg-portal-surface p-portal-4"
            >
              <Link
                href={`/settings/catalogs/routings/${row.id}`}
                className="block hover:border-portal-primary/40"
              >
                <p className="font-medium text-portal-text">{row.name}</p>
                <p className="text-portal-caption text-portal-muted">
                  {row.code ?? "—"} · {shopRoutingStageCount(row)} этапов ·{" "}
                  {row.is_active ? "Активен" : "Отключён"}
                </p>
              </Link>
              <div className="mt-portal-3">{rowActions(row)}</div>
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Маршруты не найдены" description={emptyDescription} />
        ) : null}
      </section>

      <ListTotals primary={`Всего: ${filtered.length} маршрутов`} />
    </div>
  );
}
