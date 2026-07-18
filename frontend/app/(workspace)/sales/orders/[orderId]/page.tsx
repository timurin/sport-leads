import { notFound } from "next/navigation";

import { SalesOrderPage } from "@/components/sales/sales-order-page";
import { getOrderDetails, getOrderHistory } from "@/lib/sales/order-details";

type OrderRouteProps = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderRoute({ params }: OrderRouteProps) {
  const { orderId } = await params;
  const [result, historyResult] = await Promise.all([getOrderDetails(orderId), getOrderHistory(orderId)]);
  if (result.kind === "not-found") notFound();
  if (result.kind === "error") throw new Error(result.message);
  if (historyResult.kind === "not-found") notFound();
  if (historyResult.kind === "error") throw new Error(historyResult.message);
  return <SalesOrderPage order={result.order} history={historyResult.history} />;
}
