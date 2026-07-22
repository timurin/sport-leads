import type { ReactNode } from "react";

import { PageContent, PageLayout } from "@/components/layout/page-layout";

type VersionedWorkspaceProps = {
  header: ReactNode;
  versionBar: ReactNode;
  children: ReactNode;
  toolbar?: ReactNode;
  className?: string;
};

/**
 * PT-08 versioned workspace frame (`DS-PT-08`).
 * Version selector and lifecycle chrome sit above the editable body.
 */
export function VersionedWorkspace({
  header,
  versionBar,
  children,
  toolbar,
  className = "",
}: VersionedWorkspaceProps) {
  return (
    <PageLayout>
      <PageContent width="full" size="default" className={className}>
        <div data-versioned-workspace className="min-w-0">
          <div className="min-w-0">{header}</div>
          <div className="mt-portal-4 min-w-0">{versionBar}</div>
          {toolbar ? (
            <div className="mt-portal-3 min-w-0">{toolbar}</div>
          ) : null}
          <div className="mt-portal-4 flex min-w-0 flex-col gap-portal-4">
            {children}
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
}
