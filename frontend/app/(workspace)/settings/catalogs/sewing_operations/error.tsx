"use client";

import { useEffect } from "react";

import { PageErrorState } from "@/components/ui/page-state";

function displayMessage(error: Error): string {
  if (error.message === "fetch failed") {
    return "Не удалось связаться с API. Проверьте, что backend запущен на :8000, и нажмите «Повторить».";
  }
  return error.message;
}

export default function SewingOperationsError({
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
      title="Не удалось загрузить операции пошива"
      error={{ ...error, message: displayMessage(error) }}
      reset={reset}
    />
  );
}
