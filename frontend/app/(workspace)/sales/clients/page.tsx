import { ClientsTable } from "@/components/tables/clients-table";
import { getClientList } from "@/lib/sales/client-list-api";

export default async function ClientsPage() {
  const clientList = await getClientList();
  return (
    <ClientsTable
      clients={clientList.clients}
      loadError={clientList.ok ? undefined : clientList.message}
    />
  );
}
