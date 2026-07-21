"use client";

import { assignCustomFieldToCategory, updateCustomFieldStatus } from "@/app/(workspace)/settings/catalogs/custom-fields/custom-fields-actions";
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
import { Checkbox, Select } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CustomFieldDataType, CustomFieldDefinition, NomenclatureCategory } from "@/lib/nomenclature";

const labels: Record<CustomFieldDataType, string> = {
  STRING: "Строка",
  TEXT: "Текст",
  INTEGER: "Целое число",
  DECIMAL: "Десятичное число",
  BOOLEAN: "Да/нет",
  DATE: "Дата",
  SINGLE_SELECT: "Один вариант",
  MULTI_SELECT: "Несколько вариантов",
  COLOR: "Цвет",
};

export function CustomFieldsWorkspace({
  fields,
  categories,
}: {
  fields: CustomFieldDefinition[];
  categories: NomenclatureCategory[];
}) {
  return (
    <NomenclatureSectionCreateHost categories={categories}>
      <div className="space-y-portal-6 p-portal-6">
        <form
          action={assignCustomFieldToCategory}
          className="grid gap-portal-2 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-5 shadow-portal-card md:grid-cols-4"
        >
          <Select name="category_id" required defaultValue="">
            <option value="">Категория</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
          <Select name="field_definition_id" required defaultValue="">
            <option value="">Реквизит</option>
            {fields.filter((field) => field.is_active).map((field) => (
              <option key={field.id} value={field.id}>{field.name}</option>
            ))}
          </Select>
          <Checkbox name="is_required" label="Обязательный" />
          <Checkbox name="inherit" defaultChecked label="Наследовать" />
          <Button type="submit" variant="secondary" className="md:col-span-4">
            Назначить категории
          </Button>
        </form>
        {fields.length === 0 ? (
          <DataTableFrame>
            <div className="p-portal-6">
              <EmptyState
                title="Реквизитов пока нет"
                description="Создайте реквизит через кнопку «Создать» в панели инструментов."
              />
            </div>
          </DataTableFrame>
        ) : (
          <DataTableFrame>
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Код</DataTableHeaderCell>
                  <DataTableHeaderCell>Название</DataTableHeaderCell>
                  <DataTableHeaderCell>Тип</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                  <DataTableHeaderCell>Действие</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {fields.map((field) => (
                  <DataTableRow key={field.id}>
                    <DataTableCell className="font-medium">{field.code}</DataTableCell>
                    <DataTableCell>{field.name}</DataTableCell>
                    <DataTableCell>{labels[field.data_type]}</DataTableCell>
                    <DataTableCell>
                      <StatusBadge
                        tone={field.is_active ? "success" : "neutral"}
                        size="compact"
                      >
                        {field.is_active ? "Активен" : "Отключён"}
                      </StatusBadge>
                    </DataTableCell>
                    <DataTableCell>
                      <form action={updateCustomFieldStatus}>
                        <input type="hidden" name="id" value={field.id} />
                        <input type="hidden" name="is_active" value={String(!field.is_active)} />
                        <Button type="submit" variant="ghost" size="compact">
                          {field.is_active ? "Отключить" : "Активировать"}
                        </Button>
                      </form>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )}
      </div>
    </NomenclatureSectionCreateHost>
  );
}
