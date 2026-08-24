import { isCatalogFolderDescendant } from "../catalog-folder-dnd.ts";

export type ApiClientFolder = {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
};

export type ClientFolderView = {
  id: number;
  name: string;
  parentId: number | null;
  sortOrder: number;
};

export type ClientFolderScope = "all" | "unfiled" | number;

export function fromApiClientFolder(folder: ApiClientFolder): ClientFolderView {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parent_id,
    sortOrder: folder.sort_order,
  };
}

export function clientMatchesFolderScope(
  folderId: number | null,
  scope: ClientFolderScope,
  folders: ClientFolderView[],
): boolean {
  if (scope === "all") return true;
  if (scope === "unfiled") return folderId == null;
  if (folderId == null) return false;
  return isCatalogFolderDescendant(
    folders.map((folder) => ({ id: folder.id, parent_id: folder.parentId })),
    folderId,
    scope,
  );
}

export function sortClientFolders(folders: ClientFolderView[]): ClientFolderView[] {
  return [...folders].sort((first, second) => {
    if (first.parentId !== second.parentId) {
      return (first.parentId ?? -1) - (second.parentId ?? -1);
    }
    if (first.sortOrder !== second.sortOrder) return first.sortOrder - second.sortOrder;
    return first.name.localeCompare(second.name, "ru");
  });
}

export function childClientFolders(
  folders: ClientFolderView[],
  parentId: number | null,
): ClientFolderView[] {
  return sortClientFolders(folders).filter((folder) => folder.parentId === parentId);
}
