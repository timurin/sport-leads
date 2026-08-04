import Link from "next/link";

import { PageNotFoundState } from "@/components/ui/page-state";

export default function ClientNotFound() {
  return (
    <PageNotFoundState
      title="Клиент не найден"
      description="Проверьте ссылку или вернитесь к списку клиентов."
      action={
        <Link
          href="/sales/clients"
          className="text-portal-body font-semibold text-portal-primary hover:underline"
        >
          К списку клиентов
        </Link>
      }
    />
  );
}
