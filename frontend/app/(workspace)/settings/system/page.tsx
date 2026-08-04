import { PageLayout } from "@/components/layout/page-layout";
import { SystemSettingsWorkspace } from "@/components/settings/system-settings-workspace";
import { EmptyState } from "@/components/ui/empty-state";
import { getMe } from "@/lib/auth/session";
import {
  hasPermission,
  PERM_SYSTEM_SETTINGS_WRITE,
} from "@/lib/auth/session-mapping";
import { loadPlatformSystemSettings } from "@/app/(workspace)/settings/system/system-settings-actions";

export default async function SystemSettingsPage() {
  const me = await getMe();
  if (!me) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Требуется вход"
            description="Войдите в платформу, чтобы открыть системные настройки."
          />
        </div>
      </PageLayout>
    );
  }

  const loaded = await loadPlatformSystemSettings();
  if (!loaded.ok) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Не удалось загрузить системные настройки"
            description={loaded.message}
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <SystemSettingsWorkspace
        settings={loaded.settings}
        canWrite={hasPermission(me, PERM_SYSTEM_SETTINGS_WRITE)}
      />
    </PageLayout>
  );
}
