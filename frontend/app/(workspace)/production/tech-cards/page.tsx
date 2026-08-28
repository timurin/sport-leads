import { Suspense } from "react";

import { TechCardsWorkspace } from "@/components/production/tech-cards-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { getNomenclature } from "@/lib/nomenclature";
import { fetchTechnicalCards } from "@/lib/sales/order-tech-cards-api";

async function loadCards(orderId: string | undefined) {
  try {
    const cards = await fetchTechnicalCards(
      orderId ? { sales_order_id: orderId, limit: 500 } : { limit: 500 },
    );
    return { ok: true as const, cards, message: null };
  } catch (error) {
    return {
      ok: false as const,
      cards: [],
      message: error instanceof Error ? error.message : "Не удалось загрузить техкарты",
    };
  }
}

async function loadProductNomenclatures() {
  try {
    const rows = await getNomenclature();
    return rows
      .filter((row) => row.nomenclature_type === "PRODUCT" && row.is_active)
      .map((row) => ({ id: row.id, name: row.name }));
  } catch {
    return [];
  }
}

export default async function ProductionTechCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const params = await searchParams;
  const orderId = params.orderId?.trim() || undefined;
  const [state, productNomenclatures] = await Promise.all([
    loadCards(orderId),
    loadProductNomenclatures(),
  ]);

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      {!state.ok ? (
        <div
          className="p-portal-6 text-portal-body text-portal-danger"
          role="alert"
        >
          {state.message ?? "Не удалось загрузить техкарты"}
        </div>
      ) : null}
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка техкарт…
          </div>
        }
      >
        <TechCardsWorkspace
          cards={state.cards}
          orderId={orderId}
          productNomenclatures={productNomenclatures}
        />
      </Suspense>
    </PageLayout>
  );
}
