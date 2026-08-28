import { SuppliersWorkspace } from "@/components/purchases/suppliers-workspace";
import { getSuppliersList } from "@/lib/purchases/suppliers-api";

export default async function PurchasesSuppliersPage() {
  const result = await getSuppliersList(false);
  return (
    <SuppliersWorkspace
      suppliers={result.ok ? result.items : []}
      loadError={result.ok ? undefined : result.message}
    />
  );
}
