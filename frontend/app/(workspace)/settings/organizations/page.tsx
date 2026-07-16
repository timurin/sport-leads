import { EntityWorkspace } from "@/components/entity/entity-workspace";
import { organizationRecords } from "@/lib/demo-data/catalogs";
import { organizationsDefinition } from "@/lib/entity/definitions/organizations";

export default function OrganizationsPage() {
  return (
    <EntityWorkspace
      definition={organizationsDefinition}
      records={organizationRecords}
    />
  );
}