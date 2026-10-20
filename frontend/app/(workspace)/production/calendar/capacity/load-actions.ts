"use server";

import { readEquipmentLoads } from "@/lib/work-center-load";
import { capacityLoadDates } from "@/lib/production/capacity-live";
import type { EquipmentLoad } from "@/lib/tech-operation-ux";

export async function loadEquipmentDay(workCenterIds: number[], date: string): Promise<EquipmentLoad[]> {
  return readEquipmentLoads(workCenterIds, capacityLoadDates(date));
}
