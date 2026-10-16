import { notFound } from "next/navigation";

import { getTechnicalCardProductionDiagnostics, getTechnicalCardRouteVariants } from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import { getMe } from "@/lib/auth/session";
import { hasPermission, PERM_SIZE_GRIDS_WRITE } from "@/lib/auth/session-mapping";
import { TechCardDetailWorkspace } from "@/components/production/tech-card-detail-workspace";
import { getNomenclature } from "@/lib/nomenclature";
import { getProductModelById } from "@/lib/product-models";
import { getShopStageModule } from "@/lib/production/shop-stage-modules";
import { getProductionStages } from "@/lib/production-stages";
import { loadPlatformDebugMode } from "@/lib/platform-brand";
import { parseTechnicalCardReadiness } from "@/lib/production/tech-card-readiness";
import { fetchTechnicalCard, fetchTechnicalCardReadiness } from "@/lib/sales/order-tech-cards-api";
import { getShopRoutings, getWorkCenters } from "@/lib/shop-routings";
import { getSizeGrid } from "@/lib/size-grids";

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
  const listOrderId = query.orderId?.trim() || undefined;
  const shopStageCode = getShopStageModule(query.stage?.trim() ?? "")?.code;

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

  let routings: { id: number; name: string; code: string | null; is_active: boolean }[] =
    [];
  try {
    const templates = await getShopRoutings({ active_only: false, limit: 500 });
    routings = templates.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      is_active: row.is_active,
    }));
  } catch {
    routings = [];
  }

  let materials: {
    id: number;
    name: string;
    unit: string;
    is_active: boolean;
  }[] = [];
  try {
    const nomenclature = await getNomenclature();
    materials = nomenclature
      .filter((row) => row.nomenclature_type === "MATERIAL")
      .map((row) => ({
        id: row.id,
        name: row.name,
        unit: row.unit,
        is_active: row.is_active,
      }));
  } catch {
    materials = [];
  }

  let productionStages: {
    id: number;
    name: string;
    code: string;
    is_active: boolean;
  }[] = [];
  try {
    const stages = await getProductionStages({ active_only: false, limit: 500 });
    productionStages = stages.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      is_active: row.is_active,
    }));
  } catch {
    productionStages = [];
  }

  let workCenters: Awaited<ReturnType<typeof getWorkCenters>> = [];
  try {
    workCenters = await getWorkCenters({ active_only: false, limit: 500 });
  } catch {
    workCenters = [];
  }

  let routeVariants: Awaited<ReturnType<typeof getTechnicalCardRouteVariants>> = [];
  try {
    routeVariants = await getTechnicalCardRouteVariants(cardId);
  } catch {
    routeVariants = [];
  }

  let productionDiagnostics: Awaited<ReturnType<typeof getTechnicalCardProductionDiagnostics>> = [];
  try {
    productionDiagnostics = await getTechnicalCardProductionDiagnostics(cardId);
  } catch {
    productionDiagnostics = [];
  }

  let unitSizeGrid = null;
  if (card.product_model_id != null) {
    try {
      const productModel = await getProductModelById(card.product_model_id);
      if (productModel?.size_grid_id != null) {
        unitSizeGrid = await getSizeGrid(productModel.size_grid_id);
      }
    } catch {
      unitSizeGrid = null;
    }
  }

  const me = await getMe();
  const auth = await sessionAuthHeaders();
  let readiness = null;
  try {
    readiness = parseTechnicalCardReadiness(await fetchTechnicalCardReadiness(cardId, auth));
  } catch {
    readiness = null;
  }
  const debugMode = await loadPlatformDebugMode();

  return (
    <TechCardDetailWorkspace
      card={card}
      readiness={readiness}
      debugMode={debugMode}
      canEditModelNorms={hasPermission(me, PERM_SIZE_GRIDS_WRITE)}
      routings={routings}
      materials={materials}
      productionStages={productionStages}
      listOrderId={listOrderId}
      shopStageCode={shopStageCode}
      workCenters={workCenters}
      unitSizeGrid={unitSizeGrid}
      routeVariants={routeVariants}
      productionDiagnostics={productionDiagnostics}
    />
  );
}
