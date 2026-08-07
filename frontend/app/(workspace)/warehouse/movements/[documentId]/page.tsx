import { notFound } from "next/navigation";

import { WarehouseMovementDocumentCard } from "@/components/warehouse/warehouse-movement-document-card";
import { PageLayout } from "@/components/layout/page-layout";
import { getStockDocument } from "@/lib/stock-documents";
import { getWarehouses } from "@/lib/warehouses";

export default async function WarehouseMovementDocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId: rawId } = await params;
  const documentId = Number(rawId);
  if (!Number.isSafeInteger(documentId) || documentId <= 0) {
    notFound();
  }

  const document = await getStockDocument(documentId);
  if (!document) {
    notFound();
  }

  const warehouses = await getWarehouses({ limit: 500 });
  const warehouseName =
    warehouses.find((row) => row.id === document.warehouse_id)?.name ??
    `Склад #${document.warehouse_id}`;

  const nomenclatureNames: Record<number, string> = {};
  for (const line of document.ledger_lines) {
    const name = line.nomenclature_name?.trim();
    nomenclatureNames[line.nomenclature_id] = name || `#${line.nomenclature_id}`;
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <WarehouseMovementDocumentCard
        document={document}
        warehouseName={warehouseName}
        nomenclatureNames={nomenclatureNames}
      />
    </PageLayout>
  );
}
