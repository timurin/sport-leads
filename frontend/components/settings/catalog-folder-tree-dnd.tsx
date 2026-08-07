"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import {
  createContext,
  useContext,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { DataTableRow } from "@/components/ui/data-table";
import {
  CATALOG_DND_ROOT_ID,
  catalogFolderDndId,
  catalogHierarchyGuideClass,
  catalogHierarchyPadStyle,
  catalogItemDndId,
  parseCatalogDndId,
  type CatalogDndEntity,
} from "@/lib/catalog-folder-dnd";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type CatalogTreeDndDrop = {
  active: CatalogDndEntity;
  over: CatalogDndEntity;
};

export type { CatalogTreeDndDrop };

const CatalogTreeDndEnabledContext = createContext({ enabled: false });

export function CatalogTreeDndProvider({
  enabled,
  onDrop,
  children,
}: {
  enabled: boolean;
  onDrop: (drop: CatalogTreeDndDrop) => void;
  children: ReactNode;
}) {
  const dndId = useId();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const ctx = useMemo(() => ({ enabled }), [enabled]);

  const handleDragStart = (event: DragStartEvent) => {
    const label = event.active.data.current?.label;
    setActiveLabel(typeof label === "string" ? label : "Перемещение…");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLabel(null);
    if (!enabled) return;
    const active = parseCatalogDndId(event.active.id);
    const over = event.over ? parseCatalogDndId(event.over.id) : null;
    if (!active || !over || active.kind === "root") return;
    onDrop({ active, over });
  };

  return (
    <CatalogTreeDndEnabledContext.Provider value={ctx}>
      <DndContext
        id={dndId}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveLabel(null)}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activeLabel ? (
            <div className="rounded-portal border border-portal-border bg-portal-surface px-portal-3 py-portal-2 text-portal-body shadow-md">
              {activeLabel}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </CatalogTreeDndEnabledContext.Provider>
  );
}

function useDndEnabled() {
  return useContext(CatalogTreeDndEnabledContext).enabled;
}

export function CatalogTreeDepthCell({
  depth,
  className = "",
  children,
}: {
  depth: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "flex min-w-0 items-center gap-1",
        catalogHierarchyGuideClass(depth),
        depth > 0 ? "pl-portal-2" : "",
        className,
      )}
      style={catalogHierarchyPadStyle(depth)}
    >
      {children}
    </div>
  );
}

export function CatalogTreeDragHandle({
  listeners,
  attributes,
  disabled,
}: {
  // dnd-kit listener/attribute bags
  listeners?: object;
  attributes?: object;
  disabled?: boolean;
}) {
  if (disabled) {
    return <span className="inline-flex size-7 shrink-0" aria-hidden="true" />;
  }
  return (
    <button
      type="button"
      className="inline-flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-portal text-portal-muted hover:bg-portal-surface-2 active:cursor-grabbing"
      aria-label="Перетащить"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" aria-hidden="true" />
    </button>
  );
}

export function CatalogTreeDraggableFolder({
  folderId,
  label,
  disabled,
  className = "",
  style,
  children,
}: {
  folderId: number;
  label: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  children: (args: {
    handle: ReactNode;
    isDragging: boolean;
    isOver: boolean;
  }) => ReactNode;
}) {
  const enabled = useDndEnabled();
  const dndDisabled = Boolean(disabled || !enabled);
  const id = catalogFolderDndId(folderId);
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    disabled: dndDisabled,
    data: { label, kind: "folder", folderId },
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id,
    disabled: dndDisabled,
    data: { kind: "folder", folderId },
  });

  return (
    <DataTableRow
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      className={cx(
        className,
        isDragging && "opacity-50",
        isOver && !isDragging && "bg-portal-accent/10",
      )}
      style={{
        ...style,
        transform: CSS.Translate.toString(transform),
      }}
    >
      {children({
        handle: (
          <CatalogTreeDragHandle
            attributes={attributes}
            listeners={listeners}
            disabled={dndDisabled}
          />
        ),
        isDragging,
        isOver: isOver && !isDragging,
      })}
    </DataTableRow>
  );
}

export function CatalogTreeDraggableItem({
  itemId,
  label,
  disabled,
  className = "",
  style,
  children,
}: {
  itemId: number;
  label: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  children: (args: { handle: ReactNode; isDragging: boolean }) => ReactNode;
}) {
  const enabled = useDndEnabled();
  const dndDisabled = Boolean(disabled || !enabled);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: catalogItemDndId(itemId),
      disabled: dndDisabled,
      data: { label, kind: "item", itemId },
    });

  return (
    <DataTableRow
      ref={setNodeRef}
      className={cx(className, isDragging && "opacity-50")}
      style={{
        ...style,
        transform: CSS.Translate.toString(transform),
      }}
    >
      {children({
        handle: (
          <CatalogTreeDragHandle
            attributes={attributes}
            listeners={listeners}
            disabled={dndDisabled}
          />
        ),
        isDragging,
      })}
    </DataTableRow>
  );
}

/** Droppable-only folder (work-center stages — not nestable as folders). */
export function CatalogTreeDroppableFolder({
  folderId,
  disabled,
  className = "",
  children,
}: {
  folderId: number;
  disabled?: boolean;
  className?: string;
  children: (args: { isOver: boolean }) => ReactNode;
}) {
  const enabled = useDndEnabled();
  const dndDisabled = Boolean(disabled || !enabled);
  const { setNodeRef, isOver } = useDroppable({
    id: catalogFolderDndId(folderId),
    disabled: dndDisabled,
    data: { kind: "folder", folderId },
  });

  return (
    <DataTableRow
      ref={setNodeRef}
      className={cx(className, isOver && "bg-portal-accent/10")}
    >
      {children({ isOver })}
    </DataTableRow>
  );
}

export function CatalogTreeRootDropZone({
  disabled,
  className = "",
  label = "Перетащите сюда, чтобы поместить в корень",
}: {
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  const enabled = useDndEnabled();
  const dndDisabled = Boolean(disabled || !enabled);
  const { setNodeRef, isOver } = useDroppable({
    id: CATALOG_DND_ROOT_ID,
    disabled: dndDisabled,
    data: { kind: "root" },
  });

  return (
    <div
      ref={setNodeRef}
      className={cx(
        "border-b border-portal-line px-portal-4 py-portal-2 text-portal-caption text-portal-muted",
        isOver && "bg-portal-accent/10 text-portal-text",
        className,
      )}
    >
      {label}
    </div>
  );
}
