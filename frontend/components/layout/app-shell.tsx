import type { ReactNode } from "react";

import { AppSidebar } from "@/components/navigation/app-sidebar";
import { TopNavigation } from "@/components/navigation/top-navigation";
import { WorkspaceTabs } from "@/components/navigation/workspace-tabs";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <AppSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavigation />
        <WorkspaceTabs />

        <main className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}