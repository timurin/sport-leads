import { PageLayout } from "@/components/layout/page-layout";
import { PrintFormsWorkspace } from "@/components/settings/print-forms-workspace";
import { EmptyState } from "@/components/ui/empty-state";
import { getMe } from "@/lib/auth/session";
import {
  hasPermission,
  PERM_PRINT_FORMS_WRITE,
} from "@/lib/auth/session-mapping";
import { loadPrintForms } from "@/app/(workspace)/settings/print-forms/print-form-actions";

export default async function PrintFormsPage() {
  const me = await getMe();
  if (!me) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Требуется вход"
            description="Войдите, чтобы открыть реестр печатных форм."
          />
        </div>
      </PageLayout>
    );
  }

  const loaded = await loadPrintForms();
  if (!loaded.ok) {
    return (
      <PageLayout className="flex min-h-0 flex-1 flex-col">
        <div className="p-portal-6">
          <EmptyState
            title="Не удалось загрузить печатные формы"
            description={loaded.message}
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PrintFormsWorkspace
        items={loaded.items}
        canWrite={hasPermission(me, PERM_PRINT_FORMS_WRITE)}
      />
    </PageLayout>
  );
}
