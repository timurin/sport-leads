import { Suspense } from "react";

import { PageLayout } from "@/components/layout/page-layout";
import { NomenclatureCategoriesWorkspace } from "@/components/settings/nomenclature-categories-workspace";
import { getNomenclatureCategories } from "@/lib/nomenclature";

export default async function NomenclatureCategoriesPage() {
  const categories = await getNomenclatureCategories();

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка категорий…
          </div>
        }
      >
        <NomenclatureCategoriesWorkspace categories={categories} />
      </Suspense>
    </PageLayout>
  );
}
