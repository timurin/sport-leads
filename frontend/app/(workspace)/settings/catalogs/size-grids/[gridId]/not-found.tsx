import Link from "next/link";

import { PageNotFoundState } from "@/components/ui/page-state";

export default function SizeGridNotFoundPage() {
  return (
    <PageNotFoundState
      title="Размерная сетка не найдена"
      description="Проверьте адрес или вернитесь к списку размерных сеток."
      action={
        <Link
          href="/settings/catalogs/size-grids"
          className="portal-focus-ring inline-flex h-portal-control-default items-center justify-center rounded-portal-md border border-portal-border bg-portal-surface px-portal-4 text-portal-body font-medium text-portal-text hover:bg-portal-state-hover"
        >
          К списку сеток
        </Link>
      }
    />
  );
}
