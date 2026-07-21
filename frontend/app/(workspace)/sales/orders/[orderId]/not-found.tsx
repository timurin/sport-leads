import Link from "next/link";

import { PageNotFoundState } from "@/components/ui/page-state";

export default function OrderNotFound() {
  return (
    <PageNotFoundState
      title="Заказ не найден"
      description="Проверьте ссылку или вернитесь к списку заказов."
      action={
        <Link
          href="/sales/orders"
          className="text-portal-body font-semibold text-portal-primary hover:underline"
        >
          К списку заказов
        </Link>
      }
    />
  );
}
