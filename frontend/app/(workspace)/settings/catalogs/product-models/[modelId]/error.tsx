"use client";

import { useEffect } from "react";

import { PageErrorState } from "@/components/ui/page-state";

export default function ProductModelError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageErrorState
      title="Не удалось открыть карточку модели"
      error={error}
      reset={reset}
    />
  );
}
