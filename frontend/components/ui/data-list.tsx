import type { ReactNode } from "react";

export type DataListItem = { id: string; label: ReactNode; value: ReactNode; technical?: boolean };

export function DataList({ items, columns = 1, size = "default", className = "" }: {
  items: readonly DataListItem[];
  columns?: 1 | 2 | 3 | 4;
  size?: "compact" | "default";
  className?: string;
}) {
  const columnClass = { 1: "grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 xl:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4" }[columns];
  return <dl className={`grid min-w-0 ${columnClass} ${size === "compact" ? "gap-x-4 gap-y-2.5" : "gap-x-5 gap-y-4"} ${className}`}>{items.map((item) => <div key={item.id} className="min-w-0"><dt className="text-xs font-medium text-portal-muted">{item.label}</dt><dd className={`mt-1 text-sm font-medium text-portal-text ${item.technical ? "[overflow-wrap:anywhere]" : ""}`}>{item.value}</dd></div>)}</dl>;
}
