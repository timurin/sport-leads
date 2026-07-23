"use client";

import Link from "next/link";
import { BarChart3, ExternalLink, Filter, FilterX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PageLayout } from "@/components/layout/page-layout";
import { NomenclatureCreatePanels } from "@/components/settings/nomenclature-create-panels";
import { NomenclatureInspector } from "@/components/settings/nomenclature-inspector";
import {
  NomenclatureSectionCreateMenu,
  parseNomenclatureCreateKind,
  type NomenclatureCreateKind,
} from "@/components/settings/nomenclature-section-create-menu";
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
import type {
  Nomenclature,
  NomenclatureCategory,
  NomenclatureFieldValue,
  NomenclatureType,
  UnitOfMeasure,
} from "@/lib/nomenclature";

const ROW_ICON_LINK =
  "portal-focus-ring inline-flex size-portal-control-icon shrink-0 items-center justify-center rounded-portal-md border border-portal-border bg-portal-surface text-portal-muted hover:bg-portal-state-hover hover:text-portal-text";

const ROW_ICON_BUTTON =
  "portal-focus-ring inline-flex size-portal-control-icon shrink-0 items-center justify-center rounded-portal-md border border-portal-border bg-portal-surface text-portal-muted hover:bg-portal-state-hover hover:text-portal-text disabled:pointer-events-none disabled:opacity-50";

const typeLabels: Record<NomenclatureType, string> = {
  SERVICE: "Услуга",
  PRODUCT: "Продукция",
  GOODS: "Товар",
  MATERIAL: "Материал",
};
const typeOptions = Object.entries(typeLabels) as [NomenclatureType, string][];

function categoryName(
  categoryId: number | null,
  categories: NomenclatureCategory[],
) {
  return (
    categories.find((category) => category.id === categoryId)?.name ??
    "Без категории"
  );
}

