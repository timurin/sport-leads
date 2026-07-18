import { LeadWorkspace } from "@/components/sales/lead-workspace";
import { getLeadList } from "@/lib/sales/lead-list-api";
import { getLeadStages } from "@/lib/sales/lead-stage-api";

export default async function LeadsPage() {
  const [leadList, leadStages] = await Promise.all([getLeadList(), getLeadStages()]);
  const loadError = [
    leadList.ok ? null : leadList.message,
    leadStages.ok ? null : leadStages.message,
  ].filter(Boolean).join(" ") || undefined;
  return (
    <LeadWorkspace
      initialLeads={leadList.leads}
      initialStages={leadStages.stages}
      dataOrigin={leadList.source}
      loadError={loadError}
    />
  );
}
