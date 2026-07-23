import { notFound } from "next/navigation";

import { NomenclatureCard } from "@/components/settings/nomenclature-card";
import {
  getCharacteristicDefinitions,
  getCharacteristicOptions,
  getCharacteristicUsedValues,
  getNomenclatureAvailableModels,
  getNomenclatureCategories,
  getNomenclatureById,
  getNomenclatureFieldValues,
  getNomenclatureMedia,
  getUnitsOfMeasure,
} from "@/lib/nomenclature";
import { getProductModels } from "@/lib/product-models";

type NomenclatureCardPageProps = {
  params: Promise<{ nomenclatureId: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export default async function NomenclatureCardPage({
  params,
  searchParams,
}: NomenclatureCardPageProps) {
  const { nomenclatureId } = await params;
  const { edit } = await searchParams;
  const initialEditing = edit === "1" || edit === "true";
  if (!/^\d+$/.test(nomenclatureId)) notFound();
  const item = await getNomenclatureById(Number(nomenclatureId));
  if (!item) notFound();

  const [categories, units, fields, characteristicDefinitions, media] =
    await Promise.all([
      getNomenclatureCategories(),
      getUnitsOfMeasure(),
      getNomenclatureFieldValues(item.id),
      getCharacteristicDefinitions(),
      getNomenclatureMedia(item.id),
    ]);

  const selectDefinitions = characteristicDefinitions.filter((field) => {
    const kind = field.kind;
    return kind === "LIST" || kind === "MULTI_SELECT" || kind === "COLOR";
  });
  const fieldOptions = Object.fromEntries(
    await Promise.all(
      selectDefinitions.map(
        async (field) =>
          [field.id, await getCharacteristicOptions(field.id)] as const,
      ),
    ),
  );
  const usedValuesById = Object.fromEntries(
    await Promise.all(
      characteristicDefinitions.map(
        async (field) =>
          [field.id, await getCharacteristicUsedValues(field.id)] as const,
      ),
    ),
  );

  const isProduct = item.nomenclature_type === "PRODUCT";
  const [availableModels, activeModels] = isProduct
    ? await Promise.all([
        getNomenclatureAvailableModels(item.id),
        getProductModels({ status: "active", limit: 500 }),
      ])
    : [[], []];

  return (
    <NomenclatureCard
      item={item}
      categories={categories}
      units={units}
      fields={fields}
      fieldOptions={fieldOptions}
      usedValuesById={usedValuesById}
      characteristicDefinitions={characteristicDefinitions}
      media={media}
      availableModels={availableModels}
      activeModels={activeModels}
      initialEditing={initialEditing}
    />
  );
}
