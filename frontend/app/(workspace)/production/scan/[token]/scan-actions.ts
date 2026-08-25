"use server";

import { revalidatePath } from "next/cache";

import { postTechCardScanCommand } from "@/lib/production/tech-card-scan-api";
import type { TechCardScanCommand } from "@/lib/production/tech-card-scan";

export async function runTechCardScanCommandAction(
  token: string,
  action: "accept" | "complete-transfer" | "return",
  payload: TechCardScanCommand,
) {
  const result = await postTechCardScanCommand(token, action, payload);
  if (result.ok) {
    revalidatePath(`/production/scan/${token}`, "page");
  }
  return result;
}
