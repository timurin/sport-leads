import type { ReactNode } from "react";

const DEFAULT_GAP = "gap-[14px]";

type CatalogVersionedCardLayoutProps = {
  /** Реквизиты + блоки основной колонки (варианты, история, …). */
  main: ReactNode;
  /** Фото / обложка (средняя колонка, 300px на ≥1900). */
  media: ReactNode;
  /** Опционально: правая колонка (версии и т.п.). */
  versions?: ReactNode;
  className?: string;
  gapClassName?: string;
};

/**
 * PT-08 catalog card body grid (`DS-PT-08-CATALOG`).
 *
 * Breakpoints:
 * - &lt;1300: one column — **media first**, then main, then versions
 * - 1300–1899: 75 / 25 (main | media[+versions])
 * - ≥1900: 60fr / 300px [/ 20fr if versions]
 *
 * Reference: product-models card — `docs/design-system/pt-08-catalog-card-layout.md`
 */
export function CatalogVersionedCardLayout({
  main,
  media,
  versions,
  className = "",
  gapClassName = DEFAULT_GAP,
}: CatalogVersionedCardLayoutProps) {
  const hasVersions = Boolean(versions);

  return (
    <div
      data-catalog-versioned-card-layout
      className={[
        "grid items-start",
        gapClassName,
        "grid-cols-1",
        "min-[1300px]:grid-cols-[minmax(0,75fr)_minmax(0,25fr)]",
        hasVersions
          ? "min-[1900px]:grid-cols-[minmax(0,60fr)_300px_minmax(0,20fr)]"
          : "min-[1900px]:grid-cols-[minmax(0,1fr)_300px]",
        className,
      ].join(" ")}
    >
      <div
        data-slot="main"
        className={[
          "order-2 flex min-w-0 flex-col",
          gapClassName,
          "min-[1300px]:order-none",
          hasVersions
            ? "min-[1300px]:row-span-2 min-[1900px]:row-span-1"
            : "",
        ].join(" ")}
      >
        {main}
      </div>
      <div
        data-slot="media"
        className={[
          "order-1 min-w-0",
          "min-[1300px]:order-none",
          "min-[1900px]:w-[300px]",
        ].join(" ")}
      >
        {media}
      </div>
      {hasVersions ? (
        <div
          data-slot="versions"
          className="order-3 min-w-0 min-[1300px]:order-none"
        >
          {versions}
        </div>
      ) : null}
    </div>
  );
}
