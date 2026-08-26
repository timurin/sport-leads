import { LeadPageSkeleton } from "@/components/sales/lead-page-skeleton";
import { LeadCardSlider } from "@/components/sales/lead-card-slider";

export default function LoadingLead() {
  return (
    <LeadCardSlider>
      <LeadPageSkeleton />
    </LeadCardSlider>
  );
}
