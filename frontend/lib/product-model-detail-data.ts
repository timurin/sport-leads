import { getDetailingItems } from "@/lib/detailing";
import {
  getCharacteristicDefinitions,
  getCharacteristicOptions,
  getNomenclature,
} from "@/lib/nomenclature";
import { getProductModelMaterialLines } from "@/lib/product-model-materials";
import { getProductModelRoutings } from "@/lib/product-model-routings";
import {
  getProductModelAssemblyVariants,
  getProductModelById,
  getProductModelFolders,
  getProductModelHistory,
  getProductModelMedia,
  getProductModelVersions,
  toProductModelVersionViews,
} from "@/lib/product-models";
import { getProductTypes } from "@/lib/product-types";
import { getProductionStages } from "@/lib/production-stages";
import { getSewingOperationTemplates } from "@/lib/sewing-operation-templates";
import {
  getSewingOperationFolders,
  getSewingOperations,
} from "@/lib/sewing-operations";
import { getShopRoutings } from "@/lib/shop-routings";
import { getSizeGrids } from "@/lib/size-grids";
import { getTechOperations } from "@/lib/tech-operations";

export async function loadProductModelDetailData(modelId: number) {
  const model = await getProductModelById(modelId);
  if (!model) return null;

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
    getProductModelVersions(modelId),
    getProductModelMedia(modelId),
    getProductModelHistory(modelId),
    getProductModelAssemblyVariants(modelId),
    getSewingOperations({ limit: 500 }),
    getSewingOperationFolders(),
    getSewingOperationTemplates(),
    getSizeGrids(),
    getProductTypes(),
    getShopRoutings({ limit: 500 }),
    getProductModelRoutings(modelId),
    getProductionStages({ active_only: true, limit: 500 }),
    getTechOperations({ active_only: true, limit: 500 }),
    getProductModelFolders(),
    getProductModelMaterialLines(modelId),
    getNomenclature(),
    getCharacteristicDefinitions(),
    getDetailingItems({ limit: 500 }),
  ]);

  const hardwareTypeDef = characteristicDefinitions.find((row) => row.code === "hardware_type");
  const colorDef = characteristicDefinitions.find((row) => row.code === "color");
  const [hardwareTypeOptions, colorOptions] = await Promise.all([
    hardwareTypeDef ? getCharacteristicOptions(hardwareTypeDef.id) : Promise.resolve([]),
    colorDef ? getCharacteristicOptions(colorDef.id) : Promise.resolve([]),
  ]);

  return {
    model,
    versions: toProductModelVersionViews(versions),
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
    materialOptions: nomenclature
      .filter((row) => row.nomenclature_type === "MATERIAL")
      .map((row) => ({
        id: row.id,
        name: row.name,
        unit: row.unit,
        is_active: row.is_active,
      })),
    detailingItems,
    hardwareTypeOptions: hardwareTypeOptions.filter((row) => row.is_active),
    colorOptions: colorOptions.filter((row) => row.is_active),
  };
}

export type ProductModelDetailData = NonNullable<Awaited<ReturnType<typeof loadProductModelDetailData>>>;
