import { notFound } from "next/navigation";

import { WarehouseMovementDocumentCard } from "@/components/warehouse/warehouse-movement-document-card";
import { PageLayout } from "@/components/layout/page-layout";
import { getNomenclature } from "@/lib/nomenclature";
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

  const [warehouses, nomenclatureRows] = await Promise.all([
    getWarehouses({ limit: 500 }),
    getNomenclature(),
  ]);
  const warehouseNames: Record<number, string> = {};
  for (const warehouse of warehouses) {
    warehouseNames[warehouse.id] = warehouse.name;
  }
  const warehouseName =
    warehouseNames[document.warehouse_id] ?? `Склад #${document.warehouse_id}`;

  const nomenclatureNames: Record<number, string> = {};
  for (const line of document.ledger_lines) {
    const name = line.nomenclature_name?.trim();
    nomenclatureNames[line.nomenclature_id] = name || `#${line.nomenclature_id}`;
  }
  for (const line of document.inventory_lines ?? []) {
    const name = line.nomenclature_name?.trim();
    if (name) nomenclatureNames[line.nomenclature_id] = name;
  }
  for (const line of document.transfer_lines ?? []) {
    const name = line.nomenclature_name?.trim();
    if (name) nomenclatureNames[line.nomenclature_id] = name;
  }

  const nomenclatures = nomenclatureRows
    .filter((row) => row.is_active && row.nomenclature_type !== "SERVICE")
    .map((row) => ({ id: row.id, name: row.name }));

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <WarehouseMovementDocumentCard
        document={document}
        warehouseName={warehouseName}
        warehouseNames={warehouseNames}
        nomenclatureNames={nomenclatureNames}
        nomenclatures={nomenclatures}
      />
    </PageLayout>
  );
}
