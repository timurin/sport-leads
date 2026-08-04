import { PageLayout } from "@/components/layout/page-layout";
import { PlatformDirectoriesHub } from "@/components/settings/platform-directories-hub";
import { EmptyState } from "@/components/ui/empty-state";
import { getMe } from "@/lib/auth/session";
import { loadPlatformDirectoryRegistry } from "@/app/(workspace)/settings/platform-directories/platform-directory-actions";

export default async function PlatformDirectoriesPage() {
  const me = await getMe();
  if (!me) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Требуется вход"
            description="Войдите, чтобы открыть справочники платформы."
          />
        </div>
      </PageLayout>
    );
  }

  const loaded = await loadPlatformDirectoryRegistry();
  if (!loaded.ok) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Не удалось загрузить реестр"
            description={loaded.message}
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PlatformDirectoriesHub items={loaded.items} />
    </PageLayout>
  );
}
