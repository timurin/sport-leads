import { notFound } from "next/navigation";

import { SalesOrderPage } from "@/components/sales/sales-order-page";
import { getOrderDetails, getOrderHistory } from "@/lib/sales/order-details";
import { getNomenclature, getNomenclatureVariants } from "@/lib/nomenclature";

type OrderRouteProps = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderRoute({ params }: OrderRouteProps) {
  const { orderId } = await params;
  const [result, historyResult, nomenclature] = await Promise.all([getOrderDetails(orderId), getOrderHistory(orderId), getNomenclature()]);
  if (result.kind === "not-found") notFound();
  if (result.kind === "error") throw new Error(result.message);
  if (historyResult.kind === "not-found") notFound();
  if (historyResult.kind === "error") throw new Error(historyResult.message);
  const ids = [...new Set(result.order.items.map((item) => item.nomenclatureId).filter((id): id is number => id !== null))];
  const variants = await Promise.all(ids.map(async (id) => [id, await getNomenclatureVariants(id)] as const));
  return <SalesOrderPage order={result.order} history={historyResult.history} nomenclature={nomenclature} variantsByNomenclature={Object.fromEntries(variants)} />;
}
