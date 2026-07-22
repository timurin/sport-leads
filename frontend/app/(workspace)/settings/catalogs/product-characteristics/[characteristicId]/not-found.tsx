import Link from "next/link";

import { PageNotFoundState } from "@/components/ui/page-state";

export default function CharacteristicNotFound() {
  return (
    <PageNotFoundState
      title="Характеристика не найдена"
      description="Карточка с указанным идентификатором не существует или была удалена."
      action={
        <Link
          href="/settings/catalogs/product-characteristics"
          className="text-portal-body font-semibold text-portal-primary hover:underline"
        >
          К списку характеристик
        </Link>
      }
    />
  );
}
