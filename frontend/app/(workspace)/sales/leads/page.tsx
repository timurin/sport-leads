import { LeadWorkspace } from "@/components/sales/lead-workspace";
import { getLeadList } from "@/lib/sales/lead-list-api";

export default async function LeadsPage() {
  const leadList = await getLeadList();
  return (
    <LeadWorkspace
      initialLeads={leadList.leads}
      dataOrigin={leadList.source}
      loadError={leadList.ok ? undefined : leadList.message}
    />
  );
}
