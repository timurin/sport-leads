import Link from "next/link";

import { PageLayout } from "@/components/layout/page-layout";

export default function WarehouseMovementDocumentNotFound() {
  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col items-start gap-portal-3 p-portal-6">
      <h1 className="text-portal-title font-semibold">Документ не найден</h1>
      <p className="text-portal-body text-portal-muted">
        Складской документ отсутствует или был удалён.
      </p>
      <Link
        href="/warehouse/movements"
        className="text-portal-body text-portal-primary hover:underline"
      >
        ← К списку движений
      </Link>
    </PageLayout>
  );
}
