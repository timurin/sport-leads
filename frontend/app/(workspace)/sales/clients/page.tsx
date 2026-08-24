import { ClientsTable } from "@/components/tables/clients-table";
import { getClientFolders } from "@/lib/sales/client-folders-api";
import { getClientList } from "@/lib/sales/client-list-api";

export default async function ClientsPage() {
  const [clientList, folders] = await Promise.all([
    getClientList(),
    getClientFolders(),
  ]);
  return (
    <ClientsTable
      clients={clientList.clients}
      folders={folders.folders}
      loadError={clientList.ok ? undefined : clientList.message}
      foldersError={folders.ok ? undefined : folders.message}
    />
  );
}
