"use client";

import { useEffect } from "react";

import { PageErrorState } from "@/components/ui/page-state";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <PageErrorState error={error} reset={reset} />;
}
