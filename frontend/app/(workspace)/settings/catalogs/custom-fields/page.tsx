import { PageHeader } from "@/components/ui/page-header";
import { CustomFieldsWorkspace } from "@/components/settings/custom-fields-workspace";
import { getCustomFieldDefinitions, getNomenclatureCategories } from "@/lib/nomenclature";

export default async function CustomFieldsPage() {
  const [fields, categories] = await Promise.all([getCustomFieldDefinitions(), getNomenclatureCategories()]);
  return <><PageHeader title="Дополнительные реквизиты" description="Типизированные поля номенклатуры и их назначения по категориям" /><CustomFieldsWorkspace fields={fields} categories={categories} /></>;
}
