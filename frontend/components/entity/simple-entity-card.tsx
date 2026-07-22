import type { ReactNode } from "react";

import { PageContent, PageLayout } from "@/components/layout/page-layout";

type SimpleEntityCardProps = {
  /** Typically `EntityHeader` */
  header: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * PT-05 simple entity card frame (`DS-PT-05`).
 * Platform Shell only — no local sidebar.
 */
export function SimpleEntityCard({
  header,
  children,
  className = "",
}: SimpleEntityCardProps) {
  return (
    <PageLayout>
      <PageContent width="wide" size="default" className={className}>
        <div data-simple-entity-card className="min-w-0">
          <div className="min-w-0">{header}</div>
          <div className="mt-portal-4 flex min-w-0 flex-col gap-portal-4">
            {children}
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
}
