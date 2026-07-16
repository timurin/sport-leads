import { ClientsTable } from "@/components/tables/clients-table";
import { clients } from "@/lib/demo-data/sales";

export default function ClientsPage() {
  return <ClientsTable clients={clients} />;
}
