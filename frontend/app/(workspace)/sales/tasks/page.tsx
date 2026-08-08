import {
  listWorkTaskBoardStages,
  listWorkTaskFilterUsers,
  listWorkTasks,
} from "@/app/(workspace)/sales/tasks/work-task-actions";
import { WorkTasksWorkspace } from "@/components/sales/work-tasks-workspace";
import { getMe } from "@/lib/auth/session";
import { fetchProductionOrders } from "@/lib/production/production-orders";
import { getProductionStages } from "@/lib/production-stages";
import { getLeadList } from "@/lib/sales/lead-list-api";
import { getOrderList } from "@/lib/sales/order-list-api";
import { parseWorkTaskListFilters } from "@/lib/work-tasks";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TasksPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = parseWorkTaskListFilters(params);

  const [
    me,
    loaded,
    stages,
    boardStagesLoaded,
    usersLoaded,
    leadsLoaded,
    ordersLoaded,
    productionOrders,
  ] = await Promise.all([
    getMe(),
    listWorkTasks(filters),
    getProductionStages({ active_only: true, limit: 200 }).catch(() => []),
    listWorkTaskBoardStages(),
    listWorkTaskFilterUsers(),
    getLeadList(),
    getOrderList(),
    fetchProductionOrders({ limit: 500 }).catch(() => []),
  ]);

  const stageOptions = stages.map((stage) => ({
    id: stage.id,
    label: stage.name,
  }));
  const userOptions = usersLoaded.ok ? usersLoaded.data : [];
  const leadOptions = leadsLoaded.ok
    ? leadsLoaded.leads.map((lead) => ({
        id: Number(lead.id),
        label: `${lead.clientName || lead.contact} (#${lead.id})`,
      }))
    : [];
  const orderOptions = ordersLoaded.ok
    ? ordersLoaded.orders.map((order) => ({
        id: order.id,
        label: `${order.number}${order.title ? ` — ${order.title}` : ""}`,
      }))
    : [];
  const productionOrderOptions = productionOrders.map((order) => ({
    id: order.id,
    label: order.number,
  }));

  const shared = {
    filters,
    stages: stageOptions,
    boardStages: boardStagesLoaded.ok ? boardStagesLoaded.data : [],
    boardStagesError: boardStagesLoaded.ok ? null : boardStagesLoaded.message,
    users: userOptions,
    leads: leadOptions,
    orders: orderOptions,
    productionOrders: productionOrderOptions,
    viewerUserId: me?.id ?? null,
  };

  if (!loaded.ok) {
    return (
      <WorkTasksWorkspace
        tasks={[]}
        {...shared}
        loadError={loaded.message}
      />
    );
  }

  return <WorkTasksWorkspace tasks={loaded.data} {...shared} />;
}
