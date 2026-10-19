import { notFound } from "next/navigation";

import { TechCardDetailWorkspace } from "@/components/production/tech-card-detail-workspace";
import { loadTechnicalCardDocument } from "@/lib/production/load-tech-card-document";
import { getShopStageModule } from "@/lib/production/shop-stage-modules";

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
  searchParams: Promise<{ orderId?: string; stage?: string }>;
}) {
  const { id: rawId } = await params;
  const cardId = parseCardId(rawId);
  if (cardId == null) notFound();

  const query = await searchParams;
  const document = await loadTechnicalCardDocument(cardId, {
    listOrderId: query.orderId?.trim() || undefined,
    shopStageCode: getShopStageModule(query.stage?.trim() ?? "")?.code,
  });
  if (!document) notFound();

  return <TechCardDetailWorkspace {...document} />;
}
