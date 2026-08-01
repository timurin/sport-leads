"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  updateOrderDesignApproval,
  type DesignApprovalStatus,
} from "@/app/(workspace)/sales/orders/[orderId]/order-design-approval-actions";
import { Select } from "@/components/ui/form-controls";
import {
  designApprovalStatuses,
  designApprovalStatusLabels,
} from "@/lib/sales/order-details";

export function OrderDesignApprovalField({
  orderId,
  value,
}: {
  orderId: string;
  value: DesignApprovalStatus;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(value);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDraft(value);
    setMessage(null);
  }, [orderId, value]);

  function onChange(next: DesignApprovalStatus) {
    setDraft(next);
    setMessage(null);
    startTransition(async () => {
      const result = await updateOrderDesignApproval(orderId, next);
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
        aria-label="Согласование дизайна"
        className="w-full min-w-[10rem]"
        onChange={(event) => onChange(event.target.value as DesignApprovalStatus)}
      >
        {designApprovalStatuses.map((status) => (
          <option key={status} value={status}>
            {designApprovalStatusLabels[status]}
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
