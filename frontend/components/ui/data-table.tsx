import type {
  HTMLAttributes,
  ReactNode,
  ThHTMLAttributes,
  TdHTMLAttributes,
  TableHTMLAttributes,
} from "react";

type DataTableProps = TableHTMLAttributes<HTMLTableElement> & {
  children: ReactNode;
  /** Minimum width for wide tables (local x-scroll owner). */
  minWidthClassName?: string;
  className?: string;
};

/**
 * Portal table chrome (`DS-TABLE-01`).
 * Wrap with overflow container via `DataTableFrame`.
 */
export function DataTable({
  children,
  minWidthClassName = "min-w-0",
  className = "",
  ...props
}: DataTableProps) {
  return (
    <table
      {...props}
      className={[
        "w-full border-collapse text-left text-portal-body",
        minWidthClassName,
        className,
      ].join(" ")}
    >
      {children}
    </table>
  );
}

export function DataTableFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "overflow-x-auto rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function DataTableHead({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <thead
      className={[
        "sticky top-0 z-portal-raised border-b border-portal-border bg-portal-surface-secondary",
        className,
      ].join(" ")}
    >
      {children}
    </thead>
  );
}

export function DataTableBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tbody className={`divide-y divide-portal-border ${className}`}>{children}</tbody>;
}

export function DataTableHeaderCell({
  children,
  className = "",
  align = "left",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & {
  children?: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      {...props}
      className={[
        "px-portal-4 py-portal-3 text-portal-caption font-semibold uppercase tracking-wide text-portal-muted",
        align === "right" ? "text-right" : "text-left",
        className,
      ].join(" ")}
    >
      {children}
    </th>
  );
}

export function DataTableCell({
  children,
  className = "",
  align = "left",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
  children?: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      {...props}
      className={[
        "px-portal-4 py-portal-3 text-portal-text",
        align === "right" ? "text-right" : "text-left",
        className,
      ].join(" ")}
    >
      {children}
    </td>
  );
}

export function DataTableRow({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLTableRowElement> & {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr
      {...props}
      className={`hover:bg-portal-primary-soft/40 ${className}`}
    >
      {children}
    </tr>
  );
}
