import Link from "next/link";

import { PageNotFoundState } from "@/components/ui/page-state";

export default function ProductModelNotFound() {
  return (
    <PageNotFoundState
      title="Модель не найдена"
      description="Карточка модели с указанным идентификатором не существует или была удалена."
      action={
        <div className="flex flex-col items-start gap-portal-2">
          <Link
            href="/settings/catalogs/product-models"
            className="text-portal-body font-semibold text-portal-primary hover:underline"
          >
            ← К списку моделей
          </Link>
          <Link
            href="/settings/catalogs/product-models/demo-reference"
            className="text-portal-caption text-portal-muted hover:text-portal-primary hover:underline"
          >
            Открыть демо-эталон PT-08
          </Link>
        </div>
      }
    />
  );
}
