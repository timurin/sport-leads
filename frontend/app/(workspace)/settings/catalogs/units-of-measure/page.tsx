import { Suspense } from "react";

import { UnitsOfMeasureWorkspace } from "@/components/settings/units-of-measure-workspace";
import { getUnitsOfMeasure } from "@/lib/nomenclature";

export default async function UnitsOfMeasurePage() {
  const units = await getUnitsOfMeasure();

  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-slate-500">Загрузка единиц…</div>
      }
    >
      <UnitsOfMeasureWorkspace units={units} />
    </Suspense>
  );
}
