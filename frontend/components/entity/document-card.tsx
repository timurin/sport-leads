import type { ReactNode } from "react";

import { PageContent, PageLayout } from "@/components/layout/page-layout";

type DocumentCardProps = {
  /** Typically domain document header (`EntityHeader` + `data-document-header`) */
  header: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * PT-07 document card frame (`DS-PT-07`).
 * Full-width CRM/document density; Platform Shell only.
 */
export function DocumentCard({
  header,
  children,
  className = "",
}: DocumentCardProps) {
  return (
    <PageLayout>
      <PageContent width="full" size="compact" className={className}>
        <div data-document-card className="min-w-0">
          <div className="min-w-0">{header}</div>
          <div className="mt-portal-4 flex min-w-0 flex-col gap-portal-4">
            {children}
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
}
