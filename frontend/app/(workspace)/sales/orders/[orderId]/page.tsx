import { notFound } from "next/navigation";

import {
  listOrderInvoices,
  listOrderQuotations,
} from "@/app/(workspace)/sales/orders/[orderId]/order-commercial-doc-actions";
import { SalesOrderPage } from "@/components/sales/sales-order-page";
import { getNomenclature, getNomenclatureCategories } from "@/lib/nomenclature";
import { getLeadDetails } from "@/lib/sales/lead-details";
import { fromApiLeadEvent } from "@/lib/sales/lead-history";
import {
  getOrderDetails,
  getOrderHistory,
  type SalesOrderSourceLead,
} from "@/lib/sales/order-details";
import { getVatRates } from "@/lib/vat-rates";

type OrderRouteProps = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderRoute({ params }: OrderRouteProps) {
  const { orderId } = await params;
  const [
    result,
    historyResult,
    nomenclature,
    nomenclatureCategories,
    vatRates,
    quotations,
    invoices,
  ] = await Promise.all([
      getOrderDetails(orderId),
      getOrderHistory(orderId),
      getNomenclature(),
      getNomenclatureCategories(),
      getVatRates({ is_active: true }),
      listOrderQuotations(orderId),
      listOrderInvoices(orderId),
    ]);
  if (result.kind === "not-found") notFound();
  if (result.kind === "error") throw new Error(result.message);
  if (historyResult.kind === "not-found") notFound();
  if (historyResult.kind === "error") throw new Error(historyResult.message);

  const sourceLeadDetails = await getLeadDetails(result.order.leadId);
  const sourceLead: SalesOrderSourceLead | null = sourceLeadDetails
    ? {
      id: sourceLeadDetails.id,
      contactName: sourceLeadDetails.contactName,
      customer: sourceLeadDetails.customer,
      messages: sourceLeadDetails.messages,
      primaryContact: sourceLeadDetails.customer.contacts.find((contact) => contact.isPrimary),
      tasks: sourceLeadDetails.tasks,
      taskReferenceAt: sourceLeadDetails.taskReferenceAt,
    }
    : null;

  return (
    <SalesOrderPage
      order={result.order}
      activities={historyResult.events.map(fromApiLeadEvent)}
      sourceLead={sourceLead}
      nomenclature={nomenclature}
      nomenclatureCategories={nomenclatureCategories}
      vatRates={vatRates}
      quotations={quotations}
      invoices={invoices}
    />
  );
}
