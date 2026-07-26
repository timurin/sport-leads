import Link from "next/link";

import { PageNotFoundState } from "@/components/ui/page-state";

export default function ProductionTechCardNotFound() {
  return (
    <PageNotFoundState
      title="Техкарта не найдена"
      description="Проверьте номер техкарты или вернитесь к списку."
      action={
        <Link
          href="/production/tech-cards"
          className="portal-focus-ring inline-flex h-portal-control-default items-center justify-center rounded-portal-md border border-portal-border bg-portal-surface px-portal-4 text-portal-body font-medium text-portal-text hover:bg-portal-state-hover"
        >
          К списку техкарт
        </Link>
      }
    />
  );
}
