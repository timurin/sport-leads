"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { shipTechnicalCardAction } from "@/app/(workspace)/production/stages/fulfillment-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { PageToolbar } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, DataTableBody, DataTableCell, DataTableFrame, DataTableHead,
  DataTableHeaderCell, DataTableRow } from "@/components/ui/data-table";
import { formatTechCardDateTime } from "@/lib/production/tech-cards";
import { productionQuantityLabel } from "@/lib/production/tech-card-display";
import type { ApiFulfillmentCard, FulfillmentStatus } from "@/lib/sales/order-tech-cards-api";

export function FulfillmentWorkspace({ status, cards }: { status: FulfillmentStatus; cards: ApiFulfillmentCard[] }) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const ready = status === "ready_to_ship";
  const title = ready ? "Готовы к отгрузке" : "Отгружены";
  const filtered = cards.filter((card) => [card.number, card.order_number, card.model]
    .some((value) => value?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  const ship = (id: number) => startTransition(async () => {
    setError(null);
    const result = await shipTechnicalCardAction(id);
    if (result.error) setError(result.error);
    else router.refresh();
  });
  const action = (card: ApiFulfillmentCard) => ready
    ? <Button size="compact" disabled={pending} onClick={() => ship(card.id)}>Отгрузить</Button>
    : formatTechCardDateTime(card.shipped_at);
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <PageToolbar start={<><p className="text-portal-body font-semibold">{title}</p>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} size="compact"
        placeholder="Поиск по № ТК, заказу, модели" aria-label={`Поиск: ${title}`} /></>} />
    {error && <p role="alert" className="p-portal-4 text-portal-danger">{error}</p>}
    <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
      {!filtered.length ? <EmptyState title="Техкарт пока нет" description="Измените поиск или дождитесь перехода техкарт в этот раздел." /> : <>
        <div className="hidden md:block"><DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
          <DataTable minWidthClassName="min-w-[920px]"><DataTableHead><tr>
            {["№ ТК", "Заказ", "Модель", "Кол-во", "Производство завершено", "Дата отгрузки / доставки", ready ? "Действие" : "Отгружено"].map((label) => <DataTableHeaderCell key={label}>{label}</DataTableHeaderCell>)}
          </tr></DataTableHead><DataTableBody>{filtered.map((card) => <DataTableRow key={card.id}>
            <DataTableCell><Link className="font-medium text-portal-primary hover:underline" href={`/production/tech-cards/${card.id}`}>{card.number}</Link></DataTableCell>
            <DataTableCell>{card.order_number ?? "—"}</DataTableCell><DataTableCell>{card.model ?? "—"}</DataTableCell>
            <DataTableCell>{productionQuantityLabel(card.quantity)}</DataTableCell>
            <DataTableCell>{formatTechCardDateTime(card.ready_to_ship_at)}</DataTableCell>
            <DataTableCell>{card.shipping_date ?? "—"}</DataTableCell><DataTableCell>{action(card)}</DataTableCell>
          </DataTableRow>)}</DataTableBody></DataTable>
        </DataTableFrame></div>
        <div className="flex flex-col gap-portal-3 p-portal-4 md:hidden">{filtered.map((card) => <article key={card.id} className="rounded-portal-md border border-portal-border p-portal-4">
          <Link className="font-semibold text-portal-primary" href={`/production/tech-cards/${card.id}`}>{card.number}</Link>
          <p>{card.order_number ?? "—"} · {card.model ?? "—"}</p>
          <p>Количество: {productionQuantityLabel(card.quantity)}</p>
          <p>Производство завершено: {formatTechCardDateTime(card.ready_to_ship_at)}</p>
          <p>Дата отгрузки / доставки: {card.shipping_date ?? "—"}</p>
          {ready ? action(card) : <p>Отгружено: {action(card)}</p>}
        </article>)}</div>
      </>}
    </section>
  </div>;
}
