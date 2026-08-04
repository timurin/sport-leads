import { PageLayout } from "@/components/layout/page-layout";
import { PlatformCitiesWorkspace } from "@/components/settings/platform-cities-workspace";
import { EmptyState } from "@/components/ui/empty-state";
import { getMe } from "@/lib/auth/session";
import {
  hasPermission,
  PERM_PLATFORM_DIRECTORIES_WRITE,
} from "@/lib/auth/session-mapping";
import { loadPlatformCities } from "@/app/(workspace)/settings/platform-directories/platform-directory-actions";

export default async function PlatformCitiesPage() {
  const me = await getMe();
  if (!me) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Требуется вход"
            description="Войдите, чтобы открыть справочник городов."
          />
        </div>
      </PageLayout>
    );
  }

  const loaded = await loadPlatformCities();
  if (!loaded.ok) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Не удалось загрузить города"
            description={loaded.message}
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PlatformCitiesWorkspace
        cities={loaded.cities}
        canWrite={hasPermission(me, PERM_PLATFORM_DIRECTORIES_WRITE)}
      />
    </PageLayout>
  );
}
