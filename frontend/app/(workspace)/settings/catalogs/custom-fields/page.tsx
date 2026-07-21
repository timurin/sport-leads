import { Suspense } from "react";

import { CustomFieldsWorkspace } from "@/components/settings/custom-fields-workspace";
import { getCustomFieldDefinitions, getNomenclatureCategories } from "@/lib/nomenclature";

export default async function CustomFieldsPage() {
  const [fields, categories] = await Promise.all([
    getCustomFieldDefinitions(),
    getNomenclatureCategories(),
  ]);
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-slate-500">Загрузка реквизитов…</div>
      }
    >
      <CustomFieldsWorkspace fields={fields} categories={categories} />
    </Suspense>
  );
}
