import { loadMailboxSettings } from "@/app/(workspace)/settings/integrations/mailbox-settings-actions";
import { MailboxSettingsWorkspace } from "@/components/settings/mailbox-settings-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { getMe } from "@/lib/auth/session";
import {
  hasPermission,
  PERM_SYSTEM_SETTINGS_WRITE,
} from "@/lib/auth/session-mapping";

export default async function MailboxSettingsPage() {
  const me = await getMe();
  if (!me) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Требуется вход"
            description="Войдите в платформу, чтобы открыть настройку почтового ящика."
          />
        </div>
      </PageLayout>
    );
  }

  const loaded = await loadMailboxSettings();
  if (!loaded.ok) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Не удалось загрузить почтовый ящик"
            description={loaded.message}
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <MailboxSettingsWorkspace
        settings={loaded.settings}
        canWrite={hasPermission(me, PERM_SYSTEM_SETTINGS_WRITE)}
      />
    </PageLayout>
  );
}
