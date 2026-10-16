"use server";

import { readEquipmentLoads } from "@/lib/work-center-load";
import { periodDates, type EquipmentLoad } from "@/lib/tech-operation-ux";

export async function loadEquipmentPeriod(
  workCenterIds: number[],
  anchor: string,
  period: "today" | "week",
): Promise<EquipmentLoad[]> {
  return readEquipmentLoads(workCenterIds, periodDates(anchor, period));
}
