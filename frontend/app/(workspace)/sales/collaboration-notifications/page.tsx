import { CollaborationNotificationsWorkspace } from "@/components/sales/collaboration-notifications-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { listCollaborationNotifications } from "@/app/(workspace)/sales/orders/[orderId]/collaboration-actions";

export default async function CollaborationNotificationsPage() {
  const loaded = await listCollaborationNotifications({ limit: 50 });
  if (!loaded.ok) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Не удалось загрузить уведомления"
            description={loaded.message}
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <CollaborationNotificationsWorkspace
      initialItems={loaded.data.items}
      initialUnreadCount={loaded.data.unread_count}
    />
  );
}
