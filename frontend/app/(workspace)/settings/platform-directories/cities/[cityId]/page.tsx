import { notFound } from "next/navigation";

import { PageLayout } from "@/components/layout/page-layout";
import { PlatformCityCard } from "@/components/settings/platform-city-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getMe } from "@/lib/auth/session";
import {
  hasPermission,
  PERM_PLATFORM_DIRECTORIES_WRITE,
} from "@/lib/auth/session-mapping";
import { loadPlatformCity } from "@/app/(workspace)/settings/platform-directories/platform-directory-actions";

type Props = {
  params: Promise<{ cityId: string }>;
};

export default async function PlatformCityDetailPage({ params }: Props) {
  const { cityId: rawId } = await params;
  const cityId = Number(rawId);
  if (!Number.isInteger(cityId) || cityId <= 0) {
    notFound();
  }

  const me = await getMe();
  if (!me) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Требуется вход"
            description="Войдите, чтобы открыть карточку города."
          />
        </div>
      </PageLayout>
    );
  }

  const loaded = await loadPlatformCity(cityId);
  if (!loaded.ok) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Город не найден"
            description={loaded.message}
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto p-portal-4 lg:p-portal-6">
        <PlatformCityCard
          city={loaded.city}
          canWrite={hasPermission(me, PERM_PLATFORM_DIRECTORIES_WRITE)}
        />
      </div>
    </PageLayout>
  );
}
