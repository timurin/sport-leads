"use client";

import {
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useTransition } from "react";

import { TreeNodeButton, TreePane } from "@/components/tree-list/tree-pane";
import { IconButton } from "@/components/ui/button";
import {
  createClientFolder,
  deleteClientFolder,
  moveClientFolderSibling,
  updateClientFolder,
} from "@/app/(workspace)/sales/clients/client-folder-actions";
import {
  childClientFolders,
  type ClientFolderScope,
  type ClientFolderView,
} from "@/lib/sales/client-folders";

type Props = {
  folders: ClientFolderView[];
  scope: ClientFolderScope;
  onScopeChange: (scope: ClientFolderScope) => void;
  unfiledCount: number;
  counts: Map<number, number>;
  loadError?: string;
};

export function ClientFolderTree({
  folders,
  scope,
  onScopeChange,
  unfiledCount,
  counts,
  loadError,
}: Props) {
  const [, startTransition] = useTransition();

  const run = (task: () => Promise<{ ok: true } | { ok: false; message: string }>) => {
    startTransition(async () => {
      const result = await task();
      if (!result.ok) window.alert(result.message);
    });
  };

  const create = (parentId: number | null) => {
    const name = window.prompt(parentId == null ? "Новая папка" : "Вложенная папка");
    if (!name) return;
    run(() => createClientFolder({ name, parent_id: parentId }));
  };

  return (
    <TreePane
      title="Папки"
      count={folders.length}
      variant="card"
      label="Папки клиентов"
      className="min-h-[240px]"
      headerActions={
        <IconButton label="Создать папку" onClick={() => create(null)}>
          <FolderPlus size={16} aria-hidden="true" />
        </IconButton>
      }
    >
      {loadError ? (
        <p className="px-portal-2 text-portal-caption text-portal-danger">{loadError}</p>
      ) : null}
      <TreeNodeButton selected={scope === "all"} onClick={() => onScopeChange("all")}>
        Все
      </TreeNodeButton>
      <TreeNodeButton
        selected={scope === "unfiled"}
        onClick={() => onScopeChange("unfiled")}
      >
        Без папки ({unfiledCount})
      </TreeNodeButton>
      <FolderBranch
        folders={folders}
        parentId={null}
        depth={0}
        scope={scope}
        onScopeChange={onScopeChange}
        counts={counts}
        onCreate={create}
        onRename={(folder) => {
          const name = window.prompt("Название папки", folder.name);
          if (!name || name.trim() === folder.name) return;
          run(() => updateClientFolder(folder.id, { name }));
        }}
        onDelete={(folder) => {
          if (!window.confirm(`Удалить папку «${folder.name}»?`)) return;
          run(() => deleteClientFolder(folder.id));
        }}
        onMove={(folder, direction) => {
          run(() => moveClientFolderSibling(folder.id, direction));
        }}
      />
    </TreePane>
  );
}

function FolderBranch({
  folders,
  parentId,
  depth,
  scope,
  onScopeChange,
  counts,
  onCreate,
  onRename,
  onDelete,
  onMove,
}: {
  folders: ClientFolderView[];
  parentId: number | null;
  depth: number;
  scope: ClientFolderScope;
  onScopeChange: (scope: ClientFolderScope) => void;
  counts: Map<number, number>;
  onCreate: (parentId: number | null) => void;
  onRename: (folder: ClientFolderView) => void;
  onDelete: (folder: ClientFolderView) => void;
  onMove: (folder: ClientFolderView, direction: "up" | "down") => void;
}) {
  const siblings = childClientFolders(folders, parentId);
  return (
    <>
      {siblings.map((folder, index) => (
        <div key={folder.id}>
          <div className="flex items-center gap-0.5">
            <div className="min-w-0 flex-1">
              <TreeNodeButton
                selected={scope === folder.id}
                depth={depth}
                onClick={() => onScopeChange(folder.id)}
              >
                {folder.name} ({counts.get(folder.id) ?? 0})
              </TreeNodeButton>
            </div>
            <IconButton label="Создать вложенную" onClick={() => onCreate(folder.id)}>
              <Plus size={14} aria-hidden="true" />
            </IconButton>
            <IconButton label="Переименовать" onClick={() => onRename(folder)}>
              <Pencil size={14} aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Выше"
              disabled={index === 0}
              onClick={() => onMove(folder, "up")}
            >
              <ChevronUp size={14} aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Ниже"
              disabled={index === siblings.length - 1}
              onClick={() => onMove(folder, "down")}
            >
              <ChevronDown size={14} aria-hidden="true" />
            </IconButton>
            <IconButton label="Удалить" onClick={() => onDelete(folder)}>
              <Trash2 size={14} aria-hidden="true" />
            </IconButton>
          </div>
          <FolderBranch
            folders={folders}
            parentId={folder.id}
            depth={depth + 1}
            scope={scope}
            onScopeChange={onScopeChange}
            counts={counts}
            onCreate={onCreate}
            onRename={onRename}
            onDelete={onDelete}
            onMove={onMove}
          />
        </div>
      ))}
    </>
  );
}
