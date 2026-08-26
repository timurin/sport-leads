import type { ReactNode } from "react";

import { AppTopbar } from "@/components/layout/app-topbar";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { ToastProvider } from "@/components/ui/toast";
import type { PlatformUserMe } from "@/lib/auth/session-mapping";
import { isSewingCabinetRestricted } from "@/lib/auth/session-mapping";
import { buildAppSections, filterAppSectionsForSession } from "@/lib/navigation";
import { loadPlatformBrand } from "@/lib/platform-brand";
import {
  buildShopStageModulesFromCatalog,
  SHOP_STAGE_MODULES,
} from "@/lib/production/shop-stage-modules";
import { getProductionStages } from "@/lib/production-stages";

type AppShellProps = {
  children: ReactNode;
  overlay?: ReactNode;
  me: PlatformUserMe;
};

async function loadAppSections(me: PlatformUserMe) {
  const permissions = me.permissions;
  if (isSewingCabinetRestricted(me)) {
    return filterAppSectionsForSession(buildAppSections(), permissions);
  }
  try {
    const stages = await getProductionStages({ active_only: true, limit: 200 });
    const shopModules = buildShopStageModulesFromCatalog(stages);
    return filterAppSectionsForSession(
      buildAppSections(shopModules),
      permissions,
    );
  } catch {
    return filterAppSectionsForSession(
      buildAppSections(SHOP_STAGE_MODULES),
      permissions,
    );
  }
}

export async function AppShell({ children, overlay = null, me }: AppShellProps) {
  const [sections, brand] = await Promise.all([
    loadAppSections(me),
    loadPlatformBrand(),
  ]);

  return (
    <ToastProvider>
      <div data-app-shell className="flex h-dvh overflow-hidden bg-portal-page">
        <AppSidebar sections={sections} brand={brand} />

        <div data-app-shell-content className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AppTopbar sections={sections} />

          <main data-app-shell-main className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
      {overlay}
    </ToastProvider>
  );
}
