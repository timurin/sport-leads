"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { updateCharacteristic } from "@/app/(workspace)/settings/catalogs/nomenclature/characteristics-actions";
import { NomenclatureSectionCreateHost } from "@/components/settings/nomenclature-section-create-host";
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
import { EditDrawer, EditForm } from "@/components/ui/edit-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityLink } from "@/components/ui/entity-link";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CharacteristicDefinition } from "@/lib/nomenclature";

const kindLabels = {
  COLOR: "Цвет",
  LIST: "Список (одно значение)",
} as const;

/** PT-02 nomenclature catalog list (`DS-PT-02`) + left edit drawer. */
export function ProductCharacteristicsWorkspace({
  definitions,
  optionCounts,
}: {
  definitions: CharacteristicDefinition[];
  optionCounts: Record<number, number>;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [active, setActive] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const filtered = useMemo(
    () =>
      definitions.filter((definition) => {
        const matchesQuery =
          !query.trim() ||
          `${definition.name} ${definition.code}`
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase());
        return (
          matchesQuery &&
          (!kind || definition.kind === kind) &&
          (!active ||
            (active === "active"
              ? definition.is_active
              : !definition.is_active))
        );
      }),
    [active, definitions, kind, query],
  );

  const editing = definitions.find((item) => item.id === editingId) ?? null;

  const clearFilters = () => {
    setQuery("");
    setKind("");
    setActive("");
  };

  const closeEdit = () => setEditingId(null);

  const saveEdit = async (formData: FormData) => {
    await updateCharacteristic(formData);
    closeEdit();
  };

  return (
    <NomenclatureSectionCreateHost
      toolbarStart={
        <p className="text-portal-body text-portal-muted">
          Найдено: {filtered.length}
        </p>
      }
    >
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <EditDrawer
          open={editing != null}
          title={editing ? `Редактирование: ${editing.name}` : ""}
          onClose={closeEdit}
        >
          {editing ? (
            <EditForm action={saveEdit} onCancel={closeEdit}>
              <input type="hidden" name="id" value={editing.id} />
              <Field label="Код" help="Системный код (только чтение)">
                <Input value={editing.code} readOnly />
              </Field>
              <Field label="Тип значения" help="Нельзя изменить после создания">
                <Input value={kindLabels[editing.kind]} readOnly />
              </Field>
              <Field label="Наименование" required>
                <Input
                  name="name"
                  defaultValue={editing.name}
                  required
                  autoFocus
                />
              </Field>
              <Checkbox
                name="is_active"
                value="true"
                defaultChecked={editing.is_active}
                label="Активна"
              />
              <p className="text-portal-caption text-portal-muted">
                Значения характеристики редактируются в{" "}
                <Link
                  href={`/settings/catalogs/product-characteristics/${editing.id}`}
                  className="font-semibold text-portal-primary hover:underline"
                >
                  карточке
                </Link>
                .
              </p>
            </EditForm>
          ) : null}
        </EditDrawer>

        <div className="min-w-0 flex-1">
          <FilterToolbar variant="strip" label="Фильтры характеристик">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по наименованию или коду"
              className="min-w-0 w-full md:min-w-56 md:flex-1"
              aria-label="Поиск характеристик"
            />
            <Select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="w-full md:w-auto"
              aria-label="Тип значения"
            >
              <option value="">Все типы</option>
              <option value="COLOR">Цвет</option>
              <option value="LIST">Список</option>
            </Select>
            <Select
              value={active}
              onChange={(event) => setActive(event.target.value)}
              className="w-full md:w-auto"
              aria-label="Статус"
            >
              <option value="">Все статусы</option>
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
            </Select>
            <Button
              type="button"
              size="compact"
              className="w-full md:w-auto"
              onClick={clearFilters}
            >
              Сбросить
            </Button>
          </FilterToolbar>

          <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
            <DataTable minWidthClassName="min-w-[720px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                  <DataTableHeaderCell>Код</DataTableHeaderCell>
                  <DataTableHeaderCell>Тип значения</DataTableHeaderCell>
                  <DataTableHeaderCell>Значений</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                  <DataTableHeaderCell>Действия</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((definition) => (
                  <DataTableRow
                    key={definition.id}
                    className={
                      editingId === definition.id
                        ? "bg-portal-primary-soft/50"
                        : undefined
                    }
                  >
                    <DataTableCell>
                      <button
                        type="button"
                        className="flex min-w-0 items-center gap-portal-2 text-left"
                        onClick={() => setEditingId(definition.id)}
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-portal-md bg-portal-primary-soft text-portal-caption font-bold text-portal-primary">
                          {definition.kind === "COLOR" ? "◉" : "Aa"}
                        </span>
                        <span className="font-medium text-portal-text hover:text-portal-primary">
                          {definition.name}
                        </span>
                      </button>
                    </DataTableCell>
                    <DataTableCell>{definition.code}</DataTableCell>
                    <DataTableCell>
                      {kindLabels[definition.kind]}
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
                      <div className="flex flex-wrap items-center gap-portal-2">
                        <Button
                          type="button"
                          size="compact"
                          onClick={() => setEditingId(definition.id)}
                        >
                          Изменить
                        </Button>
                        <EntityLink
                          href={`/settings/catalogs/product-characteristics/${definition.id}`}
                          className="inline-flex items-center gap-1 text-portal-caption"
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                          Карточка
                        </EntityLink>
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            {filtered.length === 0 ? (
              <div className="p-portal-6">
                <EmptyState
                  title="Характеристики не найдены"
                  description="Измените фильтры или создайте новую характеристику."
                  size="compact"
                />
              </div>
            ) : null}
          </DataTableFrame>
          <ListTotals
            primary={`Всего: ${filtered.length} характеристик`}
          />
        </div>
      </div>
    </NomenclatureSectionCreateHost>
  );
}
