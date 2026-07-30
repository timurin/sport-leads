import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { PageToolbar } from "@/components/ui/page-header";

type ShopStagePlaceholderProps = {
  stageTitle: string;
};

export function ShopStagePlaceholder({
  stageTitle,
}: ShopStagePlaceholderProps) {
  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PageToolbar
        start={
          <p className="text-portal-body font-semibold text-portal-text">
            {stageTitle}
          </p>
        }
      />
      <PageContent className="flex min-h-0 flex-1 flex-col">
        <EmptyState
          title={`${stageTitle} — модуль в подготовке`}
          description="Маршрут уже доступен в навигации производства. Общая очередь техкарт и контекст исполнения появятся на следующих шагах `11.3.3`–`11.3.4`."
        />
      </PageContent>
    </PageLayout>
  );
}
