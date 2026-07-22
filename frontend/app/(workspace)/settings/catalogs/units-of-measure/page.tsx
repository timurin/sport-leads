import { Suspense } from "react";

import { PageLayout } from "@/components/layout/page-layout";
import { UnitsOfMeasureWorkspace } from "@/components/settings/units-of-measure-workspace";
import { getUnitsOfMeasure } from "@/lib/nomenclature";

export default async function UnitsOfMeasurePage() {
  const units = await getUnitsOfMeasure();

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка единиц…
          </div>
        }
      >
        <UnitsOfMeasureWorkspace units={units} />
      </Suspense>
    </PageLayout>
  );
}
