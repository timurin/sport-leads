"use client";

import Link from "next/link";
import { FilterX } from "lucide-react";
import { useMemo, useState } from "react";

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
export function SizeGridsWorkspace({ grids }: { grids: SizeGridListItem[] }) {
  const [query, setQuery] = useState("");
  const [sizeType, setSizeType] = useState<SizeGridSizeType | "all">("all");

  const filtered = useMemo(
    () => filterSizeGrids(grids, query, sizeType),
    [grids, query, sizeType],
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
          <IconButton
            label="Сбросить фильтры"
            variant="secondary"
            onClick={clearFilters}
          >
            <FilterX className="size-4" aria-hidden="true" />
          </IconButton>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto p-portal-4 sm:p-portal-6">
        {filtered.length === 0 ? (
          <EmptyState
            title="Нет размерных сеток"
            description={
              grids.length === 0
                ? "Справочник пока пуст."
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
        primary={`Показано: ${filtered.length} из ${grids.length}`}
      />
    </div>
  );
}
