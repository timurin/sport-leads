"use client";

import { Button } from "@/components/ui/button";
import { LeadPageState } from "@/components/sales/lead-page-state";

export default function LeadError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <LeadPageState
      title="Не удалось загрузить лид"
      description="Произошла ошибка при получении данных. Попробуйте повторить запрос."
      action={(
        <Button type="button" variant="primary" onClick={() => unstable_retry()}>
          Повторить
        </Button>
      )}
    />
  );
}
