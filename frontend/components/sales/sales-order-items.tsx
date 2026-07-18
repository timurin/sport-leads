"use client";

import { useRef, useState, useTransition } from "react";

import type { SalesOrderItem } from "@/lib/sales/order-details";
import { createOrderItem, deleteOrderItem, updateOrderItem } from "@/app/(workspace)/sales/orders/[orderId]/order-item-actions";

export function SalesOrderItems({ orderId, items }: { orderId: string; items: SalesOrderItem[] }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submitCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createOrderItem(orderId, formData);
      setMessage(result.message);
      if (result.ok) formRef.current?.reset();
    });
  }

  function submitDelete(itemId: number) {
    startTransition(async () => setMessage((await deleteOrderItem(orderId, itemId)).message));
  }

  function submitUpdate(itemId: number, formData: FormData) {
    startTransition(async () => setMessage((await updateOrderItem(orderId, itemId, formData)).message));
  }

  return (
    <section className="mt-4 rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface p-4">
      <h2 className="text-base font-semibold text-portal-text">Товарные позиции</h2>
      {items.length === 0 ? <p className="mt-2 text-sm text-portal-muted">Позиции пока не добавлены.</p> : (
        <div className="mt-3 space-y-2">
          {items.map((item) => <form key={item.id} action={(formData) => submitUpdate(item.id, formData)} className="grid gap-2 rounded border border-portal-border p-3 text-sm sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center">
            <input name="name" defaultValue={item.name} required className="rounded border px-2 py-1" />
            <input name="quantity" defaultValue={item.quantity} required type="number" min="0.001" step="0.001" className="w-24 rounded border px-2 py-1" />
            <input name="unit_price" defaultValue={item.unitPrice.replace(/[^0-9,.-]/g, "").replace(",", ".")} required type="number" min="0" step="0.01" className="w-28 rounded border px-2 py-1" />
            <span className="font-semibold">{item.lineTotal}</span>
            <div className="flex gap-2"><button type="submit" disabled={isPending} className="text-xs font-semibold text-blue-700">Сохранить</button><button type="button" disabled={isPending} onClick={() => submitDelete(item.id)} className="text-xs font-semibold text-red-700">Удалить</button></div>
          </form>)}
        </div>
      )}
      <form ref={formRef} action={submitCreate} className="mt-4 grid gap-2 sm:grid-cols-4">
        <input name="name" required placeholder="Наименование" className="rounded border px-3 py-2 text-sm" />
        <input name="quantity" required type="number" min="0.001" step="0.001" placeholder="Количество" className="rounded border px-3 py-2 text-sm" />
        <input name="unit_price" required type="number" min="0" step="0.01" placeholder="Цена" className="rounded border px-3 py-2 text-sm" />
        <button type="submit" disabled={isPending} className="rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Добавить позицию</button>
      </form>
      {message ? <p className="mt-2 text-sm text-portal-muted" role="status">{message}</p> : null}
    </section>
  );
}
