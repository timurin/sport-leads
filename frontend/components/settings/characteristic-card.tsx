import Link from "next/link";

import {
  createCharacteristicOption,
  updateCharacteristic,
  updateCharacteristicOption,
} from "@/app/(workspace)/settings/catalogs/nomenclature/characteristics-actions";
import { SimpleEntityCard } from "@/components/entity/simple-entity-card";
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
import { EmptyState } from "@/components/ui/empty-state";
import { EntityHeader } from "@/components/ui/entity-header";
import { Field, Input } from "@/components/ui/form-controls";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  CharacteristicDefinition,
  CharacteristicOption,
} from "@/lib/nomenclature";

const kindLabels = {
  COLOR: "Цвет",
  LIST: "Список",
} as const;

/** PT-05 reference simple entity card (`DS-PT-05`). */
export function CharacteristicCard({
  definition,
  options,
}: {
  definition: CharacteristicDefinition;
  options: CharacteristicOption[];
}) {
  const kindLabel = kindLabels[definition.kind] ?? definition.kind;

  return (
    <SimpleEntityCard
      header={
        <EntityHeader
          eyebrow={
            <Link
              href="/settings/catalogs/product-characteristics"
              className="text-portal-primary hover:underline"
            >
              Характеристики номенклатуры
            </Link>
          }
          title={definition.name}
          description="Карточка характеристики номенклатуры"
          status={
            <StatusBadge
              size="compact"
              tone={definition.is_active ? "success" : "neutral"}
            >
              {definition.is_active ? "Активна" : "Неактивна"}
            </StatusBadge>
          }
          actions={
            <Link
              href="/settings/catalogs/product-characteristics"
              className="portal-focus-ring inline-flex h-portal-control-default items-center justify-center gap-portal-2 rounded-portal-md border border-portal-border bg-portal-surface px-portal-4 text-portal-body font-medium text-portal-text hover:bg-portal-state-hover"
            >
              ← К списку
            </Link>
          }
        />
      }
    >
      <SectionCard
        title="Основная информация"
        description="Системные реквизиты и наименование характеристики."
      >
        <form action={updateCharacteristic} className="grid min-w-0 gap-portal-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_auto] lg:items-end">
          <input type="hidden" name="id" value={definition.id} />
          <input
            type="hidden"
            name="is_active"
            value={String(definition.is_active)}
          />
          <Field label="Код" help="Системный код">
            <Input value={definition.id} readOnly aria-label="Код" />
          </Field>
          <Field label="Тип" help="Тип значений характеристики">
            <Input value={kindLabel} readOnly aria-label="Тип" />
          </Field>
          <Field label="Наименование" help="Отображаемое название">
            <Input
              name="name"
              defaultValue={definition.name}
              required
              aria-label="Наименование"
            />
          </Field>
          <div className="flex min-w-0 md:col-span-2 lg:col-span-1">
            <Button
              type="submit"
              variant="primary"
              className="w-full lg:w-auto"
            >
              Сохранить
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Значения характеристики"
        description="Значения, доступные для выбора в номенклатуре."
      >
        <form
          action={createCharacteristicOption}
          className="mb-portal-4 grid min-w-0 gap-portal-2 md:grid-cols-2 lg:grid-cols-[1.1fr_1fr_180px_auto]"
        >
          <input type="hidden" name="characteristic_id" value={definition.id} />
          <Input
            name="code"
            required
            placeholder="Код значения"
            pattern="[a-z0-9][a-z0-9_-]*"
            aria-label="Код значения"
          />
          <Input
            name="label"
            required
            placeholder="Отображаемое значение"
            aria-label="Отображаемое значение"
          />
          {definition.kind === "COLOR" ? (
            <Input
              name="hex_value"
              required
              placeholder="#000000"
              pattern="#[0-9A-Fa-f]{6}"
              aria-label="HEX цвет"
            />
          ) : (
            <span className="hidden lg:block" aria-hidden="true" />
          )}
          <Button type="submit" variant="primary" className="w-full lg:w-auto">
            Добавить значение
          </Button>
        </form>

        <DataTableFrame>
          <DataTable minWidthClassName="min-w-[860px]">
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Значение</DataTableHeaderCell>
                <DataTableHeaderCell>HEX</DataTableHeaderCell>
                <DataTableHeaderCell>Порядок</DataTableHeaderCell>
                <DataTableHeaderCell>Статус</DataTableHeaderCell>
                <DataTableHeaderCell>Действие</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {options.map((option) => (
                <DataTableRow key={option.id}>
                  <DataTableCell>
                    <div className="flex min-w-0 items-center gap-portal-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-portal-md bg-portal-primary-soft text-portal-caption font-bold text-portal-primary">
                        {definition.kind === "COLOR" ? "◉" : "Aa"}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-portal-text">
                          {option.label}
                        </span>
                        <span className="block text-portal-caption text-portal-muted">
                          {option.code}
                        </span>
                      </span>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    {option.hex_value ? (
                      <span className="inline-flex items-center gap-portal-2">
                        <i
                          className="inline-block size-4 rounded-portal-sm border border-portal-border"
                          style={{ backgroundColor: option.hex_value }}
                          aria-hidden="true"
                        />
                        {option.hex_value}
                      </span>
                    ) : (
                      "—"
                    )}
                  </DataTableCell>
                  <DataTableCell>{option.sort_order}</DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      size="compact"
                      tone={option.is_active ? "success" : "neutral"}
                    >
                      {option.is_active ? "Активно" : "Отключено"}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell>
                    <form action={updateCharacteristicOption}>
                      <input type="hidden" name="id" value={option.id} />
                      <input
                        type="hidden"
                        name="characteristic_id"
                        value={definition.id}
                      />
                      <input type="hidden" name="label" value={option.label} />
                      <input
                        type="hidden"
                        name="sort_order"
                        value={option.sort_order}
                      />
                      <input
                        type="hidden"
                        name="hex_value"
                        value={option.hex_value ?? ""}
                      />
                      <input
                        type="hidden"
                        name="is_active"
                        value={String(!option.is_active)}
                      />
                      <Button type="submit" size="compact">
                        {option.is_active ? "Отключить" : "Активировать"}
                      </Button>
                    </form>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
          {options.length === 0 ? (
            <div className="p-portal-6">
              <EmptyState
                title="Нет значений"
                description="Добавьте первое значение характеристики."
                size="compact"
              />
            </div>
          ) : null}
        </DataTableFrame>
      </SectionCard>
    </SimpleEntityCard>
  );
}
