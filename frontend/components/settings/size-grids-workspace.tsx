"use client";

import Link from "next/link";
import { FilterX, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { SizeGridCreateDrawer } from "@/components/settings/size-grid-create-drawer";
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
import { Input, Select } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  SIZE_GRID_SIZE_TYPE_LABELS,
  filterSizeGrids,
  type SizeGridListItem,
  type SizeGridSizeType,
} from "@/lib/size-grids";

const sizeTypeTone: Record<SizeGridSizeType, "primary" | "success" | "neutral"> = {
  men: "primary",
  women: "success",
  kids: "neutral",
};

/** PT-02 size-grids catalog list (`DS-PT-02-CATALOG`). */
export function SizeGridsWorkspace({
  grids,
  canWrite = false,
}: {
  grids: SizeGridListItem[];
  canWrite?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sizeType, setSizeType] = useState<SizeGridSizeType | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<SizeGridListItem[]>([]);

  const rows = useMemo(() => {
    const byId = new Map<number, SizeGridListItem>();
    for (const grid of grids) byId.set(grid.id, grid);
    for (const grid of created) byId.set(grid.id, grid);
    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "ru"),
    );
  }, [created, grids]);

  const filtered = useMemo(
    () => filterSizeGrids(rows, query, sizeType),
    [rows, query, sizeType],
  );

  const clearFilters = () => {
    setQuery("");
    setSizeType("all");
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageToolbar
        start={
          <>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по названию или типу"
              className="min-w-0 w-full flex-1"
              aria-label="Поиск размерных сеток"
            />
            <Select
              value={sizeType}
              onChange={(event) =>
                setSizeType(event.target.value as SizeGridSizeType | "all")
              }
              aria-label="Фильтр по типу размерной сетки"
              className="w-full sm:w-44"
            >
              <option value="all">Все типы</option>
              <option value="men">{SIZE_GRID_SIZE_TYPE_LABELS.men}</option>
              <option value="women">{SIZE_GRID_SIZE_TYPE_LABELS.women}</option>
              <option value="kids">{SIZE_GRID_SIZE_TYPE_LABELS.kids}</option>
            </Select>
          </>
        }
        end={
          <>
            <IconButton
              label="Сбросить фильтры"
              variant="secondary"
              onClick={clearFilters}
            >
              <FilterX className="size-4" aria-hidden="true" />
            </IconButton>
            {canWrite ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4" aria-hidden="true" />
                Создать
              </Button>
            ) : null}
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto p-portal-4 sm:p-portal-6">
        {filtered.length === 0 ? (
          <EmptyState
            title="Нет размерных сеток"
            description={
              rows.length === 0
                ? canWrite
                  ? "Создайте первую сетку или загрузите эталон."
                  : "Справочник пока пуст."
                : "Измените фильтры или сбросьте поиск."
            }
          />
        ) : (
          <DataTableFrame>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                  <DataTableHeaderCell>Тип</DataTableHeaderCell>
                  <DataTableHeaderCell>Строк</DataTableHeaderCell>
                  <DataTableHeaderCell>Источник</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((grid) => (
                  <DataTableRow key={grid.id}>
                    <DataTableCell>
                      <Link
                        href={`/settings/catalogs/size-grids/${grid.id}`}
                        className="font-medium text-portal-primary hover:underline"
                      >
                        {grid.name}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge
                        size="compact"
                        tone={sizeTypeTone[grid.size_type]}
                      >
                        {SIZE_GRID_SIZE_TYPE_LABELS[grid.size_type]}
                      </StatusBadge>
                    </DataTableCell>
                    <DataTableCell>{grid.row_count}</DataTableCell>
                    <DataTableCell className="max-w-[18rem] truncate text-portal-muted">
                      {grid.source_note ?? "—"}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )}
      </div>

      <ListTotals
        primary={`Показано: ${filtered.length} из ${rows.length}`}
      />

      {canWrite ? (
        <SizeGridCreateDrawer
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(grid) => {
            setCreated((current) => [
              {
                id: grid.id,
                name: grid.name,
                size_type: grid.size_type,
                source_note: grid.source_note,
                row_count: grid.rows.length,
                created_at: grid.created_at,
                updated_at: grid.updated_at,
              },
              ...current.filter((item) => item.id !== grid.id),
            ]);
            router.push(`/settings/catalogs/size-grids/${grid.id}`);
          }}
        />
      ) : null}
    </div>
  );
}
