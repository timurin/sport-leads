import { redirect } from "next/navigation";

/** Inventory host is `/warehouse/movements` (`12.4.1.5` / ADR-019). */
export default function WarehouseInventoryPage() {
  redirect("/warehouse/movements");
}
