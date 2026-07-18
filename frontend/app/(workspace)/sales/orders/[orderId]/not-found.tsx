import Link from "next/link";

import { PageContent } from "@/components/layout/page-layout";

export default function OrderNotFound() {
  return (
    <PageContent size="spacious">
      <section className="rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface p-6 text-center">
        <h1 className="text-xl font-bold text-portal-text">Заказ не найден</h1>
        <p className="mt-2 text-sm text-portal-muted">Проверьте ссылку или вернитесь к списку заказов.</p>
        <Link href="/sales/orders" className="mt-4 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-900">К списку заказов</Link>
      </section>
    </PageContent>
  );
}
