import "server-only";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import { readCapacityResource, type CapacityResource } from "@/lib/tech-operation-capacity";

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

export async function getCapacityResources(): Promise<CapacityResource[]> {
  const response = await fetch(`${apiBaseUrl()}/production-calendar/capacity/resources`, {
    headers: await sessionAuthHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить ресурсы мощности (${response.status}).`);
  }
  const rows = (await response.json()) as unknown[];
  return rows.map(readCapacityResource);
}
