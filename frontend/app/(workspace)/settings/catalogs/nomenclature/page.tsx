import { PageHeader } from "@/components/ui/page-header";
import { NomenclatureWorkspace } from "@/components/settings/nomenclature-workspace";
import { getNomenclature, getNomenclatureCategories, getNomenclatureFieldValues, getUnitsOfMeasure } from "@/lib/nomenclature";

export default async function NomenclaturePage() {
  const [items, categories, units] = await Promise.all([getNomenclature(), getNomenclatureCategories(), getUnitsOfMeasure()]);
  const values = Object.fromEntries(await Promise.all(items.map(async (item) => [item.id, await getNomenclatureFieldValues(item.id)] as const)));
  return <><PageHeader title="Номенклатура" description="Карточки с типом, категорией и единицей хранения" /><NomenclatureWorkspace items={items} categories={categories} units={units} fieldValues={values} /></>;
}
