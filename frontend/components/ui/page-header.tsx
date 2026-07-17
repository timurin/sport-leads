import type { ReactNode } from "react";

import { EntityHeader } from "@/components/ui/entity-header";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  size?: "compact" | "default" | "spacious";
};

export function PageHeader({
  title,
  description,
  actions,
  size = "default",
}: PageHeaderProps) {
  return (
    <div className="border-b border-portal-border bg-portal-surface px-4 py-4 sm:px-6 sm:py-5">
      <EntityHeader title={title} description={description} actions={actions} size={size} />
    </div>
  );
}
