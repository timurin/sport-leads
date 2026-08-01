export type OrderDocumentNode = {
  id: string;
  label: string;
  href?: string;
  status?: "live" | "planned";
  children?: OrderDocumentNode[];
};

export type OrderCommercialDocSummary = {
  id: number;
  number: string;
  status: string;
  quotationId?: number | null;
};

export function buildOrderDocumentTree(order: {
  id: string;
  number: string;
  leadId: string;
  sourceLeadHref: string;
  quotations?: OrderCommercialDocSummary[];
  invoices?: OrderCommercialDocSummary[];
}): OrderDocumentNode[] {
  const quotations = order.quotations ?? [];
  const invoices = order.invoices ?? [];

  const quotationNodes: OrderDocumentNode[] =
    quotations.length === 0
      ? [
          {
            id: "quotation-empty",
            label: "КП (пока нет)",
            status: "planned",
          },
        ]
      : quotations.map((doc) => ({
          id: `quotation-${doc.id}`,
          label: `КП ${doc.number}`,
          status: "live" as const,
        }));

  const invoiceNodes: OrderDocumentNode[] =
    invoices.length === 0
      ? [
          {
            id: "invoice-empty",
            label: "Счёт на оплату (пока нет)",
            status: "planned",
          },
        ]
      : invoices.map((doc) => ({
          id: `invoice-${doc.id}`,
          label: `Счёт ${doc.number}`,
          status: "live" as const,
          children: doc.quotationId
            ? [
                {
                  id: `invoice-${doc.id}-from-kp`,
                  label: `из КП #${doc.quotationId}`,
                  status: "live" as const,
                },
              ]
            : undefined,
        }));

  return [
    {
      id: "lead",
      label: `Лид #${order.leadId}`,
      href: order.sourceLeadHref,
      status: "live",
      children: [
        {
          id: "order",
          label: `Заказ ${order.number}`,
          href: `/sales/orders/${order.id}`,
          status: "live",
          children: [
            ...quotationNodes,
            ...invoiceNodes,
            {
              id: "waybill",
              label: "Товарная накладная",
              status: "planned",
            },
          ],
        },
        {
          id: "production-order",
          label: "Заказ на производство",
          status: "planned",
          children: [
            { id: "tech-card-1", label: "Тех карта 1", status: "planned" },
            { id: "tech-card-2", label: "Тех карта 2", status: "planned" },
          ],
        },
        {
          id: "specification",
          label: "Спецификация",
          status: "planned",
        },
      ],
    },
  ];
}
