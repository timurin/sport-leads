import { InlineAlert } from "@/components/ui/inline-alert";
import { SectionCard } from "@/components/ui/section-card";
import type { ClientSettlementsView } from "@/lib/sales/client-settlements";

type Props = {
  summary?: ClientSettlementsView | null;
  loadError?: string;
};

export function ClientSettlementsSection({ summary, loadError }: Props) {
  return (
    <SectionCard
      title="Взаиморасчёты (по заказам)"
      description="Маркеры оплаты заказов (3.4.2). Журнал платежей — этап 14."
      size="compact"
    >
      {loadError ? (
        <InlineAlert tone="danger" size="compact">
          {loadError}
        </InlineAlert>
      ) : null}

      {summary ? (
        <dl className="grid min-w-0 gap-portal-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Открытых заказов" value={String(summary.openOrderCount)} />
          <Field label="Сумма открытых" value={summary.openOrderAmountLabel} />
          <Field label="К получению (долг)" value={summary.receivableLabel} />
          <Field label="Переплата" value={summary.advanceLabel} />
          <Field label="Оплачено" value={summary.paidTotalLabel} />
          <Field
            label="Заказов без суммы"
            value={String(summary.ordersWithoutAmountCount)}
          />
        </dl>
      ) : null}
    </SectionCard>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-l-2 border-portal-border pl-portal-3">
      <dt className="text-portal-caption font-medium text-portal-muted">{label}</dt>
      <dd className="mt-1 min-w-0 truncate font-semibold text-portal-text">{value}</dd>
    </div>
  );
}
