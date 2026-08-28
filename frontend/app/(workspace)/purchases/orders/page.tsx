import { PurchaseOrdersWorkspace } from "@/components/purchases/purchase-orders-workspace";
import { getPurchaseOrdersList } from "@/lib/purchases/purchase-orders-api";
import { getSuppliersList } from "@/lib/purchases/suppliers-api";
import { getWarehouses } from "@/lib/warehouses";

export default async function PurchasesOrdersPage() {
  const [ordersResult, suppliersResult, warehouses] = await Promise.all([
    getPurchaseOrdersList(),
    getSuppliersList(true),
    getWarehouses({ limit: 500 }).catch(() => []),
  ]);

  return (
    <PurchaseOrdersWorkspace
      orders={ordersResult.ok ? ordersResult.items : []}
      suppliers={
        suppliersResult.ok
          ? suppliersResult.items.map((item) => ({
              id: item.id,
              name: item.name,
            }))
          : []
      }
      warehouses={warehouses
        .filter((item) => item.is_active)
        .map((item) => ({ id: item.id, name: item.name }))}
      loadError={ordersResult.ok ? undefined : ordersResult.message}
    />
  );
}
