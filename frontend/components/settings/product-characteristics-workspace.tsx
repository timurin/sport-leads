"use client";

import { FilterX, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { NomenclatureSectionCreateHost } from "@/components/settings/nomenclature-section-create-host";
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
import { StatusBadge } from "@/components/ui/status-badge";
import type { CharacteristicDefinition } from "@/lib/nomenclature";

/** PT-02 catalog list (`DS-PT-02-CATALOG`, etalon sewing-operations). */
export function ProductCharacteristicsWorkspace({
  definitions,
  optionCounts,
}: {
  definitions: CharacteristicDefinition[];
  optionCounts: Record<number, number>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      definitions
        .filter((definition) => {
          if (!query.trim()) return true;
          return definition.name
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase());
        })
        .sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [definitions, query],
  );

  const clearFilters = () => setQuery("");

  const openCard = (id: number) => {
    router.push(`/settings/catalogs/product-characteristics/${id}`);
  };

  const emptyDescription =
    definitions.length === 0
      ? "Каталог пуст. Создайте первую характеристику через кнопку «Создать»."
      : "Измените поисковый запрос или сбросьте фильтры.";

  return (
    <NomenclatureSectionCreateHost
      toolbarStart={
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по наименованию"
            className="min-w-0 w-full flex-1"
            aria-label="Поиск характеристик"
          />
          <IconButton
            label="Сбросить фильтры"
            variant="secondary"
            onClick={clearFilters}
          >
            <FilterX className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
          <div className="hidden min-w-0 md:block">
            <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
              <DataTable minWidthClassName="min-w-[640px]">
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                    <DataTableHeaderCell className="w-28">
                      Значений
                    </DataTableHeaderCell>
                    <DataTableHeaderCell className="w-36">
                      Статус
                    </DataTableHeaderCell>
                    <DataTableHeaderCell className="w-28">
                      Действия
                    </DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {filtered.map((definition) => (
                    <DataTableRow key={definition.id}>
                      <DataTableCell>
                        <span className="font-medium text-portal-text">
                          {definition.name}
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        {optionCounts[definition.id] ?? 0}
                      </DataTableCell>
                      <DataTableCell>
                        <StatusBadge
                          size="compact"
                          tone={definition.is_active ? "success" : "neutral"}
                        >
                          {definition.is_active ? "Активна" : "Неактивна"}
                        </StatusBadge>
                      </DataTableCell>
                      <DataTableCell>
                        <IconButton
                          label="Редактировать"
                          onClick={() => openCard(definition.id)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </IconButton>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTableFrame>
          </div>

          <div className="space-y-portal-3 p-portal-4 md:hidden">
            {filtered.map((definition) => (
              <article
                key={definition.id}
                className="rounded-portal-md border border-portal-border bg-portal-surface p-portal-4"
              >
                <div className="flex items-start justify-between gap-portal-3">
                  <div>
                    <p className="font-medium text-portal-text">
                      {definition.name}
                    </p>
                    <p className="text-portal-caption text-portal-muted">
                      Значений: {optionCounts[definition.id] ?? 0}
                    </p>
                    <div className="mt-portal-2">
                      <StatusBadge
                        size="compact"
                        tone={definition.is_active ? "success" : "neutral"}
                      >
                        {definition.is_active ? "Активна" : "Неактивна"}
                      </StatusBadge>
                    </div>
                  </div>
                  <IconButton
                    label="Редактировать"
                    onClick={() => openCard(definition.id)}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </IconButton>
                </div>
              </article>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="Характеристики не найдены"
              description={emptyDescription}
            />
          ) : null}
        </section>

        <ListTotals primary={`Всего: ${filtered.length} характеристик`} />
      </div>
    </NomenclatureSectionCreateHost>
  );
}
