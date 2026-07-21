import Link from "next/link";

import { PageNotFoundState } from "@/components/ui/page-state";

export default function NomenclatureNotFound() {
  return (
    <PageNotFoundState
      title="Номенклатура не найдена"
      description="Карточка с указанным идентификатором не существует или была удалена."
      action={
        <Link
          href="/settings/catalogs/nomenclature"
          className="text-portal-body font-semibold text-portal-primary hover:underline"
        >
          К списку номенклатуры
        </Link>
      }
    />
  );
}
