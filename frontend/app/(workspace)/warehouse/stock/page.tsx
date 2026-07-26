import { Suspense } from "react";

import { WarehouseNomenclatureWorkspace } from "@/components/warehouse/warehouse-nomenclature-workspace";
import { PageLoadingState } from "@/components/ui/page-state";
import { loadWarehouseNomenclatureCatalog } from "@/lib/warehouse-nomenclature";

export default async function WarehouseStockPage() {
  const catalog = await loadWarehouseNomenclatureCatalog();

  return (
    <Suspense fallback={<PageLoadingState label="Загрузка номенклатуры…" />}>
      <WarehouseNomenclatureWorkspace {...catalog} />
    </Suspense>
  );
}
