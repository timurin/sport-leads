"use client";

import { useEffect } from "react";

import { PageErrorState } from "@/components/ui/page-state";

export default function ProductionTechCardsError({
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
      title="Не удалось загрузить техкарты"
      error={error}
      reset={reset}
    />
  );
}
