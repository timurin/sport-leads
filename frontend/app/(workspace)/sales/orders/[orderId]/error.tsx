"use client";

import { useEffect } from "react";

import { PageContent } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";

export default function OrderError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContent size="spacious">
      <section className="rounded-[var(--portal-radius-lg)] border border-red-200 bg-red-50 p-6 text-center">
        <h1 className="text-xl font-bold text-red-900">Не удалось загрузить заказ</h1>
        <p className="mt-2 text-sm text-red-700">{error.message}</p>
        <Button className="mt-4" onClick={reset}>Повторить</Button>
      </section>
    </PageContent>
  );
}
