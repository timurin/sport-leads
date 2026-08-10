import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getWorkTask,
  listWorkTaskBoardStages,
  listWorkTaskMessages,
} from "@/app/(workspace)/sales/tasks/work-task-actions";
import { WorkTaskChatPanel } from "@/components/sales/work-task-chat-panel";
import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { PageToolbar } from "@/components/ui/page-header";
import { getMe } from "@/lib/auth/session";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WorkTaskDetailPage({ params }: Props) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const taskId = Number(id);
  const [me, loaded, messagesLoaded, stagesLoaded] = await Promise.all([
    getMe(),
    getWorkTask(taskId),
    listWorkTaskMessages(taskId),
    listWorkTaskBoardStages(),
  ]);

  if (!loaded.ok) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <PageToolbar
          start={
            <Link href="/sales/tasks" className="text-sm text-portal-muted hover:underline">
              ← К списку задач
            </Link>
          }
        />
        <PageContent className="p-portal-4 sm:p-portal-6">
          <EmptyState title="Задача недоступна" description={loaded.message} />
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PageContent className="flex min-h-0 flex-1 flex-col p-portal-4 sm:p-portal-6">
        <WorkTaskChatPanel
          task={loaded.data}
          initialMessages={messagesLoaded.ok ? messagesLoaded.data : []}
          messagesError={messagesLoaded.ok ? null : messagesLoaded.message}
          viewerUserId={me?.id ?? null}
          boardStages={stagesLoaded.ok ? stagesLoaded.data : []}
        />
      </PageContent>
    </PageLayout>
  );
}
