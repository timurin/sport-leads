/**
 * Shared helpers for catalog folder trees (sewing / product-models /
 * work-centers / nomenclature categories) — DnD nest rules + hierarchy UI.
 */

export type CatalogFolderNode = {
  id: number;
  parent_id: number | null;
};

export const CATALOG_DND_ROOT_ID = "catalog-root";

export type CatalogDndEntity =
  | { kind: "folder"; id: number }
  | { kind: "item"; id: number }
  | { kind: "root" };

export function catalogFolderDndId(folderId: number): string {
  return `folder:${folderId}`;
}

export function catalogItemDndId(itemId: number): string {
  return `item:${itemId}`;
}

export function parseCatalogDndId(raw: string | number): CatalogDndEntity | null {
  const value = String(raw);
  if (value === CATALOG_DND_ROOT_ID) return { kind: "root" };
  if (value.startsWith("folder:")) {
    const id = Number(value.slice("folder:".length));
    if (!Number.isSafeInteger(id)) return null;
    return { kind: "folder", id };
  }
  if (value.startsWith("item:")) {
    const id = Number(value.slice("item:".length));
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    return { kind: "item", id };
  }
  return null;
}

/** True when `folderId` is `ancestorId` or nested under it. */
export function isCatalogFolderDescendant(
  folders: CatalogFolderNode[],
  folderId: number,
  ancestorId: number,
): boolean {
  if (folderId === ancestorId) return true;
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  let current: number | null = folderId;
  const seen = new Set<number>();
  while (current != null) {
    if (seen.has(current)) return false;
    seen.add(current);
    if (current === ancestorId) return true;
    current = byId.get(current)?.parent_id ?? null;
  }
  return false;
}

/**
 * May nest `dragFolderId` under `targetParentId` (null = root).
 * Rejects self, current parent no-op is allowed as "valid but unchanged",
 * and any target that is the drag folder or its descendant.
 */
export function canNestCatalogFolder(
  folders: CatalogFolderNode[],
  dragFolderId: number,
  targetParentId: number | null,
): boolean {
  if (targetParentId === dragFolderId) return false;
  if (targetParentId != null) {
    if (!folders.some((folder) => folder.id === targetParentId)) return false;
    if (isCatalogFolderDescendant(folders, targetParentId, dragFolderId)) {
      return false;
    }
  }
  return folders.some((folder) => folder.id === dragFolderId);
}

export function catalogFolderWouldChangeParent(
  folders: CatalogFolderNode[],
  dragFolderId: number,
  targetParentId: number | null,
): boolean {
  const folder = folders.find((row) => row.id === dragFolderId);
  if (!folder) return false;
  return folder.parent_id !== targetParentId;
}

/** Indent + nest guide for hierarchy cells. */
export function catalogHierarchyPadStyle(depth: number): {
  paddingLeft: string;
} {
  return { paddingLeft: `${Math.max(0, depth) * 1.25 + 0.25}rem` };
}

export function catalogHierarchyGuideClass(depth: number): string {
  if (depth <= 0) return "";
  return "border-l-2 border-portal-border/80";
}

export function catalogFolderRowSurfaceClass(): string {
  return "bg-portal-surface-2/50";
}

export function catalogItemRowSurfaceClass(depth: number): string {
  return depth > 0 ? "bg-portal-surface" : "";
}
