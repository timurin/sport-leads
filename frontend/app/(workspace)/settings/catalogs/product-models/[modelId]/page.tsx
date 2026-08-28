import { notFound } from "next/navigation";

import { ProductModelCard } from "@/components/settings/product-model-card";
import { ProductModelPersistentCard } from "@/components/settings/product-model-persistent-card";
import { productModelReference } from "@/lib/demo-data/product-model-reference";
import {
  getProductModelAssemblyVariants,
  getProductModelById,
  getProductModelFolders,
  getProductModelHistory,
  getProductModelMedia,
  getProductModelVersions,
  parseProductModelRouteId,
  toProductModelVersionViews,
} from "@/lib/product-models";
import { getDetailingItems } from "@/lib/detailing";
import { getNomenclature } from "@/lib/nomenclature";
import {
  getCharacteristicDefinitions,
  getCharacteristicOptions,
} from "@/lib/nomenclature";
import { getProductModelMaterialLines } from "@/lib/product-model-materials";
import { getProductModelRoutings } from "@/lib/product-model-routings";
import { getProductionStages } from "@/lib/production-stages";
import { getShopRoutings } from "@/lib/shop-routings";
import { getSewingOperationTemplates } from "@/lib/sewing-operation-templates";
import {
  getSewingOperationFolders,
  getSewingOperations,
} from "@/lib/sewing-operations";
import { getTechOperations } from "@/lib/tech-operations";
import { getProductTypes } from "@/lib/product-types";
import { getSizeGrids } from "@/lib/size-grids";

type ProductModelRouteProps = {
  params: Promise<{ modelId: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export default async function ProductModelRoute({
  params,
  searchParams,
}: ProductModelRouteProps) {
  const { modelId } = await params;
  const { edit } = await searchParams;
  const initialEditing = edit === "1" || edit === "true";

  if (modelId === productModelReference.id) {
    return <ProductModelCard model={productModelReference} />;
  }

  const id = parseProductModelRouteId(modelId);
  if (id == null) {
    notFound();
  }

  const model = await getProductModelById(id);
  if (!model) {
    notFound();
  }

  const [
    versions,
    media,
    history,
    assemblyVariants,
    sewingOperations,
    sewingFolders,
    sewingTemplates,
    sizeGrids,
    productTypes,
    shopRoutings,
    routingLinks,
    productionStages,
    techOperations,
    catalogFolders,
    materialLines,
    nomenclature,
    characteristicDefinitions,
    detailingItems,
  ] = await Promise.all([
    getProductModelVersions(id),
    getProductModelMedia(id),
    getProductModelHistory(id),
    getProductModelAssemblyVariants(id),
    getSewingOperations({ limit: 500 }),
    getSewingOperationFolders(),
    getSewingOperationTemplates(),
    getSizeGrids(),
    getProductTypes(),
    getShopRoutings({ limit: 500 }),
    getProductModelRoutings(id),
    getProductionStages({ active_only: true, limit: 500 }),
    getTechOperations({ active_only: true, limit: 500 }),
    getProductModelFolders(),
    getProductModelMaterialLines(id),
    getNomenclature(),
    getCharacteristicDefinitions(),
    getDetailingItems({ limit: 500 }),
  ]);

  const materialOptions = nomenclature
    .filter((row) => row.nomenclature_type === "MATERIAL")
    .map((row) => ({
      id: row.id,
      name: row.name,
      unit: row.unit,
      is_active: row.is_active,
    }));

  const hardwareTypeDef = characteristicDefinitions.find(
    (row) => row.code === "hardware_type",
  );
  const colorDef = characteristicDefinitions.find((row) => row.code === "color");
  const [hardwareTypeOptions, colorOptions] = await Promise.all([
    hardwareTypeDef
      ? getCharacteristicOptions(hardwareTypeDef.id)
      : Promise.resolve([]),
    colorDef ? getCharacteristicOptions(colorDef.id) : Promise.resolve([]),
  ]);

  return (
    <ProductModelPersistentCard
      model={model}
      versions={toProductModelVersionViews(versions)}
      media={media}
      history={history}
      assemblyVariants={assemblyVariants}
      sewingOperations={sewingOperations}
      sewingFolders={sewingFolders}
      sewingTemplates={sewingTemplates}
      sizeGrids={sizeGrids}
      productTypes={productTypes}
      shopRoutings={shopRoutings}
      routingLinks={routingLinks}
      productionStages={productionStages}
      techOperations={techOperations}
      catalogFolders={catalogFolders}
      materialLines={materialLines}
      materialOptions={materialOptions}
      detailingItems={detailingItems}
      hardwareTypeOptions={hardwareTypeOptions.filter((row) => row.is_active)}
      colorOptions={colorOptions.filter((row) => row.is_active)}
      initialEditing={initialEditing}
    />
  );
}