/** PT-02 nomenclature catalog list (`DS-PT-02`), aligned with product-models. */
export function NomenclatureWorkspace({
  items,
  categories,
  units,
  fieldValues,
  coverUrls = {},
}: {
  items: Nomenclature[];
  categories: NomenclatureCategory[];
  units: UnitOfMeasure[];
  fieldValues: Record<number, NomenclatureFieldValue[]>;
  coverUrls?: Record<number, string | null>;
}) {
  const searchParams = useSearchParams();
  const [createKind, setCreateKind] = useState<NomenclatureCreateKind | null>(
    () => parseNomenclatureCreateKind(searchParams.get("create")),
  );
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | NomenclatureType>("");
  const [active, setActive] = useState("active");
  const [hasPrice, setHasPrice] = useState(false);
  const [missingRequired, setMissingRequired] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const filtersActive =
    Boolean(type) || active !== "active" || hasPrice || missingRequired;

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const openInspector = (item: Nomenclature) => {
    setSelectedId(item.id);
    setInspectorOpen(true);
  };

  const closeInspector = () => {
    setInspectorOpen(false);
  };

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const values = fieldValues[item.id] ?? [];
      const text = `${item.name} ${item.short_name ?? ""} ${values
        .map((field) => String(field.value ?? ""))
        .join(" ")}`.toLowerCase();
      if (search && !text.includes(search.toLowerCase())) {
        return false;
      }
      if (type && item.nomenclature_type !== type) {
        return false;
      }
      if (
        (active === "active" && !item.is_active) ||
        (active === "inactive" && item.is_active)
      ) {
        return false;
      }
      if (hasPrice && Number(item.base_price) <= 0) {
        return false;
      }
      if (
        missingRequired &&
        !values.some(
          (field) =>
            field.is_required && (field.value === null || field.value === ""),
        )
      ) {
        return false;
      }
      return true;
    });
  }, [items, fieldValues, search, type, active, hasPrice, missingRequired]);

  useEffect(() => {
    if (!filterOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filterOpen]);

  useEffect(() => {
    if (!inspectorOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInspectorOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [inspectorOpen]);

  const clearFilters = () => {
    setType("");
    setActive("active");
    setHasPrice(false);
    setMissingRequired(false);
  };

  const emptyDescription =
    items.length === 0
      ? "Каталог пуст. Создайте первую позицию через кнопку «Создать»."
      : "Измените поиск, фильтр или сбросьте их.";

  const unitLabel = (item: Nomenclature) =>
    units.find((unit) => unit.id === item.storage_unit_id)?.symbol ?? item.unit;

  const rowActions = (item: Nomenclature) => {
    const href = `/settings/catalogs/nomenclature/${item.id}`;
    const statsActive = inspectorOpen && item.id === selectedId;
    return (
      <div className="flex items-center gap-1" role="group" aria-label="Действия">
        <button
          type="button"
          className={[
            ROW_ICON_BUTTON,
            statsActive
              ? "border-portal-primary bg-portal-state-selected text-portal-primary"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={`Статистика ${item.name}`}
          aria-pressed={statsActive}
          title="Статистика"
          onClick={() => openInspector(item)}
        >
          <BarChart3 className="size-4" aria-hidden="true" />
        </button>
        <Link
          href={href}
          className={ROW_ICON_LINK}
          aria-label={`Открыть ${item.name}`}
          title="Открыть"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
        </Link>
      </div>
    );
  };

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PageToolbar
          start={
            <div className="flex min-w-0 w-full flex-1 items-center gap-1">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск по названию и реквизитам"
                className="min-w-0 w-full flex-1"
                aria-label="Поиск номенклатуры"
              />
              <IconButton
                label="Сбросить поиск"
                variant="secondary"
                disabled={!search}
                onClick={() => setSearch("")}
              >
                <X className="size-4" aria-hidden="true" />
              </IconButton>
              <div className="relative shrink-0" ref={filterRef}>
                <IconButton
                  label="Фильтр номенклатуры"
                  variant={filtersActive ? "primary" : "secondary"}
                  aria-expanded={filterOpen}
                  aria-haspopup="dialog"
                  onClick={() => setFilterOpen((open) => !open)}
                >
                  <Filter className="size-4" aria-hidden="true" />
                </IconButton>
                {filterOpen ? (
                  <div
                    role="dialog"
                    aria-label="Фильтр номенклатуры"
                    className="absolute right-0 z-20 mt-1 w-[min(100vw-2rem,18rem)] space-y-portal-3 rounded-portal-md border border-portal-border bg-portal-surface p-portal-3 shadow-portal-card"
                  >
                    <Select
                      value={type}
                      onChange={(event) =>
                        setType(event.target.value as "" | NomenclatureType)
                      }
                      aria-label="Тип"
                    >
                      <option value="">Все типы</option>
                      {typeOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={active}
                      onChange={(event) => setActive(event.target.value)}
                      aria-label="Статус"
                    >
                      <option value="active">Активные</option>
                      <option value="inactive">Неактивные</option>
                      <option value="all">Все статусы</option>
                    </Select>
                    <label className="flex items-center gap-2 text-portal-body text-portal-text">
                      <input
                        type="checkbox"
                        checked={hasPrice}
                        onChange={(event) => setHasPrice(event.target.checked)}
                        className="size-4 rounded border-portal-border"
                      />
                      Есть цена
                    </label>
                    <label className="flex items-center gap-2 text-portal-body text-portal-text">
                      <input
                        type="checkbox"
                        checked={missingRequired}
                        onChange={(event) =>
                          setMissingRequired(event.target.checked)
                        }
                        className="size-4 rounded border-portal-border"
                      />
                      Незаполненные обязательные
                    </label>
                  </div>
                ) : null}
              </div>
              <IconButton
                label="Сбросить фильтр"
                variant="secondary"
                disabled={!filtersActive}
                onClick={clearFilters}
              >
                <FilterX className="size-4" aria-hidden="true" />
              </IconButton>
            </div>
          }
          end={<NomenclatureSectionCreateMenu onSelect={setCreateKind} />}
        />

        <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
            <div className="hidden min-w-0 md:block">
              <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
                <DataTable minWidthClassName="min-w-[750px]">
                  <DataTableHead>
                    <tr>
                      <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                      <DataTableHeaderCell>Тип</DataTableHeaderCell>
                      <DataTableHeaderCell>Категория</DataTableHeaderCell>
                      <DataTableHeaderCell>Ед.</DataTableHeaderCell>
                      <DataTableHeaderCell>Цена</DataTableHeaderCell>
                      <DataTableHeaderCell>Статус</DataTableHeaderCell>
                      <DataTableHeaderCell>Действие</DataTableHeaderCell>
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {visibleItems.map((item) => {
                      const href = `/settings/catalogs/nomenclature/${item.id}`;
                      const selected =
                        inspectorOpen && item.id === selectedId;
                      return (
                        <DataTableRow
                          key={item.id}
                          className={
                            selected
                              ? "bg-portal-state-selected"
                              : "hover:bg-portal-state-hover"
                          }
                        >
                          <DataTableCell>
                            <Link
                              href={href}
                              className="font-medium text-portal-text hover:text-portal-primary hover:underline"
                            >
                              {item.name}
                            </Link>
                            {item.short_name ? (
                              <div className="text-portal-caption text-portal-muted">
                                {item.short_name}
                              </div>
                            ) : null}
                          </DataTableCell>
                          <DataTableCell>
                            {typeLabels[item.nomenclature_type]}
                          </DataTableCell>
                          <DataTableCell>
                            {categoryName(item.category_id, categories)}
                          </DataTableCell>
                          <DataTableCell>{unitLabel(item)}</DataTableCell>
                          <DataTableCell>
                            {item.basePrice} {item.currency}
                          </DataTableCell>
                          <DataTableCell>
                            <StatusBadge
                              size="compact"
                              tone={item.is_active ? "success" : "neutral"}
                            >
                              {item.is_active ? "Активна" : "Архив"}
                            </StatusBadge>
                          </DataTableCell>
                          <DataTableCell>{rowActions(item)}</DataTableCell>
                        </DataTableRow>
                      );
                    })}
                  </DataTableBody>
                </DataTable>
                {visibleItems.length === 0 ? (
                  <div className="p-portal-6">
                    <EmptyState
                      title={
                        items.length === 0
                          ? "Номенклатуры пока нет"
                          : "Позиции не найдены"
                      }
                      description={emptyDescription}
                      size="compact"
                    />
                  </div>
                ) : null}
              </DataTableFrame>
            </div>

            <div className="min-w-0 space-y-portal-3 border-b border-portal-border bg-portal-surface-secondary p-portal-3 md:hidden">
              {visibleItems.length === 0 ? (
                <EmptyState
                  title={
                    items.length === 0
                      ? "Номенклатуры пока нет"
                      : "Позиции не найдены"
                  }
                  description={emptyDescription}
                  size="compact"
                />
              ) : (
                visibleItems.map((item) => {
                  const href = `/settings/catalogs/nomenclature/${item.id}`;
                  const selected = inspectorOpen && item.id === selectedId;
                  return (
                    <article
                      key={item.id}
                      className={[
                        "min-w-0 rounded-portal-lg border bg-portal-surface p-portal-4 shadow-portal-sm",
                        selected
                          ? "border-portal-primary"
                          : "border-portal-border",
                      ].join(" ")}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-portal-3">
                        <div className="min-w-0 flex-1 space-y-portal-2">
                          <h3 className="truncate text-portal-body font-semibold text-portal-text">
                            <Link
                              href={href}
                              className="hover:text-portal-primary hover:underline"
                            >
                              {item.name}
                            </Link>
                          </h3>
                          <p className="truncate text-portal-caption text-portal-muted">
                            {typeLabels[item.nomenclature_type]} ·{" "}
                            {unitLabel(item)}
                          </p>
                          <p className="text-portal-caption text-portal-muted">
                            {categoryName(item.category_id, categories)} ·{" "}
                            {item.basePrice} {item.currency}
                          </p>
                          <div>{rowActions(item)}</div>
                        </div>
                        <StatusBadge
                          size="compact"
                          tone={item.is_active ? "success" : "neutral"}
                        >
                          {item.is_active ? "Активна" : "Архив"}
                        </StatusBadge>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <ListTotals primary={`Всего: ${visibleItems.length} позиций`} />
          </section>

          {inspectorOpen ? (
            <div
              className="fixed inset-y-0 right-0 z-portal-modal-1 flex h-dvh w-full max-w-[520px] flex-col overflow-hidden shadow-portal-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Превью номенклатуры"
            >
              <NomenclatureInspector
                item={selectedItem}
                categories={categories}
                units={units}
                coverUrl={
                  selectedId != null ? (coverUrls[selectedId] ?? null) : null
                }
                onClose={closeInspector}
              />
            </div>
          ) : null}
        </div>
      </div>

      <NomenclatureCreatePanels
        kind={createKind}
        categories={categories}
        units={units}
        onClose={() => setCreateKind(null)}
        variant="fullscreen"
      />
    </PageLayout>
  );
}
