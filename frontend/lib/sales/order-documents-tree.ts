export type OrderDocumentNode = {
  id: string;
  label: string;
  href?: string;
  status?: "live" | "planned";
  children?: OrderDocumentNode[];
};

export function buildOrderDocumentTree(order: {
  id: string;
  number: string;
  leadId: string;
  sourceLeadHref: string;
}): OrderDocumentNode[] {
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
            {
              id: "invoice",
              label: "Счет на оплату",
              status: "planned",
              children: [
                {
                  id: "waybill",
                  label: "Товарная накладная",
                  status: "planned",
                },
              ],
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
