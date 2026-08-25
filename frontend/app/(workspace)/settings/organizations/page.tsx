import { OrganizationsWorkspace } from "@/components/settings/organizations-workspace";
import { getOrganizationsList } from "@/lib/settings/organizations-api";

export default async function OrganizationsPage() {
  const result = await getOrganizationsList(false);
  return (
    <OrganizationsWorkspace
      organizations={result.ok ? result.items : []}
      loadError={result.ok ? undefined : result.message}
    />
  );
}
