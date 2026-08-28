import Link from "next/link";
import { notFound } from "next/navigation";

import { SupplierCard } from "@/components/purchases/supplier-card";
import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { getNomenclature } from "@/lib/nomenclature";
import { getSupplierDetail } from "@/lib/purchases/suppliers-api";

type Props = {
  params: Promise<{ supplierId: string }>;
};

export default async function SupplierPage({ params }: Props) {
  const { supplierId } = await params;
  const result = await getSupplierDetail(supplierId);
  if (!result.ok && result.notFound) {
    notFound();
  }
  if (!result.ok || result.supplier === null) {
    return (
      <PageLayout>
        <PageContent size="spacious">
          <section className="rounded-portal-lg border border-portal-border bg-portal-surface p-portal-6">
            <h1 className="text-portal-page font-semibold text-portal-text">
              Не удалось загрузить поставщика
            </h1>
            <p className="mt-portal-2 text-portal-body text-portal-muted">
              {result.message}
            </p>
            <p className="mt-portal-4">
              <Link
                href="/purchases/suppliers"
                className="font-semibold text-portal-primary hover:underline"
              >
                К списку поставщиков
              </Link>
            </p>
          </section>
        </PageContent>
      </PageLayout>
    );
  }

  let nomenclatureOptions: { id: number; name: string }[] = [];
  try {
    const items = await getNomenclature();
    nomenclatureOptions = items
      .filter((item) => item.is_active)
      .map((item) => ({ id: item.id, name: item.name }));
  } catch {
    nomenclatureOptions = [];
  }

  return (
    <SupplierCard
      supplier={result.supplier}
      nomenclatureOptions={nomenclatureOptions}
    />
  );
}
