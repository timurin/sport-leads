import { PageLayout } from "@/components/layout/page-layout";
import { CalendarCapacitySettings } from "@/components/production/calendar-capacity-settings";
import { getCapacityResources } from "@/lib/capacity-resources";
import { getProductionStages } from "@/lib/production-stages";
import { getWorkCenters } from "@/lib/shop-routings";
import { localIsoDate } from "@/lib/tech-operation-ux";
import { getTechOperations } from "@/lib/tech-operations";
import { readEquipmentLoads } from "@/lib/work-center-load";

export default async function CalendarCapacityPage() {
  const [operations, productionStages, resources, workCenters] = await Promise.all([
    getTechOperations(),
    getProductionStages({ active_only: true, limit: 500 }),
    getCapacityResources(),
    getWorkCenters({ active_only: true, limit: 500 }),
  ]);
  const today = localIsoDate(new Date());
  const workCenterIds = resources.map((resource) => resource.work_center_id).filter((id): id is number => id != null);
  let initialLoads: Awaited<ReturnType<typeof readEquipmentLoads>> = [];
  let initialLoadError = "";
  try {
    initialLoads = await readEquipmentLoads(workCenterIds, [today]);
  } catch (error) {
    initialLoadError = error instanceof Error ? error.message : "Не удалось загрузить занятость оборудования.";
  }

  return (
    <PageLayout>
      <CalendarCapacitySettings
        operations={operations}
        productionStages={productionStages}
        resources={resources}
        workCenters={workCenters}
        initialLoads={initialLoads}
        initialDate={today}
        initialLoadError={initialLoadError}
      />
    </PageLayout>
  );
}
