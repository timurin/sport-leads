import { LeadPageState } from "@/components/sales/lead-page-state";

export default function LeadNotFound() {
  return (
    <LeadPageState
      title="Лид не найден"
      description="Лид с указанным идентификатором не существует или был удалён."
    />
  );
}
