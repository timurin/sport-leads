import { Ellipsis } from "lucide-react";
import type { ReactNode } from "react";

export function ActionMenu({ children, label = "Открыть меню действий", align = "end", className = "" }: {
  children: ReactNode;
  label?: string;
  align?: "start" | "end";
  className?: string;
}) {
  return (
    <details className={`relative ${className}`}>
      <summary
        aria-label={label}
        className="flex size-portal-control-icon cursor-pointer list-none items-center justify-center rounded-portal-md text-portal-muted hover:bg-portal-surface-secondary hover:text-portal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-focus-ring [&::-webkit-details-marker]:hidden"
      >
        <Ellipsis size={16} aria-hidden="true" />
      </summary>
      <div
        role="menu"
        className={`absolute z-50 mt-1 min-w-44 rounded-portal-lg border border-portal-border bg-portal-surface p-1.5 shadow-portal-overlay ${align === "end" ? "right-0" : "left-0"}`}
      >
        {children}
      </div>
    </details>
  );
}

export function ActionMenuItem({ children, tone = "default", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      {...props}
      className={`flex w-full items-center gap-2 rounded-portal-md px-3 py-2 text-left text-sm ${tone === "danger" ? "text-portal-danger hover:bg-portal-danger-soft" : "text-portal-text hover:bg-portal-surface-secondary"} ${className}`}
    >
      {children}
    </button>
  );
}
