import "server-only";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import type { EquipmentLoad } from "@/lib/tech-operation-ux";

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

function decimal(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return value;
  return null;
}

export async function readEquipmentLoads(workCenterIds: number[], dates: string[]): Promise<EquipmentLoad[]> {
  const headers = await sessionAuthHeaders();
  const uniqueIds = [...new Set(workCenterIds)];
  const uniqueDates = [...new Set(dates)];
  const rows = await Promise.all(uniqueIds.flatMap((workCenterId) => uniqueDates.map((date) => readEquipmentLoad(headers, workCenterId, date))));
  return rows.filter((row): row is EquipmentLoad => row != null);
}

async function readEquipmentLoad(headers: HeadersInit, workCenterId: number, date: string): Promise<EquipmentLoad | null> {
  const response = await fetch(
    `${apiBaseUrl()}/work-centers/${workCenterId}/capacity/load?date=${date}`,
    { headers, cache: "no-store" },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Не удалось загрузить занятость оборудования (${response.status}).`);
  }
  const body = (await response.json()) as Record<string, unknown>;
  const allocated = decimal(body.allocated);
  if (allocated == null) {
    throw new Error("Ответ API не содержит занятость оборудования.");
  }
  return {
    work_center_id: workCenterId,
    date,
    configured_capacity: decimal(body.configured_capacity),
    allocated,
    remaining: decimal(body.remaining),
    utilization_percent: decimal(body.utilization_percent),
    capacity_unit: typeof body.capacity_unit === "string" ? body.capacity_unit : null,
  };
}
