import { notFound } from "next/navigation";

import { SalesOrderPage } from "@/components/sales/sales-order-page";
import { getOrderDetails } from "@/lib/sales/order-details";

type OrderRouteProps = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderRoute({ params }: OrderRouteProps) {
  const { orderId } = await params;
  const result = await getOrderDetails(orderId);
  if (result.kind === "not-found") notFound();
  if (result.kind === "error") throw new Error(result.message);
  return <SalesOrderPage order={result.order} />;
}
