"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  updateOrderMaterialReserve,
  type MaterialReserveStatus,
} from "@/app/(workspace)/sales/orders/[orderId]/order-execution-actions";
import { Select } from "@/components/ui/form-controls";
import {
  materialReserveStatuses,
  materialReserveStatusLabels,
} from "@/lib/sales/order-details";

export function OrderMaterialReserveField({
  orderId,
  value,
}: {
  orderId: string;
  value: MaterialReserveStatus;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(value);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDraft(value);
    setMessage(null);
  }, [orderId, value]);

  function onChange(next: MaterialReserveStatus) {
    setDraft(next);
    setMessage(null);
    startTransition(async () => {
      const result = await updateOrderMaterialReserve(orderId, next);
      setMessage(result.message);
      if (result.ok) router.refresh();
      else setDraft(value);
    });
  }

  return (
    <div className="min-w-0">
      <Select
        size="compact"
        value={draft}
        disabled={isPending}
        aria-label="Резерв материалов"
        className="w-full min-w-[10rem]"
        onChange={(event) => onChange(event.target.value as MaterialReserveStatus)}
      >
        {materialReserveStatuses.map((status) => (
          <option key={status} value={status}>
            {materialReserveStatusLabels[status]}
          </option>
        ))}
      </Select>
      {message ? (
        <p className="mt-1 text-[11px] text-portal-muted" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
