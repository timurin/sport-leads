import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { NomenclatureCard } from "@/components/settings/nomenclature-card";
import { getCustomFieldDefinitions, getCustomFieldOptions, getNomenclatureCategories, getNomenclatureById, getNomenclatureFieldValues, getUnitsOfMeasure } from "@/lib/nomenclature";

export default async function NomenclatureCardPage({ params }: { params: Promise<{ nomenclatureId: string }> }) {
  const { nomenclatureId } = await params;
  const item = await getNomenclatureById(Number(nomenclatureId));
  if (!item) notFound();
  const [categories, units, fields, definitions] = await Promise.all([getNomenclatureCategories(), getUnitsOfMeasure(), getNomenclatureFieldValues(item.id), getCustomFieldDefinitions()]);
  const selectDefinitions = definitions.filter((field) => field.data_type === "SINGLE_SELECT" || field.data_type === "MULTI_SELECT");
  const fieldOptions = Object.fromEntries(await Promise.all(selectDefinitions.map(async (field) => [field.id, await getCustomFieldOptions(field.id)] as const)));
  return <><PageHeader title="Карточка номенклатуры" description="Просмотр и редактирование persistent-карточки" /><NomenclatureCard item={item} categories={categories} units={units} fields={fields} fieldOptions={fieldOptions}/></>;
}
