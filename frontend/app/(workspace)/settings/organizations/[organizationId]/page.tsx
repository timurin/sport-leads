import Link from "next/link";
import { notFound } from "next/navigation";

import { OrganizationCard } from "@/components/settings/organization-card";
import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { getOrganizationDetail } from "@/lib/settings/organizations-api";

type Props = {
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationPage({ params }: Props) {
  const { organizationId } = await params;
  const result = await getOrganizationDetail(organizationId);
  if (!result.ok && result.notFound) {
    notFound();
  }
  if (!result.ok || result.organization === null) {
    return (
      <PageLayout>
        <PageContent size="spacious">
          <section className="rounded-portal-lg border border-portal-border bg-portal-surface p-portal-6">
            <h1 className="text-portal-page font-semibold text-portal-text">
              Не удалось загрузить организацию
            </h1>
            <p className="mt-portal-2 text-portal-body text-portal-muted">{result.message}</p>
            <p className="mt-portal-4">
              <Link
                href="/settings/organizations"
                className="font-semibold text-portal-primary hover:underline"
              >
                К списку организаций
              </Link>
            </p>
          </section>
        </PageContent>
      </PageLayout>
    );
  }
  return <OrganizationCard organization={result.organization} />;
}
