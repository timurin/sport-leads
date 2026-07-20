import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { NomenclatureCard } from "@/components/settings/nomenclature-card";
import { NomenclatureCharacteristicsPanel } from "@/components/settings/nomenclature-characteristics-panel";
import { getCategoryCharacteristics, getCharacteristicDefinitions, getCharacteristicOptions, getCustomFieldDefinitions, getCustomFieldOptions, getNomenclatureCategories, getNomenclatureById, getNomenclatureCharacteristics, getNomenclatureFieldValues, getNomenclatureMedia, getNomenclatureVariants, getUnitsOfMeasure } from "@/lib/nomenclature";

export default async function NomenclatureCardPage({ params }: { params: Promise<{ nomenclatureId: string }> }) {
  const { nomenclatureId } = await params;
  const item = await getNomenclatureById(Number(nomenclatureId));
  if (!item) notFound();
  const [categories, units, fields, definitions, characteristicDefinitions, nomenclatureCharacteristics, variants, media] = await Promise.all([getNomenclatureCategories(), getUnitsOfMeasure(), getNomenclatureFieldValues(item.id), getCustomFieldDefinitions(), getCharacteristicDefinitions(), getNomenclatureCharacteristics(item.id), getNomenclatureVariants(item.id), getNomenclatureMedia(item.id)]);
  const selectDefinitions = definitions.filter((field) => field.data_type === "SINGLE_SELECT" || field.data_type === "MULTI_SELECT");
  const fieldOptions = Object.fromEntries(await Promise.all(selectDefinitions.map(async (field) => [field.id, await getCustomFieldOptions(field.id)] as const)));
  const categoryCharacteristics = item.category_id ? await getCategoryCharacteristics(item.category_id) : [];
  const characteristicIds = [...new Set([...categoryCharacteristics.map((row) => row.characteristic_id), ...nomenclatureCharacteristics.map((row) => row.characteristic_id)])];
  const characteristicOptions = Object.fromEntries(await Promise.all(characteristicIds.map(async (id) => [id, await getCharacteristicOptions(id)] as const)));
  return <><PageHeader title="Карточка номенклатуры" description="Просмотр и редактирование persistent-карточки" /><NomenclatureCard item={item} categories={categories} units={units} fields={fields} fieldOptions={fieldOptions} characteristicDefinitions={characteristicDefinitions} categoryCharacteristics={categoryCharacteristics} nomenclatureCharacteristics={nomenclatureCharacteristics} variants={variants} characteristicOptions={characteristicOptions}/><NomenclatureCharacteristicsPanel itemId={item.id} definitions={characteristicDefinitions} categoryCharacteristics={categoryCharacteristics} assignments={nomenclatureCharacteristics} variants={variants} options={characteristicOptions} media={media}/></>;
}
