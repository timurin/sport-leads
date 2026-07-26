import { Suspense } from "react";

import { TechCardsWorkspace } from "@/components/production/tech-cards-workspace";
import { PageLayout } from "@/components/layout/page-layout";
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

export default async function ProductionTechCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const params = await searchParams;
  const orderId = params.orderId?.trim() || undefined;
  const state = await loadCards(orderId);

  if (!state.ok) {
    throw new Error(state.message ?? "Не удалось загрузить техкарты");
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка техкарт…
          </div>
        }
      >
        <TechCardsWorkspace cards={state.cards} orderId={orderId} />
      </Suspense>
    </PageLayout>
  );
}
