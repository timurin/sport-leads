"use server";

import { revalidatePath } from "next/cache";

import {
  postSewingEntryAction,
  postSewingTake,
} from "@/lib/production/sewing-cabinet-api";

export type SewingCabinetActionResult = {
  ok: boolean;
  message: string | null;
};

export async function takeSewingWorkAction(input: {
  technical_card_id: number;
  kind: "piece" | "operation";
  qty: string;
  operation_line_id?: number;
}): Promise<SewingCabinetActionResult> {
  const result = await postSewingTake(input);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/production/sewing-cabinet", "layout");
  return { ok: true, message: null };
}

export async function completeSewingWorkAction(
  entryId: number,
): Promise<SewingCabinetActionResult> {
  const result = await postSewingEntryAction(entryId, "complete");
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/production/sewing-cabinet", "layout");
  return { ok: true, message: null };
}

export async function releaseSewingWorkAction(
  entryId: number,
): Promise<SewingCabinetActionResult> {
  const result = await postSewingEntryAction(entryId, "release");
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/production/sewing-cabinet", "layout");
  return { ok: true, message: null };
}
