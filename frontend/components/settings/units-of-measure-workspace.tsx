"use client";

import { useState } from "react";

import { updateUnitOfMeasure } from "@/app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions";
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
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import type { UnitCategory, UnitOfMeasure } from "@/lib/nomenclature";

const labels: Record<UnitCategory, string> = {
  QUANTITY: "Количество",
  LENGTH: "Длина",
  AREA: "Площадь",
  MASS: "Масса",
  TIME: "Время",
  SERVICE: "Услуга",
};

/** PT-02 nomenclature catalog list (`DS-PT-02`) + left edit drawer. */
export function UnitsOfMeasureWorkspace({ units }: { units: UnitOfMeasure[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const editing = units.find((unit) => unit.id === editingId) ?? null;
  const closeEdit = () => setEditingId(null);

  const saveEdit = async (formData: FormData) => {
    await updateUnitOfMeasure(formData);
    closeEdit();
  };

  return (
    <NomenclatureSectionCreateHost
      toolbarStart={
        <p className="text-portal-body text-portal-muted">
          Всего: {units.length}
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
            <EditForm
              action={saveEdit}
              onCancel={closeEdit}
              readOnly={editing.is_system}
            >
              <input type="hidden" name="id" value={editing.id} />
              <Field label="Код" help="Системный код (только чтение)">
                <Input value={editing.code} readOnly />
              </Field>
              <Field label="Наименование" required>
                <Input
                  name="name"
                  defaultValue={editing.name}
                  required
                  autoFocus
                  readOnly={editing.is_system}
                />
              </Field>
              <Field label="Обозначение" required>
                <Input
                  name="symbol"
                  defaultValue={editing.symbol}
                  required
                  readOnly={editing.is_system}
                />
              </Field>
              <Field label="Категория">
                <Select
                  name="unit_category"
                  defaultValue={editing.unit_category}
                  disabled={editing.is_system}
                >
                  {Object.entries(labels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Точность">
                <Input
                  name="precision"
                  type="number"
                  min={0}
                  max={6}
                  defaultValue={editing.precision}
                  readOnly={editing.is_system}
                />
              </Field>
              {editing.is_system ? (
                <p className="text-portal-caption text-portal-muted">
                  Системную единицу нельзя деактивировать; поля доступны только
                  для просмотра.
                </p>
              ) : (
                <Checkbox
                  name="is_active"
                  value="true"
                  defaultChecked={editing.is_active}
                  label="Активна"
                />
              )}
            </EditForm>
          ) : null}
        </EditDrawer>

        <div className="min-w-0 flex-1">
          <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
            <DataTable minWidthClassName="min-w-[800px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Код</DataTableHeaderCell>
                  <DataTableHeaderCell>Название</DataTableHeaderCell>
                  <DataTableHeaderCell>Обозначение</DataTableHeaderCell>
                  <DataTableHeaderCell>Категория</DataTableHeaderCell>
                  <DataTableHeaderCell>Точность</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                  <DataTableHeaderCell>Действие</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {units.map((unit) => (
                  <DataTableRow
                    key={unit.id}
                    className={
                      editingId === unit.id
                        ? "bg-portal-primary-soft/50"
                        : undefined
                    }
                  >
                    <DataTableCell className="font-medium">
                      {unit.code}
                    </DataTableCell>
                    <DataTableCell>
                      <button
                        type="button"
                        className="font-medium text-portal-text hover:text-portal-primary"
                        onClick={() => setEditingId(unit.id)}
                      >
                        {unit.name}
                      </button>
                    </DataTableCell>
                    <DataTableCell>{unit.symbol}</DataTableCell>
                    <DataTableCell>{labels[unit.unit_category]}</DataTableCell>
                    <DataTableCell>{unit.precision}</DataTableCell>
                    <DataTableCell>
                      <StatusBadge
                        size="compact"
                        tone={unit.is_active ? "success" : "neutral"}
                      >
                        {unit.is_active ? "Активна" : "Отключена"}
                      </StatusBadge>
                    </DataTableCell>
                    <DataTableCell>
                      <Button
                        type="button"
                        size="compact"
                        onClick={() => setEditingId(unit.id)}
                      >
                        {unit.is_system ? "Открыть" : "Изменить"}
                      </Button>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            {units.length === 0 ? (
              <div className="p-portal-6">
                <EmptyState
                  title="Единиц измерения пока нет"
                  description="Создайте единицу через кнопку «Создать» в панели инструментов."
                  size="compact"
                />
              </div>
            ) : null}
          </DataTableFrame>
          <ListTotals primary={`Всего: ${units.length} единиц`} />
        </div>
      </div>
    </NomenclatureSectionCreateHost>
  );
}
