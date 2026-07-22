import { X } from "lucide-react";
import type { ReactNode } from "react";

import { IconButton } from "@/components/ui/button";

type TreePaneVariant = "card" | "dock";

type TreePaneProps = {
  title: string;
  count?: number | string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Accessible name for the tree navigation region */
  label?: string;
  /** card — bordered panel; dock — flush side column (materials-like) */
  variant?: TreePaneVariant;
  onClose?: () => void;
};

/**
 * Tree column chrome for PT-04 (`DS-PT-04`).
 * Used docked (lg+) and as the body of the responsive tree drawer.
 */
export function TreePane({
  title,
  count,
  children,
  footer,
  className = "",
  label = "Дерево групп",
  variant = "dock",
  onClose,
}: TreePaneProps) {
  const surface =
    variant === "dock"
      ? "flex h-full min-h-0 min-w-0 flex-col bg-portal-surface"
      : "flex min-h-0 min-w-0 flex-col rounded-portal-lg border border-portal-border bg-portal-surface p-portal-3 shadow-portal-card";

  return (
    <aside
      data-tree-pane
      data-tree-pane-variant={variant}
      aria-label={label}
      className={[surface, className].filter(Boolean).join(" ")}
    >
      <div
        className={[
          "flex items-center justify-between gap-portal-2",
          variant === "dock"
            ? "border-b border-portal-border px-portal-4 py-portal-3"
            : "mb-portal-2",
        ].join(" ")}
      >
        <div className="flex min-w-0 items-center gap-portal-2">
          <h3 className="text-portal-body font-semibold text-portal-text">
            {title}
          </h3>
          {count !== undefined ? (
            <span className="text-portal-caption text-portal-muted">{count}</span>
          ) : null}
        </div>
        {onClose ? (
          <IconButton label="Скрыть дерево групп" onClick={onClose}>
            <X size={19} aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>
      <div
        className={[
          "min-h-0 flex-1 space-y-portal-1 overflow-y-auto",
          variant === "dock" ? "p-portal-3" : "",
        ].join(" ")}
      >
        {children}
      </div>
      {footer ? (
        <div
          className={[
            "border-t border-portal-border",
            variant === "dock" ? "p-portal-3" : "mt-portal-4 pt-portal-3",
          ].join(" ")}
        >
          {footer}
        </div>
      ) : null}
    </aside>
  );
}

type TreeNodeButtonProps = {
  selected?: boolean;
  depth?: number;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
};

/** Selectable tree row with portal selected/hover tokens. */
export function TreeNodeButton({
  selected = false,
  depth = 0,
  children,
  onClick,
  className = "",
}: TreeNodeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tree-node
      data-selected={selected || undefined}
      className={[
        "block w-full rounded-portal-md px-portal-2 py-portal-1 text-left text-portal-body transition-colors",
        selected
          ? "bg-portal-primary-soft font-semibold text-portal-primary"
          : "text-portal-text hover:bg-portal-surface-secondary",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
    >
      {children}
    </button>
  );
}
