import type { ReactNode } from "react";

import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";

type PageStateFrameProps = {
  children: ReactNode;
  className?: string;
};

function PageStateFrame({ children, className = "" }: PageStateFrameProps) {
  return (
    <PageLayout>
      <PageContent size="spacious" className={className}>
        {children}
      </PageContent>
    </PageLayout>
  );
}

/**
 * Shared workspace loading surface (`DS-PAGE-06`).
 * Route `loading.tsx` files should prefer this over ad-hoc pulse blocks.
 */
export function PageLoadingState({
  label = "Загрузка…",
}: {
  label?: string;
}) {
  return (
    <PageStateFrame>
      <div
        data-page-loading
        className="animate-pulse rounded-portal-lg border border-portal-border bg-portal-surface p-portal-5"
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        <div className="h-4 w-40 rounded-portal-sm bg-portal-surface-secondary" />
        <div className="mt-portal-4 h-8 w-2/3 max-w-md rounded-portal-sm bg-portal-surface-secondary" />
        <div className="mt-portal-3 h-4 w-48 rounded-portal-sm bg-portal-surface-secondary" />
        <span className="sr-only">{label}</span>
      </div>
    </PageStateFrame>
  );
}

type PageErrorStateProps = {
  title?: string;
  description?: string;
  error?: Error;
  reset?: () => void;
  secondaryAction?: ReactNode;
};

/**
 * Shared workspace error surface with standard `reset` retry (`DS-PAGE-06`).
 */
export function PageErrorState({
  title = "Не удалось загрузить страницу",
  description = "Произошла ошибка при получении данных. Попробуйте повторить запрос.",
  error,
  reset,
  secondaryAction,
}: PageErrorStateProps) {
  return (
    <PageStateFrame>
      <section
        data-page-error
        className="rounded-portal-lg border border-portal-danger bg-portal-danger-soft p-portal-6 text-center"
        role="alert"
      >
        <h1 className="text-portal-page font-semibold text-portal-danger">
          {title}
        </h1>
        <p className="mt-portal-2 text-portal-body text-portal-danger">
          {error?.message || description}
        </p>
        <div className="mt-portal-4 flex flex-wrap items-center justify-center gap-portal-3">
          {reset ? (
            <Button type="button" variant="primary" onClick={reset}>
              Повторить
            </Button>
          ) : null}
          {secondaryAction}
        </div>
      </section>
    </PageStateFrame>
  );
}

type PageNotFoundStateProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
};

/** Shared not-found panel for segment `not-found.tsx`. */
export function PageNotFoundState({
  title = "Страница не найдена",
  description = "Проверьте ссылку или вернитесь назад.",
  action,
}: PageNotFoundStateProps) {
  return (
    <PageStateFrame>
      <section
        data-page-not-found
        className="rounded-portal-lg border border-portal-border bg-portal-surface p-portal-6 text-center shadow-portal-card"
      >
        <h1 className="text-portal-page font-semibold text-portal-text">{title}</h1>
        <p className="mt-portal-2 text-portal-body text-portal-muted">
          {description}
        </p>
        {action ? (
          <div className="mt-portal-4 flex flex-wrap justify-center gap-portal-3">
            {action}
          </div>
        ) : null}
      </section>
    </PageStateFrame>
  );
}
