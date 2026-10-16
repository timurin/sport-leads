"use server";

import { revalidatePath } from "next/cache";

import { calendarPathsAfterSchedule } from "@/lib/production/tech-card-schedule";
import {
  loadWorkshopQueues,
  postWorkshopQueueApply,
  postWorkshopQueuePreview,
} from "@/lib/production/workshop-queue-api";

export async function refreshWorkshopQueuesAction(workshopIds: number[]) {
  return loadWorkshopQueues(workshopIds);
}

export async function previewWorkshopQueueAction(
  workshopId: number,
  body: { revision: string; ordered_snapshot_node_ids: number[] },
) {
  return postWorkshopQueuePreview(workshopId, body);
}

export async function applyWorkshopQueueAction(
  workshopId: number,
  body: { revision: string; ordered_snapshot_node_ids: number[]; preview_fingerprint: string },
) {
  const result = await postWorkshopQueueApply(workshopId, body);
  if (result.ok) {
    for (const path of calendarPathsAfterSchedule()) revalidatePath(path);
    revalidatePath("/production/tech-cards");
  }
  return result;
}
