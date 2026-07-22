import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EntityHeader } from "@/components/ui/entity-header";
import { StatusBadge } from "@/components/ui/status-badge";
import type { SalesOrderDetails } from "@/lib/sales/order-details";

/** PT-07 document header slot for customer orders (`DS-PT-07`). */
export function SalesOrderHeader({ order }: { order: SalesOrderDetails }) {
  return (
    <div
      data-document-header
      className="rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 shadow-portal-card sm:p-portal-5"
    >
      <EntityHeader
        size="default"
        eyebrow={
          <Link
            href="/sales/orders"
            className="inline-flex items-center gap-1.5 font-medium text-portal-primary hover:underline"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            К списку заказов
          </Link>
        }
        title={order.title}
        description={`Создан ${order.createdAt}`}
        meta={
          <>
            <span>№ {order.number}</span>
            <span>Сумма {order.amount}</span>
          </>
        }
        status={<StatusBadge tone="primary">{order.status}</StatusBadge>}
      />
    </div>
  );
}
