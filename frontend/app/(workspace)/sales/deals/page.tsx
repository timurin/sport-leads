import { redirect } from "next/navigation";

/** Demo Deal funnel retired (`1.3.3`): commercial path is SalesOrder. */
export default function DealsPage() {
  redirect("/sales/orders");
}
