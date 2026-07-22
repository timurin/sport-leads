"use client";

import type { ProductModelVersion, ProductModelVersionState } from "@/lib/demo-data/product-model-reference";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";

const stateTone: Record<ProductModelVersionState, StatusBadgeTone> = {
  draft: "warning",
  published: "success",
  archived: "neutral",
};

const stateLabel: Record<ProductModelVersionState, string> = {
  draft: "Черновик",
  published: "Опубликована",
  archived: "Архив",
};

type ProductModelVersionBarProps = {
  versions: ProductModelVersion[];
  activeVersionId: string;
  onSelect: (versionId: string) => void;
  disabled?: boolean;
};

/** PT-08 version selector strip (`DS-PT-08`). */
export function ProductModelVersionBar({
  versions,
  activeVersionId,
  onSelect,
  disabled = false,
}: ProductModelVersionBarProps) {
  return (
    <div
      data-version-bar
      className="min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-3 shadow-portal-sm"
    >
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-portal-caption font-semibold text-portal-muted">
          Версии модели
        </p>
        <p className="text-portal-caption text-portal-muted">
          Опубликованная база отмечена отдельно от активного черновика
        </p>
      </div>
      <div
        className="mt-portal-3 flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-1"
        role="tablist"
        aria-label="Версии модели"
      >
        {versions.map((version) => {
          const selected = version.id === activeVersionId;
          return (
            <button
              key={version.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onSelect(version.id)}
              className={[
                "flex shrink-0 snap-start flex-col items-start gap-1.5 rounded-portal-md border px-portal-3 py-portal-2 text-left transition",
                selected
                  ? "border-portal-primary bg-portal-primary-soft shadow-portal-sm"
                  : "border-portal-border bg-portal-surface-secondary hover:bg-portal-state-hover",
                disabled ? "cursor-not-allowed opacity-60" : "",
              ].join(" ")}
            >
              <span className="text-portal-body font-semibold text-portal-text">
                {version.label}
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <StatusBadge tone={stateTone[version.state]} size="compact">
                  {stateLabel[version.state]}
                </StatusBadge>
                {version.isPublishedBaseline ? (
                  <StatusBadge tone="primary" size="compact">
                    Базовая
                  </StatusBadge>
                ) : null}
                {version.isActive && version.state === "draft" ? (
                  <StatusBadge tone="primary" size="compact">
                    Редактируется
                  </StatusBadge>
                ) : null}
              </span>
              <span className="text-portal-caption text-portal-muted">
                {version.author} ·{" "}
                {new Date(version.updatedAt).toLocaleString("ru-RU")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
