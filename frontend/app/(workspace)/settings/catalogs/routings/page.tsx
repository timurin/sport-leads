import { Suspense } from "react";

import { ShopRoutingsWorkspace } from "@/components/settings/shop-routings-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { getShopRoutings } from "@/lib/shop-routings";

export default async function ShopRoutingsListPage() {
  const routings = await getShopRoutings();

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка маршрутов…
          </div>
        }
      >
        <ShopRoutingsWorkspace routings={routings} />
      </Suspense>
    </PageLayout>
  );
}
