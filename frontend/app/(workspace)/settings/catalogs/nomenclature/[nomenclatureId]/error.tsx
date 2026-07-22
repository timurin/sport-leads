"use client";

import { useEffect } from "react";
import Link from "next/link";

import { PageErrorState } from "@/components/ui/page-state";

export default function NomenclatureCardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageErrorState
      title="Не удалось загрузить карточку номенклатуры"
      error={error}
      reset={reset}
      secondaryAction={
        <Link
          href="/settings/catalogs/nomenclature"
          className="inline-flex h-portal-control-default items-center justify-center rounded-portal-md border border-portal-border bg-portal-surface px-portal-4 text-portal-body font-medium text-portal-text hover:bg-portal-state-hover"
        >
          К списку номенклатуры
        </Link>
      }
    />
  );
}
