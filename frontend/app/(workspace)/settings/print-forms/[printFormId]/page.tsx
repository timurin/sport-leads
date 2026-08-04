import { notFound } from "next/navigation";

import { PageLayout } from "@/components/layout/page-layout";
import { PrintFormCard } from "@/components/settings/print-form-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getMe } from "@/lib/auth/session";
import {
  hasPermission,
  PERM_PRINT_FORMS_WRITE,
} from "@/lib/auth/session-mapping";
import { loadPrintForm } from "@/app/(workspace)/settings/print-forms/print-form-actions";

type Props = {
  params: Promise<{ printFormId: string }>;
};

export default async function PrintFormDetailPage({ params }: Props) {
  const { printFormId: rawId } = await params;
  const printFormId = Number(rawId);
  if (!Number.isInteger(printFormId) || printFormId <= 0) {
    notFound();
  }

  const me = await getMe();
  if (!me) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Требуется вход"
            description="Войдите, чтобы открыть карточку печатной формы."
          />
        </div>
      </PageLayout>
    );
  }

  const loaded = await loadPrintForm(printFormId);
  if (!loaded.ok) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Печатная форма не найдена"
            description={loaded.message}
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto p-portal-4 lg:p-portal-6">
        <PrintFormCard
          printForm={loaded.item}
          canWrite={hasPermission(me, PERM_PRINT_FORMS_WRITE)}
        />
      </div>
    </PageLayout>
  );
}
