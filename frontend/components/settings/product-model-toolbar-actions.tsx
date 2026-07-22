"use client";

import { Archive, Copy, Pencil, Printer, Save } from "lucide-react";

import { IconButton } from "@/components/ui/button";

type ProductModelToolbarActionsProps = {
  /** Visual-only icons (list page). */
  inert?: boolean;
  disabled?: boolean;
  editing?: boolean;
  canArchive?: boolean;
  canSave?: boolean;
  onEdit?: () => void;
  onArchive?: () => void;
  onSave?: () => void;
  onCopy?: () => void;
  onPrint?: () => void;
};

/** Toolbar icons for product-model actions (active on card, inert on list). */
export function ProductModelToolbarActions({
  inert = false,
  disabled = false,
  editing = false,
  canArchive = true,
  canSave = false,
  onEdit,
  onArchive,
  onSave,
  onCopy,
  onPrint,
}: ProductModelToolbarActionsProps) {
  const locked = inert || disabled;

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="toolbar"
      aria-label={inert ? "Действия модели (недоступны в списке)" : "Действия модели"}
    >
      <IconButton
        label="Редактировать"
        variant="secondary"
        disabled={locked || editing}
        onClick={inert ? undefined : onEdit}
      >
        <Pencil className="size-4" />
      </IconButton>
      <IconButton
        label="Архив"
        variant="secondary"
        disabled={locked || !canArchive}
        onClick={inert ? undefined : onArchive}
      >
        <Archive className="size-4" />
      </IconButton>
      <IconButton
        label="Сохранить"
        variant="secondary"
        disabled={locked || !canSave}
        onClick={inert ? undefined : onSave}
      >
        <Save className="size-4" />
      </IconButton>
      <IconButton
        label="Копировать"
        variant="secondary"
        disabled={locked}
        onClick={inert ? undefined : onCopy}
      >
        <Copy className="size-4" />
      </IconButton>
      <IconButton
        label="Распечатать"
        variant="secondary"
        disabled={locked}
        onClick={inert ? undefined : onPrint}
      >
        <Printer className="size-4" />
      </IconButton>
    </div>
  );
}
