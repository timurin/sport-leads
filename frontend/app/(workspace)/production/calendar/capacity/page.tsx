import { PageLayout } from "@/components/layout/page-layout";
import { CalendarCapacitySettings } from "@/components/production/calendar-capacity-settings";
import { getCapacityResources } from "@/lib/capacity-resources";
import { getProductionStages } from "@/lib/production-stages";
import { getWorkCenters } from "@/lib/shop-routings";
import { getTechOperations } from "@/lib/tech-operations";

export default async function CalendarCapacityPage() {
  const [operations, productionStages, resources, workCenters] = await Promise.all([
    getTechOperations(),
    getProductionStages({ active_only: true, limit: 500 }),
    getCapacityResources(),
    getWorkCenters({ active_only: true, limit: 500 }),
  ]);

  return (
    <PageLayout>
      <CalendarCapacitySettings
        operations={operations}
        productionStages={productionStages}
        resources={resources}
        workCenters={workCenters}
      />
    </PageLayout>
  );
}
