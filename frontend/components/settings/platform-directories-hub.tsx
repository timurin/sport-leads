"use client";

import Link from "next/link";

import { PageToolbar } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { PlatformDirectoryRegistryItem } from "@/lib/platform-directories";

function statusTone(
  status: string,
): "success" | "warning" | "neutral" {
  if (status === "live") return "success";
  if (status === "planned") return "warning";
  return "neutral";
}

function statusLabel(status: string): string {
  if (status === "live") return "Живой";
  if (status === "planned") return "План";
  if (status === "deprecated") return "Устар.";
  return status;
}

function DirectoryCard({ item }: { item: PlatformDirectoryRegistryItem }) {
  return (
    <SectionCard
      title={item.title}
      description={item.description}
      size="compact"
      actions={
        <StatusBadge size="compact" tone={statusTone(item.status)}>
          {statusLabel(item.status)}
        </StatusBadge>
      }
    >
      <p className="text-portal-caption text-portal-muted">
        Код: <code>{item.code}</code>
        {item.status === "live" ? " · открыть список" : " · маршрут появится позже"}
      </p>
    </SectionCard>
  );
}

export function PlatformDirectoriesHub({
  items,
}: {
  items: PlatformDirectoryRegistryItem[];
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageToolbar
        start={
          <div className="min-w-0">
            <p className="text-portal-body font-semibold text-portal-text">
              Справочники платформы
            </p>
            <p className="text-portal-caption text-portal-muted">
              Кросс-модульные каталоги Администрирования (`18.2`)
            </p>
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto bg-portal-bg p-portal-4 lg:p-portal-6">
        <div className="mx-auto grid w-full max-w-5xl gap-portal-4 md:grid-cols-2">
          {items.map((item) =>
            item.status === "live" ? (
              <Link
                key={item.code}
                href={item.list_path}
                className="block rounded-portal-md outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-portal-accent"
              >
                <DirectoryCard item={item} />
              </Link>
            ) : (
              <div key={item.code}>
                <DirectoryCard item={item} />
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
