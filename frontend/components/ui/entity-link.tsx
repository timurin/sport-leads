import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";

type EntityLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  children: ReactNode;
  className?: string;
  external?: boolean;
};

/**
 * Canonical entity navigation link (`DS-LINK-01`).
 */
export function EntityLink({
  children,
  className = "",
  external = false,
  ...props
}: EntityLinkProps) {
  return (
    <Link
      {...props}
      className={[
        "inline-flex max-w-full items-center gap-1.5 font-semibold text-portal-primary hover:text-portal-primary-hover",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-focus-ring rounded-sm",
        className,
      ].join(" ")}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {children}
    </Link>
  );
}

type InlineEditActionsProps = {
  editing: boolean;
  onEdit: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  editLabel?: string;
  saveLabel?: string;
  cancelLabel?: string;
  disabled?: boolean;
};

/**
 * Standard edit/save/cancel action cluster for inline blocks (`DS-LINK-01`).
 * Pair with `Button` + `DS-FORM-01` controls inside the editable region.
 */
export function InlineEditActions({
  editing,
  onEdit,
  onSave,
  onCancel,
  editLabel = "Изменить",
  saveLabel = "Сохранить",
  cancelLabel = "Отмена",
  disabled = false,
}: InlineEditActionsProps) {
  if (!editing) {
    return (
      <Button type="button" size="compact" variant="ghost" onClick={onEdit} disabled={disabled}>
        {editLabel}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-portal-2">
      {onCancel ? (
        <Button type="button" size="compact" onClick={onCancel} disabled={disabled}>
          {cancelLabel}
        </Button>
      ) : null}
      {onSave ? (
        <Button type="button" size="compact" variant="primary" onClick={onSave} disabled={disabled}>
          {saveLabel}
        </Button>
      ) : null}
    </div>
  );
}
