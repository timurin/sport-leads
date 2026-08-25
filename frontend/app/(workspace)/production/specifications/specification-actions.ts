"use server";

import { revalidatePath } from "next/cache";

import {
  approveSpecificationApi,
  cancelSpecificationDraftApi,
  createSpecificationApi,
  createSpecificationNextDraftApi,
  refreshSpecificationApi,
} from "@/lib/production/specifications-api";
import type { SpecificationDetail } from "@/lib/production/specifications";

export type SpecificationActionResult =
  | { ok: true; specification: SpecificationDetail }
  | { ok: false; message: string };

function revalidateSpecificationPaths(
  specification?: SpecificationDetail | null,
) {
  revalidatePath("/production/specifications");
  if (specification != null) {
    revalidatePath(`/production/specifications/${specification.id}`);
    revalidatePath(`/production/orders/${specification.production_order_id}`);
  }
}

export async function createSpecificationAction(
  productionBatchId: number,
): Promise<SpecificationActionResult> {
  if (!Number.isSafeInteger(productionBatchId) || productionBatchId <= 0) {
    return { ok: false, message: "Укажите корректный ID партии" };
  }
  const result = await createSpecificationApi(productionBatchId);
  if (!result.ok) return result;
  revalidateSpecificationPaths(result.specification);
  return result;
}

export async function refreshSpecificationAction(
  specificationId: number,
): Promise<SpecificationActionResult> {
  const result = await refreshSpecificationApi(specificationId);
  if (!result.ok) return result;
  revalidateSpecificationPaths(result.specification);
  return result;
}

export async function createSpecificationNextDraftAction(
  specificationId: number,
): Promise<SpecificationActionResult> {
  const result = await createSpecificationNextDraftApi(specificationId);
  if (!result.ok) return result;
  revalidateSpecificationPaths(result.specification);
  return result;
}

export async function approveSpecificationAction(
  specificationId: number,
): Promise<SpecificationActionResult> {
  const result = await approveSpecificationApi(specificationId);
  if (!result.ok) return result;
  revalidateSpecificationPaths(result.specification);
  return result;
}

export async function cancelSpecificationDraftAction(
  specificationId: number,
): Promise<SpecificationActionResult> {
  const result = await cancelSpecificationDraftApi(specificationId);
  if (!result.ok) return result;
  revalidateSpecificationPaths(result.specification);
  return result;
}
