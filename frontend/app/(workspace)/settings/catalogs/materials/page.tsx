import { EntityWorkspace } from "@/components/entity/entity-workspace";
import { materialRecords } from "@/lib/demo-data/catalogs";
import { materialsDefinition } from "@/lib/entity/definitions/materials";

export default function MaterialsPage() {
  return (
    <EntityWorkspace
      definition={materialsDefinition}
      records={materialRecords}
    />
  );
}