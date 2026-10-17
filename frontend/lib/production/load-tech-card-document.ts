import { getTechnicalCardProductionDiagnostics, getTechnicalCardRouteVariants } from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import type { TechCardDetailWorkspaceProps } from "@/components/production/tech-card-detail-workspace";
import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import { getMe } from "@/lib/auth/session";
import { hasPermission, PERM_SIZE_GRIDS_WRITE } from "@/lib/auth/session-mapping";
import { getNomenclature } from "@/lib/nomenclature";
import { getProductModelById } from "@/lib/product-models";
import { loadPlatformDebugMode } from "@/lib/platform-brand";
import { parseTechnicalCardReadiness } from "@/lib/production/tech-card-readiness";
import { fetchTechnicalCard, fetchTechnicalCardReadiness } from "@/lib/sales/order-tech-cards-api";
import { getProductionStages } from "@/lib/production-stages";
import { getShopRoutings, getWorkCenters } from "@/lib/shop-routings";
import { getSizeGrid } from "@/lib/size-grids";

export async function loadTechnicalCardDocument(
  cardId: number,
  options?: { listOrderId?: string; shopStageCode?: string },
): Promise<TechCardDetailWorkspaceProps | null> {
  let card;
  try {
    card = await fetchTechnicalCard(cardId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("404") || message.toLowerCase().includes("not found")) return null;
    throw error;
  }

  let routings: TechCardDetailWorkspaceProps["routings"] = [];
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

  let materials: TechCardDetailWorkspaceProps["materials"] = [];
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

  let productionStages: TechCardDetailWorkspaceProps["productionStages"] = [];
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

  let workCenters: TechCardDetailWorkspaceProps["workCenters"] = [];
  try {
    workCenters = await getWorkCenters({ active_only: false, limit: 500 });
  } catch {
    workCenters = [];
  }

  let routeVariants: TechCardDetailWorkspaceProps["routeVariants"] = [];
  try {
    routeVariants = await getTechnicalCardRouteVariants(cardId);
  } catch {
    routeVariants = [];
  }

  let productionDiagnostics: TechCardDetailWorkspaceProps["productionDiagnostics"] = [];
  try {
    productionDiagnostics = await getTechnicalCardProductionDiagnostics(cardId);
  } catch {
    productionDiagnostics = [];
  }

  let unitSizeGrid = null;
  if (card.product_model_id != null) {
    try {
      const productModel = await getProductModelById(card.product_model_id);
      if (productModel?.size_grid_id != null) unitSizeGrid = await getSizeGrid(productModel.size_grid_id);
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

  return {
    card,
    readiness,
    debugMode: await loadPlatformDebugMode(),
    canEditModelNorms: hasPermission(me, PERM_SIZE_GRIDS_WRITE),
    routings,
    materials,
    productionStages,
    listOrderId: options?.listOrderId,
    shopStageCode: options?.shopStageCode,
    workCenters,
    unitSizeGrid,
    routeVariants,
    productionDiagnostics,
  };
}
