import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientCard } from "@/components/sales/client-card";
import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { getClientDetail } from "@/lib/sales/client-detail-api";

type ClientPageProps = {
  params: Promise<{ clientId: string }>;
};

export default async function ClientPage({ params }: ClientPageProps) {
  const { clientId } = await params;
  const result = await getClientDetail(clientId);
  if (!result.ok && result.notFound) {
    notFound();
  }
  if (!result.ok || result.client === null) {
    return (
      <PageLayout>
        <PageContent size="spacious">
          <section className="rounded-portal-lg border border-portal-border bg-portal-surface p-portal-6">
            <h1 className="text-portal-page font-semibold text-portal-text">Не удалось загрузить клиента</h1>
            <p className="mt-portal-2 text-portal-body text-portal-muted">{result.message}</p>
            <p className="mt-portal-4">
              <Link href="/sales/clients" className="font-semibold text-portal-primary hover:underline">
                К списку клиентов
              </Link>
            </p>
          </section>
        </PageContent>
      </PageLayout>
    );
  }
  return <ClientCard client={result.client} />;
}
