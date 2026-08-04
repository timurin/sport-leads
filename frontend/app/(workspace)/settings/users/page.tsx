import { PageLayout } from "@/components/layout/page-layout";
import { PlatformUsersWorkspace } from "@/components/settings/platform-users-workspace";
import { EmptyState } from "@/components/ui/empty-state";
import { getMe } from "@/lib/auth/session";
import {
  hasPermission,
  PERM_ADMIN_ROLES_ASSIGN,
} from "@/lib/auth/session-mapping";
import { loadPlatformUsersAdmin } from "@/app/(workspace)/settings/users/platform-user-actions";

export default async function PlatformUsersPage() {
  const me = await getMe();
  const canAssign = hasPermission(me, PERM_ADMIN_ROLES_ASSIGN);

  if (!canAssign) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Недостаточно прав"
            description="Нужно право admin.roles.assign, чтобы назначать роли пользователям."
          />
        </div>
      </PageLayout>
    );
  }

  const loaded = await loadPlatformUsersAdmin();
  if (!loaded.ok) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Не удалось загрузить пользователей"
            description={loaded.message}
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PlatformUsersWorkspace users={loaded.users} roles={loaded.roles} />
    </PageLayout>
  );
}
