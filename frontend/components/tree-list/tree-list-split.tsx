"use client";

import { useEffect, type ReactNode } from "react";

export type TreeListRenderApi = {
  onClose: () => void;
};

type TreeListSplitProps = {
  /** Factory so docked + drawer each get their own tree instance */
  renderTree: (api: TreeListRenderApi) => ReactNode;
  children: ReactNode;
  /** Controlled open state — docked column on `lg+`, overlay drawer below */
  treeOpen: boolean;
  onTreeOpenChange: (open: boolean) => void;
  className?: string;
};

/**
 * PT-04 split: collapsible left tree (materials-like show/hide) + full-bleed list.
 * `lg+` docks the tree; `&lt;lg` uses left overlay drawer (R5).
 * Contract: `DS-PT-04`.
 */
export function TreeListSplit({
  renderTree,
  children,
  treeOpen,
  onTreeOpenChange,
  className = "",
}: TreeListSplitProps) {
  useEffect(() => {
    if (!treeOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onTreeOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [treeOpen, onTreeOpenChange]);

  const close = () => onTreeOpenChange(false);

  return (
    <div
      data-tree-list-split
      className={[
        "relative flex min-h-0 min-w-0 flex-1",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {treeOpen ? (
        <div
          data-tree-list-docked
          className="hidden w-[280px] shrink-0 overflow-hidden border-r border-portal-border lg:flex lg:flex-col"
        >
          {renderTree({ onClose: close })}
        </div>
      ) : null}

      <div data-tree-list-content className="min-w-0 flex-1 bg-portal-surface">
        {children}
      </div>

      {treeOpen ? (
        <div
          id="tree-list-drawer"
          data-tree-list-drawer
          className="fixed inset-0 z-portal-modal-1 lg:hidden"
          role="presentation"
        >
          <button
            type="button"
            aria-label="Закрыть дерево групп"
            className="absolute inset-0 bg-slate-950/40"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Группы"
            className="absolute inset-y-0 left-0 flex w-full max-w-[min(100%,320px)] flex-col bg-portal-surface shadow-portal-overlay"
          >
            {renderTree({ onClose: close })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type TreeListContentProps = {
  children: ReactNode;
  className?: string;
};

/** Content column wrapper (filters + table) — flush, no card stack. */
export function TreeListContent({
  children,
  className = "",
}: TreeListContentProps) {
  return (
    <div
      data-tree-list-content-pane
      className={["flex min-h-0 min-w-0 flex-col", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
