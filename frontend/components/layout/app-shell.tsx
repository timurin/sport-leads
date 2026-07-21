import type { ReactNode } from "react";

import { AppTopbar } from "@/components/layout/app-topbar";
import { AppSidebar } from "@/components/navigation/app-sidebar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({
  children,
}: AppShellProps) {
  return (
    <div data-app-shell className="flex h-dvh overflow-hidden bg-portal-page">
      <AppSidebar />

      <div data-app-shell-content className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopbar />

        <main data-app-shell-main className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
