"use server";

import {
  getNomenclatureAvailableModels,
  type NomenclatureAvailableModel,
} from "@/lib/nomenclature";
import {
  getProductModelAssemblyVariants,
  type AssemblyVariant,
} from "@/lib/product-models";

/** Server-side fetch — avoids browser CORS to the FastAPI origin. */
export async function loadNomenclatureAvailableModels(
  nomenclatureId: number,
): Promise<NomenclatureAvailableModel[]> {
  try {
    return await getNomenclatureAvailableModels(nomenclatureId);
  } catch {
    return [];
  }
}

/** Active assembly variants for order-line picker (`3.2.5.4`). */
export async function loadProductModelActiveAssemblyVariants(
  modelId: number,
): Promise<AssemblyVariant[]> {
  try {
    return await getProductModelAssemblyVariants(modelId, { activeOnly: true });
  } catch {
    return [];
  }
}
