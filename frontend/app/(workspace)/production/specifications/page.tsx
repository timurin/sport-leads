import { SpecificationsWorkspace } from "@/components/production/specifications-workspace";
import { getSpecificationsList } from "@/lib/production/specifications-api";

export default async function ProductionSpecificationsPage() {
  const result = await getSpecificationsList({ limit: 500 });
  return (
    <SpecificationsWorkspace
      specifications={result.ok ? result.items : []}
      loadError={result.ok ? undefined : result.message}
    />
  );
}
