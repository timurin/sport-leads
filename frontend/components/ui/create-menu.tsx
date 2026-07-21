"use client";

import { ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type CreateMenuItem = {
  id: string;
  label: string;
  description?: string;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
};

type CreateMenuProps = {
  /** Button text, e.g. "Создать" or "Создать лид" */
  label?: string;
  items: CreateMenuItem[];
  align?: "start" | "end";
  className?: string;
};

/**
 * Page-toolbar create control: primary button + menu of creatable entities.
 * Use a single-item menu or a plain Button when only one entity applies.
 */
export function CreateMenu({
  label = "Создать",
  items,
  align = "end",
  className = "",
}: CreateMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (items.length === 0) {
    return null;
  }

  if (items.length === 1 && !items[0].disabled) {
    const item = items[0];
    const content = (
      <>
        <Plus size={17} aria-hidden="true" />
        {label.includes(item.label) ? label : `Создать ${item.label.toLocaleLowerCase("ru")}`}
      </>
    );

    if (item.href) {
      return (
        <Link
          href={item.href}
          className={[
            "portal-focus-ring inline-flex h-portal-control-default shrink-0 items-center justify-center gap-portal-2 rounded-portal-md bg-portal-primary px-portal-4 text-portal-body font-medium text-portal-primary-on",
            "transition-colors hover:bg-portal-primary-hover",
            className,
          ].join(" ")}
        >
          <Plus size={17} aria-hidden="true" />
          {label}
        </Link>
      );
    }

    return (
      <button
        type="button"
        onClick={item.onSelect}
        className={[
          "portal-focus-ring inline-flex h-portal-control-default shrink-0 items-center justify-center gap-portal-2 rounded-portal-md bg-portal-primary px-portal-4 text-portal-body font-medium text-portal-primary-on",
          "transition-colors hover:bg-portal-primary-hover",
          className,
        ].join(" ")}
      >
        {content}
      </button>
    );
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className={[
          "portal-focus-ring inline-flex h-portal-control-default shrink-0 items-center justify-center gap-portal-2 rounded-portal-md bg-portal-primary px-portal-4 text-portal-body font-medium text-portal-primary-on",
          "transition-colors hover:bg-portal-primary-hover",
        ].join(" ")}
      >
        <Plus size={17} aria-hidden="true" />
        {label}
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={[
            "absolute z-portal-popover mt-1 min-w-56 rounded-portal-lg border border-portal-border bg-portal-surface p-1.5 shadow-portal-overlay",
            align === "end" ? "right-0" : "left-0",
          ].join(" ")}
        >
          {items.map((item) => (
            <CreateMenuRow
              key={item.id}
              item={item}
              onClose={() => setOpen(false)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CreateMenuRow({
  item,
  onClose,
}: {
  item: CreateMenuItem;
  onClose: () => void;
}) {
  const className = [
    "flex w-full flex-col rounded-portal-md px-3 py-2 text-left",
    item.disabled
      ? "cursor-not-allowed text-portal-muted opacity-60"
      : "text-portal-text hover:bg-portal-surface-secondary",
  ].join(" ");

  const body: ReactNode = (
    <>
      <span className="text-sm font-medium">{item.label}</span>
      {item.description ? (
        <span className="text-xs text-portal-muted">{item.description}</span>
      ) : null}
    </>
  );

  if (item.disabled) {
    return (
      <div role="menuitem" aria-disabled="true" className={className}>
        {body}
      </div>
    );
  }

  if (item.href) {
    return (
      <Link
        role="menuitem"
        href={item.href}
        className={className}
        onClick={onClose}
      >
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      className={className}
      onClick={() => {
        item.onSelect?.();
        onClose();
      }}
    >
      {body}
    </button>
  );
}
