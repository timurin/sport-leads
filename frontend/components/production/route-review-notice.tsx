"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import type { routeReviewPresentation } from "@/lib/production/route-review";

export function RouteReviewNotice({ presentation, routeId, disabled, onRefresh }: {
  presentation: NonNullable<ReturnType<typeof routeReviewPresentation>>;
  routeId: number | null;
  disabled: boolean;
  onRefresh: () => void;
}) {
  return (
    <InlineAlert tone="warning" size="compact">
      <strong>{presentation.title}</strong>
      <p>{presentation.message}</p>
      <p>{presentation.actionText}</p>
      {presentation.protectedFact ? (
        <Link href={routeId ? `/settings/catalogs/routings/${routeId}` : "/settings/catalogs/routings"}>{presentation.actionLabel}</Link>
      ) : (
        <Button type="button" size="compact" disabled={disabled || !routeId} onClick={onRefresh}>{presentation.actionLabel}</Button>
      )}
    </InlineAlert>
  );
}
