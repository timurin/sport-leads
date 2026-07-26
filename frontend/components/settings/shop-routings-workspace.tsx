"use client";

import Link from "next/link";
import { FilterX, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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

/** PT-02 shop routings catalog list. */
export function ShopRoutingsWorkspace({
  routings,
}: {
  routings: ShopRoutingTemplate[];
}) {
  const router = useRouter();
  const [created, setCreated] = useState<ShopRoutingTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(() => {
    const byId = new Map<number, ShopRoutingTemplate>();
    for (const row of routings) byId.set(row.id, row);
    for (const row of created) byId.set(row.id, row);
    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "ru"),
    );
  }, [created, routings]);

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

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ShopRoutingCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
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

      <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
        <div className="hidden min-w-0 md:block">
          <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
            <DataTable minWidthClassName="min-w-[640px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-36">Код</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-28">Этапов</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-28">Статус</DataTableHeaderCell>
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
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        </div>

        <div className="space-y-portal-3 p-portal-4 md:hidden">
          {filtered.map((row) => (
            <Link
              key={row.id}
              href={`/settings/catalogs/routings/${row.id}`}
              className="block rounded-portal-md border border-portal-border bg-portal-surface p-portal-4 hover:border-portal-primary/40"
            >
              <p className="font-medium text-portal-text">{row.name}</p>
              <p className="text-portal-caption text-portal-muted">
                {row.code ?? "—"} · {shopRoutingStageCount(row)} этапов ·{" "}
                {row.is_active ? "Активен" : "Отключён"}
              </p>
            </Link>
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
