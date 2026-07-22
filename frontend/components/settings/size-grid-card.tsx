import Link from "next/link";

import { SimpleEntityCard } from "@/components/entity/simple-entity-card";
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
import { EntityHeader } from "@/components/ui/entity-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  SIZE_GRID_SIZE_TYPE_LABELS,
  formatHeightLabel,
  type SizeGrid,
} from "@/lib/size-grids";

const sizeTypeTone = {
  men: "primary",
  women: "success",
  kids: "neutral",
} as const;

/** PT-05 size-grid card (`DS-PT-05`) — Mosmade-style measurement table. */
export function SizeGridCard({ grid }: { grid: SizeGrid }) {
  const rows = [...grid.rows].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <SimpleEntityCard
      header={
        <EntityHeader
          eyebrow={
            <Link
              href="/settings/catalogs/size-grids"
              className="text-portal-primary hover:underline"
            >
              Размерные сетки
            </Link>
          }
          title={grid.name}
          description={
            grid.source_note
              ? `Эталон: ${grid.source_note}`
              : "Карточка размерной сетки"
          }
          status={
            <StatusBadge size="compact" tone={sizeTypeTone[grid.size_type]}>
              {SIZE_GRID_SIZE_TYPE_LABELS[grid.size_type]}
            </StatusBadge>
          }
          actions={
            <Link
              href="/settings/catalogs/size-grids"
              className="portal-focus-ring inline-flex h-portal-control-default items-center justify-center gap-portal-2 rounded-portal-md border border-portal-border bg-portal-surface px-portal-4 text-portal-body font-medium text-portal-text hover:bg-portal-state-hover"
            >
              ← К списку
            </Link>
          }
        />
      }
    >
      <SectionCard
        title="Реквизиты"
        description="Одна сетка — один тип размера (Variant A)."
        size="compact"
      >
        <dl className="grid gap-portal-3 sm:grid-cols-3">
          <div className="min-w-0 border-l-2 border-portal-primary/40 pl-portal-3">
            <dt className="text-portal-caption font-medium text-portal-muted">
              Наименование
            </dt>
            <dd className="mt-1 font-semibold text-portal-text">{grid.name}</dd>
          </div>
          <div className="min-w-0 border-l-2 border-portal-primary/40 pl-portal-3">
            <dt className="text-portal-caption font-medium text-portal-muted">
              Тип размерной сетки
            </dt>
            <dd className="mt-1 font-semibold text-portal-text">
              {SIZE_GRID_SIZE_TYPE_LABELS[grid.size_type]}
            </dd>
          </div>
          <div className="min-w-0 border-l-2 border-portal-border pl-portal-3">
            <dt className="text-portal-caption font-medium text-portal-muted">
              Строк размеров
            </dt>
            <dd className="mt-1 font-semibold text-portal-text">{rows.length}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard
        title="Таблица размеров"
        description="Справочные значения обхватов и роста (текст, как у Mosmade)."
        size="compact"
      >
        {rows.length === 0 ? (
          <EmptyState
            title="Нет строк размера"
            description="Добавьте размеры в эту сетку."
          />
        ) : (
          <DataTableFrame>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>RU</DataTableHeaderCell>
                  <DataTableHeaderCell>INT</DataTableHeaderCell>
                  <DataTableHeaderCell>Обхват груди</DataTableHeaderCell>
                  <DataTableHeaderCell>Обхват талии</DataTableHeaderCell>
                  <DataTableHeaderCell>Обхват бедер</DataTableHeaderCell>
                  <DataTableHeaderCell>Рост S</DataTableHeaderCell>
                  <DataTableHeaderCell>Рост N</DataTableHeaderCell>
                  <DataTableHeaderCell>Рост T</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {rows.map((row) => (
                  <DataTableRow key={row.id}>
                    <DataTableCell className="font-medium">{row.ru_size}</DataTableCell>
                    <DataTableCell>{row.int_label}</DataTableCell>
                    <DataTableCell>{row.chest}</DataTableCell>
                    <DataTableCell>{row.waist}</DataTableCell>
                    <DataTableCell>{row.hip}</DataTableCell>
                    <DataTableCell>{formatHeightLabel(row.height_s)}</DataTableCell>
                    <DataTableCell>{formatHeightLabel(row.height_n)}</DataTableCell>
                    <DataTableCell>{formatHeightLabel(row.height_t)}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )}
      </SectionCard>
    </SimpleEntityCard>
  );
}
