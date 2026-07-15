import { EntityWorkspace } from "@/components/entity/entity-workspace";
import { clientRecords } from "@/lib/demo-data/clients";
import { clientsDefinition } from "@/lib/entity/definitions/clients";

export default function ClientsPage() {
  return (
    <EntityWorkspace
      definition={clientsDefinition}
      records={clientRecords}
    />
  );
}