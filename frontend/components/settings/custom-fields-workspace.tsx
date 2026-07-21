"use client";

import { createCustomField, assignCustomFieldToCategory, updateCustomFieldStatus } from "@/app/(workspace)/settings/catalogs/custom-fields/custom-fields-actions";
import { NomenclatureSectionCreateHost } from "@/components/settings/nomenclature-section-create-host";
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
      <div className="space-y-6 p-6">
        <form action={createCustomField} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-5">
          <input name="code" required pattern="[a-z0-9][a-z0-9_-]*" placeholder="Код реквизита" className="rounded border px-3 py-2 text-sm" />
          <input name="name" required placeholder="Название" className="rounded border px-3 py-2 text-sm" />
          <select name="data_type" defaultValue="STRING" className="rounded border px-3 py-2 text-sm">
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input name="description" placeholder="Описание" className="rounded border px-3 py-2 text-sm" />
          <button type="submit" className="rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white">
            Создать реквизит
          </button>
          <label className="text-sm"><input type="checkbox" name="is_searchable" className="mr-2" />Искать</label>
          <label className="text-sm"><input type="checkbox" name="is_filterable" className="mr-2" />Фильтровать</label>
        </form>
        <form action={assignCustomFieldToCategory} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
          <select name="category_id" required className="rounded border px-3 py-2 text-sm">
            <option value="">Категория</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <select name="field_definition_id" required className="rounded border px-3 py-2 text-sm">
            <option value="">Реквизит</option>
            {fields.filter((field) => field.is_active).map((field) => (
              <option key={field.id} value={field.id}>{field.name}</option>
            ))}
          </select>
          <label className="text-sm"><input type="checkbox" name="is_required" className="mr-2" />Обязательный</label>
          <label className="text-sm"><input type="checkbox" name="inherit" defaultChecked className="mr-2" />Наследовать</label>
          <button type="submit" className="rounded bg-slate-800 px-3 py-2 text-sm font-semibold text-white md:col-span-4">
            Назначить категории
          </button>
        </form>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">Код</th>
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Тип</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Действие</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{field.code}</td>
                  <td className="px-4 py-3">{field.name}</td>
                  <td className="px-4 py-3">{labels[field.data_type]}</td>
                  <td className="px-4 py-3">{field.is_active ? "Активен" : "Отключён"}</td>
                  <td className="px-4 py-3">
                    <form action={updateCustomFieldStatus}>
                      <input type="hidden" name="id" value={field.id} />
                      <input type="hidden" name="is_active" value={String(!field.is_active)} />
                      <button type="submit" className="text-xs font-semibold text-blue-700">
                        {field.is_active ? "Отключить" : "Активировать"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </NomenclatureSectionCreateHost>
  );
}
