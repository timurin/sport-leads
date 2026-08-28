"use server";

import { revalidatePath } from "next/cache";

import {
  replaceProductModelMaterialLinesApi,
  type ProductModelMaterialLine,
  type ProductModelMaterialLineWrite,
} from "@/lib/product-model-materials";

export type ModelMaterialsActionResult =
  | { ok: true; lines: ProductModelMaterialLine[] }
  | { ok: false; message: string };

export async function replaceProductModelMaterialLinesAction(
  modelId: number,
  lines: ProductModelMaterialLineWrite[],
): Promise<ModelMaterialsActionResult> {
  try {
    const next = await replaceProductModelMaterialLinesApi(modelId, lines);
    revalidatePath(`/settings/catalogs/product-models/${modelId}`);
    revalidatePath("/settings/catalogs/product-models");
    return { ok: true, lines: next };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось сохранить материалы модели",
    };
  }
}
