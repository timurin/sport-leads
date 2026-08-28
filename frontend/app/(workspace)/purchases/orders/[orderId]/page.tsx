import Link from "next/link";
import { notFound } from "next/navigation";

import { PurchaseOrderCard } from "@/components/purchases/purchase-order-card";
import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { getNomenclature } from "@/lib/nomenclature";
import { getPurchaseOrderDetail } from "@/lib/purchases/purchase-orders-api";
import { getWarehouses } from "@/lib/warehouses";

type Props = {
  params: Promise<{ orderId: string }>;
};

export default async function PurchaseOrderPage({ params }: Props) {
  const { orderId } = await params;
  const result = await getPurchaseOrderDetail(orderId);
  if (!result.ok && result.notFound) {
    notFound();
  }
  if (!result.ok || result.order === null) {
    return (
      <PageLayout>
        <PageContent size="spacious">
          <section className="rounded-portal-lg border border-portal-border bg-portal-surface p-portal-6">
            <h1 className="text-portal-page font-semibold text-portal-text">
              Не удалось загрузить заказ поставщику
            </h1>
            <p className="mt-portal-2 text-portal-body text-portal-muted">
              {result.message}
            </p>
            <p className="mt-portal-4">
              <Link
                href="/purchases/orders"
                className="font-semibold text-portal-primary hover:underline"
              >
                К списку заказов
              </Link>
            </p>
          </section>
        </PageContent>
      </PageLayout>
    );
  }

  let nomenclatureOptions: { id: number; name: string }[] = [];
  try {
    const items = await getNomenclature();
    nomenclatureOptions = items
      .filter((item) => item.is_active)
      .map((item) => ({ id: item.id, name: item.name }));
  } catch {
    nomenclatureOptions = [];
  }

  let warehouses: { id: number; name: string }[] = [];
  try {
    const items = await getWarehouses({ limit: 500 });
    warehouses = items
      .filter((item) => item.is_active)
      .map((item) => ({ id: item.id, name: item.name }));
  } catch {
    warehouses = [];
  }

  return (
    <PurchaseOrderCard
      order={result.order}
      nomenclatureOptions={nomenclatureOptions}
      warehouses={warehouses}
    />
  );
}
