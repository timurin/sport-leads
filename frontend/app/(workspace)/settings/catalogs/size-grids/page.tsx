import { Suspense } from "react";

import { SizeGridsWorkspace } from "@/components/settings/size-grids-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { getSizeGrids } from "@/lib/size-grids";

export default async function SizeGridsListPage() {
  const grids = await getSizeGrids();

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка размерных сеток…
          </div>
        }
      >
        <SizeGridsWorkspace grids={grids} />
      </Suspense>
    </PageLayout>
  );
}
