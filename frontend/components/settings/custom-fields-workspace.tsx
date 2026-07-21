"use client";

import { assignCustomFieldToCategory, updateCustomFieldStatus } from "@/app/(workspace)/settings/catalogs/custom-fields/custom-fields-actions";
import { NomenclatureSectionCreateHost } from "@/components/settings/nomenclature-section-create-host";
import { Button } from "@/components/ui/button";
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
        <div className="overflow-x-auto rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card">
          {fields.length === 0 ? (
            <div className="p-portal-6">
              <EmptyState
                title="Реквизитов пока нет"
                description="Создайте реквизит через кнопку «Создать» в панели инструментов."
              />
            </div>
          ) : (
            <table className="min-w-full text-left text-portal-body">
              <thead className="border-b border-portal-border bg-portal-surface-secondary text-portal-muted">
                <tr>
                  <th className="px-portal-4 py-portal-3">Код</th>
                  <th className="px-portal-4 py-portal-3">Название</th>
                  <th className="px-portal-4 py-portal-3">Тип</th>
                  <th className="px-portal-4 py-portal-3">Статус</th>
                  <th className="px-portal-4 py-portal-3">Действие</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field.id} className="border-b border-portal-border last:border-0">
                    <td className="px-portal-4 py-portal-3 font-medium">{field.code}</td>
                    <td className="px-portal-4 py-portal-3">{field.name}</td>
                    <td className="px-portal-4 py-portal-3">{labels[field.data_type]}</td>
                    <td className="px-portal-4 py-portal-3">
                      <StatusBadge
                        tone={field.is_active ? "success" : "neutral"}
                        size="compact"
                      >
                        {field.is_active ? "Активен" : "Отключён"}
                      </StatusBadge>
                    </td>
                    <td className="px-portal-4 py-portal-3">
                      <form action={updateCustomFieldStatus}>
                        <input type="hidden" name="id" value={field.id} />
                        <input type="hidden" name="is_active" value={String(!field.is_active)} />
                        <Button type="submit" variant="ghost" size="compact">
                          {field.is_active ? "Отключить" : "Активировать"}
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </NomenclatureSectionCreateHost>
  );
}
