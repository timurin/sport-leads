import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { PageToolbar } from "@/components/ui/page-header";

type CatalogShellPlaceholderProps = {
  catalogTitle: string;
  description: string;
};

/**
 * Stage 6.0.2 route shell: real settings routes without demo/local catalog data.
 * Feature fill lands in 6.1+ / 6.2+ / 6.3+.
 */
export function CatalogShellPlaceholder({
  catalogTitle,
  description,
}: CatalogShellPlaceholderProps) {
  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PageToolbar
        start={
          <p className="text-portal-body font-semibold text-portal-text">
            {catalogTitle}
          </p>
        }
      />
      <PageContent className="flex min-h-0 flex-1 flex-col">
        <EmptyState title={catalogTitle} description={description} />
      </PageContent>
    </PageLayout>
  );
}
