import { notFound } from "next/navigation";

import { TechCardDetailWorkspace } from "@/components/production/tech-card-detail-workspace";
import { fetchTechnicalCard, fetchTechnicalCards } from "@/lib/sales/order-tech-cards-api";

function parseCardId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}

export default async function ProductionTechCardDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { id: rawId } = await params;
  const cardId = parseCardId(rawId);
  if (cardId == null) notFound();

  const query = await searchParams;
  const listOrderId = query.orderId?.trim() || undefined;

  let card;
  try {
    card = await fetchTechnicalCard(cardId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("404") || message.toLowerCase().includes("not found")) {
      notFound();
    }
    throw error;
  }

  let orderNumber: string | null = null;
  try {
    const listRows = await fetchTechnicalCards({
      sales_order_id: card.sales_order_id,
      limit: 500,
    });
    orderNumber =
      listRows.find((row) => row.id === card.id)?.order_number ??
      listRows[0]?.order_number ??
      null;
  } catch {
    orderNumber = null;
  }

  return (
    <TechCardDetailWorkspace
      card={card}
      orderNumber={orderNumber}
      listOrderId={listOrderId}
    />
  );
}
