import { clients, deals, leads, orders, salesManagers, salesTasks } from "@/lib/demo-data/sales";
import type { Department, SalesDashboardData } from "@/lib/dashboard/sales-dashboard-types";
import type { SalesSource } from "@/types/sales";

export const dashboardDemoNow = "2026-07-16T12:00:00";

const sources: SalesSource[] = ["website", "referral", "vk", "phone", "email", "manual"];
const departments: Department[] = ["sales", "sales", "design", "management", "production"];

function isoDaysAgo(days: number, hour = 10): string {
  const date = new Date(dashboardDemoNow);
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function isoDaysFromNow(days: number, hour = 17): string {
  return isoDaysAgo(-days, hour);
}

export function getSalesDashboardDemoData(): SalesDashboardData {
  return {
    now: dashboardDemoNow,
    managers: salesManagers.map((manager) => ({ ...manager })),
    leads: leads.map((lead, index) => {
      const createdDaysAgo = (index * 5 + 1) % 58;
      const isQualified = ["qualification", "proposal", "won"].includes(lead.status);
      const result = lead.status === "won" ? "converted" as const : lead.status === "unqualified" ? "rejected" as const : undefined;
      return {
        id: lead.id,
        status: lead.status,
        clientName: lead.clientName,
        source: sources[index % sources.length],
        responsible: { ...lead.responsible },
        department: departments[index % departments.length],
        amount: lead.estimatedAmount,
        createdAt: isoDaysAgo(createdDaysAgo, 9 + (index % 6)),
        updatedAt: isoDaysAgo(Math.max(0, createdDaysAgo - 2), 14),
        ...(result ? { result, completedAt: isoDaysAgo(Math.max(0, createdDaysAgo - 4), 16) } : {}),
        ...(result === "rejected" ? { rejectionReason: index % 2 ? "Другое" : "Нет бюджета" } : {}),
        ...(isQualified ? { qualifiedAt: isoDaysAgo(Math.max(0, createdDaysAgo - 3), 12) } : {}),
      };
    }),
    deals: deals.map((deal, index) => {
      const createdDaysAgo = (index * 6 + 2) % 65;
      return {
        id: deal.id,
        status: deal.status,
        clientName: deal.clientName,
        source: sources[(index + 1) % sources.length],
        responsible: { ...deal.responsible },
        department: departments[index % departments.length],
        amount: deal.amount,
        probability: deal.probability,
        createdAt: isoDaysAgo(createdDaysAgo, 10),
        updatedAt: isoDaysAgo(Math.max(0, createdDaysAgo - 2), 16),
        ...(deal.status === "paid" ? { wonAt: isoDaysAgo(Math.max(0, createdDaysAgo - 8), 15) } : {}),
      };
    }),
    orders: orders.map((order, index) => {
      const createdDaysAgo = (index * 7 + 1) % 72;
      return {
        id: order.id,
        status: order.status,
        clientName: order.clientName,
        source: sources[(index + 2) % sources.length],
        responsible: { ...order.manager },
        department: departments[(index + 1) % departments.length],
        amount: order.amount,
        createdAt: isoDaysAgo(createdDaysAgo, 11),
        orderedAt: isoDaysAgo(createdDaysAgo, 11),
        updatedAt: isoDaysAgo(Math.max(0, createdDaysAgo - 3), 13),
        dueAt: index % 4 === 0 ? isoDaysAgo(2, 18) : isoDaysFromNow(index + 2, 18),
        ...(order.status === "completed" ? { completedAt: isoDaysAgo(Math.max(0, createdDaysAgo - 10), 17) } : {}),
      };
    }),
    tasks: salesTasks.map((task, index) => {
      const createdDaysAgo = (index * 4 + 1) % 48;
      const completed = task.status === "done";
      return {
        id: task.id,
        status: task.status,
        clientName: task.clientName,
        source: sources[(index + 3) % sources.length],
        responsible: { ...task.assignee },
        department: departments[index % departments.length],
        createdAt: isoDaysAgo(createdDaysAgo, 8),
        updatedAt: isoDaysAgo(Math.max(0, createdDaysAgo - 1), 15),
        dueAt: task.status === "overdue" ? isoDaysAgo(3 + index, 18) : index % 3 === 0 ? isoDaysFromNow(0, 18) : isoDaysFromNow(index + 1, 18),
        ...(completed ? { completedAt: isoDaysAgo(Math.max(0, createdDaysAgo - 5), 16) } : {}),
      };
    }),
    clients: clients.map((client, index) => {
      const createdDaysAgo = (index * 9 + 2) % 140;
      return {
        id: client.id,
        name: client.name,
        clientName: client.name,
        source: sources[(index + 4) % sources.length],
        responsible: { ...client.responsible },
        department: departments[index % departments.length],
        createdAt: isoDaysAgo(createdDaysAgo, 12),
        updatedAt: isoDaysAgo(Math.max(0, createdDaysAgo - 4), 15),
      };
    }),
  };
}
