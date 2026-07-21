import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ListTotalsProps = {
  primary: ReactNode;
  secondary?: ReactNode;
  className?: string;
};

/**
 * List footer strip: shown count / selection totals (`DS-LIST-01`).
 */
export function ListTotals({
  primary,
  secondary,
  className = "",
}: ListTotalsProps) {
  return (
    <footer
      className={[
        "flex flex-wrap items-center justify-between gap-portal-2 border-t border-portal-border bg-portal-surface-secondary px-portal-4 py-portal-3 text-portal-body text-portal-muted lg:px-portal-6",
        className,
      ].join(" ")}
    >
      <span>{primary}</span>
      {secondary ? <span>{secondary}</span> : null}
    </footer>
  );
}

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
};

/**
 * Optional client pagination control. Demo lists may keep pageSize >= total.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className = "",
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div
      className={[
        "flex flex-wrap items-center justify-between gap-portal-3 border-t border-portal-border bg-portal-surface px-portal-4 py-portal-3 lg:px-portal-6",
        className,
      ].join(" ")}
      aria-label="Пагинация"
    >
      <p className="text-portal-body text-portal-muted">
        {total === 0 ? "Нет записей" : `${from}–${to} из ${total}`}
      </p>
      <div className="flex items-center gap-portal-2">
        <Button
          type="button"
          size="compact"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          Назад
        </Button>
        <span className="text-portal-caption text-portal-muted">
          {safePage} / {pageCount}
        </span>
        <Button
          type="button"
          size="compact"
          disabled={safePage >= pageCount}
          onClick={() => onPageChange(safePage + 1)}
        >
          Вперёд
        </Button>
      </div>
    </div>
  );
}
