"use client";

import { useEffect } from "react";

import { PageErrorState } from "@/components/ui/page-state";

export default function WorkCentersError({
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
      title="Не удалось загрузить оборудование"
      error={error}
      reset={reset}
    />
  );
}
