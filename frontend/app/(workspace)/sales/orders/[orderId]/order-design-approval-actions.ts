"use server";

import { revalidatePath } from "next/cache";

const apiBaseUrl = () =>
  (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export type DesignApprovalStatus =
  | "not_required"
  | "pending"
  | "in_review"
  | "approved"
  | "rejected";

export async function updateOrderDesignApproval(
  orderId: string,
  designApprovalStatus: DesignApprovalStatus,
) {
  const response = await fetch(
    `${apiBaseUrl()}/orders/${orderId}/design-approval`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ design_approval_status: designApprovalStatus }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    return {
      ok: false as const,
      message: payload?.detail ?? `Backend вернул ${response.status}.`,
    };
  }
  revalidatePath(`/sales/orders/${orderId}`);
  return { ok: true as const, message: "Согласование дизайна обновлено." };
}
