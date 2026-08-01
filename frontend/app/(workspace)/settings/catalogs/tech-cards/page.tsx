import { Suspense } from "react";

import { PageLayout } from "@/components/layout/page-layout";
import { TechnicalCardSettingsWorkspace } from "@/components/settings/technical-card-settings-workspace";
import { getTechnicalCardSettings } from "@/lib/technical-card-settings";

export default async function TechnicalCardSettingsPage() {
  const settings = await getTechnicalCardSettings();

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка настроек техкарт…
          </div>
        }
      >
        <TechnicalCardSettingsWorkspace settings={settings} />
      </Suspense>
    </PageLayout>
  );
}
