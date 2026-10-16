"use server";

import { revalidatePath } from "next/cache";
import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import { markTechnicalCardShipped } from "@/lib/sales/order-tech-cards-api";

export async function shipTechnicalCardAction(id: number): Promise<{ error: string | null }> {
  try {
    await markTechnicalCardShipped(id, await sessionAuthHeaders());
    for (const path of ["/production/stages/ready_to_ship", "/production/stages/shipped",
      "/production/tech-cards", `/production/tech-cards/${id}`, "/production/kanban"]) {
      revalidatePath(path);
    }
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Не удалось подтвердить отгрузку" };
  }
}
