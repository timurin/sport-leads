import { notFound } from "next/navigation";

import { NomenclatureAvailableModelsBlock } from "@/components/settings/nomenclature-available-models-block";
import { NomenclatureCard } from "@/components/settings/nomenclature-card";
import {
  getCategoryCharacteristics,
  getCharacteristicDefinitions,
  getCharacteristicOptions,
  getCustomFieldDefinitions,
  getCustomFieldOptions,
  getNomenclatureAvailableModels,
  getNomenclatureCategories,
  getNomenclatureById,
  getNomenclatureCharacteristics,
  getNomenclatureFieldValues,
  getNomenclatureMedia,
  getNomenclatureVariants,
  getUnitsOfMeasure,
} from "@/lib/nomenclature";
import { getProductModels } from "@/lib/product-models";

export default async function NomenclatureCardPage({
  params,
}: {
  params: Promise<{ nomenclatureId: string }>;
}) {
  const { nomenclatureId } = await params;
  if (!/^\d+$/.test(nomenclatureId)) notFound();
  const item = await getNomenclatureById(Number(nomenclatureId));
  if (!item) notFound();

  const [
    categories,
    units,
    fields,
    definitions,
    characteristicDefinitions,
    nomenclatureCharacteristics,
    variants,
    media,
  ] = await Promise.all([
    getNomenclatureCategories(),
    getUnitsOfMeasure(),
    getNomenclatureFieldValues(item.id),
    getCustomFieldDefinitions(),
    getCharacteristicDefinitions(),
    getNomenclatureCharacteristics(item.id),
    getNomenclatureVariants(item.id),
    getNomenclatureMedia(item.id),
  ]);

  const selectDefinitions = definitions.filter(
    (field) =>
      field.data_type === "SINGLE_SELECT" || field.data_type === "MULTI_SELECT",
  );
  const fieldOptions = Object.fromEntries(
    await Promise.all(
      selectDefinitions.map(
        async (field) =>
          [field.id, await getCustomFieldOptions(field.id)] as const,
      ),
    ),
  );
  const categoryCharacteristics = item.category_id
    ? await getCategoryCharacteristics(item.category_id)
    : [];
  const characteristicIds = [
    ...new Set([
      ...categoryCharacteristics.map((row) => row.characteristic_id),
      ...nomenclatureCharacteristics.map((row) => row.characteristic_id),
    ]),
  ];
  const characteristicOptions = Object.fromEntries(
    await Promise.all(
      characteristicIds.map(
        async (id) => [id, await getCharacteristicOptions(id)] as const,
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
    <>
      <NomenclatureCard
        item={item}
        categories={categories}
        units={units}
        fields={fields}
        fieldOptions={fieldOptions}
        definitions={definitions}
        characteristicDefinitions={characteristicDefinitions}
        categoryCharacteristics={categoryCharacteristics}
        nomenclatureCharacteristics={nomenclatureCharacteristics}
        variants={variants}
        characteristicOptions={characteristicOptions}
        media={media}
      />
      {isProduct ? (
        <div className="bg-[#f6f8fc] px-3 pb-5 sm:px-6">
          <NomenclatureAvailableModelsBlock
            nomenclatureId={item.id}
            links={availableModels}
            activeModels={activeModels}
          />
        </div>
      ) : null}
    </>
  );
}
