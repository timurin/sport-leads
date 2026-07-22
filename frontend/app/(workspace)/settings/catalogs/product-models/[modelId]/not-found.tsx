import Link from "next/link";

import { PageNotFoundState } from "@/components/ui/page-state";

export default function ProductModelNotFound() {
  return (
    <PageNotFoundState
      title="Модель не найдена"
      description="Карточка модели с указанным идентификатором не существует. Для эталона PT-08 откройте demo-reference."
      action={
        <Link
          href="/settings/catalogs/product-models/demo-reference"
          className="text-portal-body font-semibold text-portal-primary hover:underline"
        >
          Открыть демо-эталон PT-08
        </Link>
      }
    />
  );
}
