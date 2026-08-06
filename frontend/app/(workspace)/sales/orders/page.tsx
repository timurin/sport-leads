import { OrdersWorkspace } from "@/components/sales/orders-workspace";
import { getMe } from "@/lib/auth/session";
import { getOrderList } from "@/lib/sales/order-list-api";

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

async function loadCreateOptions(meSalesUserId: number | null) {
  const [clientsResponse, orgsResponse, usersResponse] = await Promise.all([
    fetch(`${apiBaseUrl()}/clients?limit=500`, { cache: "no-store" }),
    fetch(`${apiBaseUrl()}/organizations`, { cache: "no-store" }),
    fetch(`${apiBaseUrl()}/sales-users?limit=500`, { cache: "no-store" }),
  ]);

  const orgNameById = new Map<number, string>();
  if (orgsResponse.ok) {
    const rows = (await orgsResponse.json()) as { id: number; name: string }[];
    for (const row of rows) orgNameById.set(row.id, row.name);
  }

  let clients: {
    id: number;
    label: string;
    organizationId: number | null;
    organizationLabel: string | null;
    responsibleId: number | null;
  }[] = [];
  if (clientsResponse.ok) {
    const rows = (await clientsResponse.json()) as Array<{
      id: number;
      company_name: string | null;
      contact_name: string;
      default_organization_id: number | null;
      organization_id: number | null;
      organization_name: string | null;
      responsible_id: number | null;
    }>;
    clients = rows.map((row) => {
      const organizationId = row.default_organization_id ?? row.organization_id;
      return {
        id: row.id,
        label: row.company_name?.trim() || row.contact_name,
        organizationId,
        organizationLabel:
          row.organization_name
          ?? (organizationId != null ? orgNameById.get(organizationId) ?? null : null),
        responsibleId: row.responsible_id,
      };
    });
  }

  let sessionResponsibleLabel: string | null = null;
  if (meSalesUserId != null && usersResponse.ok) {
    const rows = (await usersResponse.json()) as { id: number; name: string }[];
    sessionResponsibleLabel =
      rows.find((row) => row.id === meSalesUserId)?.name ?? `Сотрудник #${meSalesUserId}`;
  }

  return { clients, sessionResponsibleLabel };
}

export default async function OrdersPage() {
  const [orderList, me] = await Promise.all([getOrderList(), getMe()]);
  const sessionResponsibleId = me?.sales_user_id ?? null;
  const createOptions = await loadCreateOptions(sessionResponsibleId);

  const orders = orderList.ok ? orderList.orders : [];
  const columns = orderList.ok ? orderList.columns : [];
  const managers = [
    ...new Set(
      orders.map((order) =>
        order.responsible_name
        ?? (order.responsible_id === null
          ? "Не назначен"
          : `Сотрудник #${order.responsible_id}`),
      ),
    ),
  ];
  const products = [
    ...new Set(orders.map((order) => order.product_category ?? order.title)),
  ];
  const statuses = [
    ...new Set(
      orders.map(
        (order) =>
          columns.find((column) => column.id === order.status)?.title ?? order.status,
      ),
    ),
  ];

  return (
    <OrdersWorkspace
      columns={columns}
      managers={managers}
      products={products}
      statuses={statuses}
      loadError={orderList.ok ? undefined : orderList.message}
      clients={createOptions.clients}
      sessionResponsibleId={sessionResponsibleId}
      sessionResponsibleLabel={createOptions.sessionResponsibleLabel}
    />
  );
}
