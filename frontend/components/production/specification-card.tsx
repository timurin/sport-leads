"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  approveSpecificationAction,
  cancelSpecificationDraftAction,
  createSpecificationNextDraftAction,
  refreshSpecificationAction,
} from "@/app/(workspace)/production/specifications/specification-actions";
import { DocumentCard } from "@/components/entity/document-card";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { EntityHeader } from "@/components/ui/entity-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  formatSpecificationDuration,
  formatSpecificationQty,
  specificationOperationSourceLabel,
  specificationStatusLabel,
  specificationStatusTone,
  type SpecificationDetail,
} from "@/lib/production/specifications";

type Props = {
  specification: SpecificationDetail;
};

/** PT-07 document card (`DS-PT-07`) for a specification plan+fact report. */
export function SpecificationCard({ specification }: Props) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const current = specification.current_version;
  const status = current?.status ?? specification.current_version_status;
  const isDraft = status === "draft";
  const isApproved = status === "approved";

  const runAction = (
    action: (id: number) => Promise<
      | { ok: true; specification: SpecificationDetail }
      | { ok: false; message: string }
    >,
    success: string,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await action(specification.id);
      if (!result.ok) {
        setError(result.message);
        pushToast(result.message, "danger");
        return;
      }
      pushToast(success, "success");
      router.refresh();
    });
  };

  return (
    <DocumentCard
      header={
        <EntityHeader
          size="compact"
          eyebrow="Спецификация"
          title={specification.number}
          description="Документ-отчёт план+факт по партии. Поля не редактируются вручную — обновление из техкарт."
          status={
            <StatusBadge size="compact" tone={specificationStatusTone(status)}>
              {specificationStatusLabel(status)}
              {current?.version_no != null ? ` · v${current.version_no}` : ""}
            </StatusBadge>
          }
          meta={
            <>
              <Link
                href={`/production/orders/${specification.production_order_id}`}
                className="text-portal-primary hover:underline"
              >
                Партия{" "}
                {specification.production_batch_number?.trim() ||
                  `#${specification.production_batch_id}`}
              </Link>
              {specification.sales_order_id != null ? (
                <Link
                  href={`/sales/orders/${specification.sales_order_id}`}
                  className="text-portal-primary hover:underline"
                >
                  Заказ{" "}
                  {specification.sales_order_number?.trim() ||
                    `#${specification.sales_order_id}`}
                </Link>
              ) : (
                <span data-standalone-specification-order>
                  Группа{" "}
                  {specification.sales_order_number?.trim() || "Standalone"}
                </span>
              )}
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-portal-2">
              {isDraft ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      runAction(refreshSpecificationAction, "Черновик обновлён")
                    }
                  >
                    Обновить из ТК
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={pending}
                    onClick={() =>
                      runAction(approveSpecificationAction, "Спецификация утверждена")
                    }
                  >
                    Утвердить
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      runAction(cancelSpecificationDraftAction, "Черновик снят")
                    }
                  >
                    Снять черновик
                  </Button>
                </>
              ) : null}
              {isApproved || status === "cancelled" || status === "superseded" ? (
                <Button
                  type="button"
                  variant="primary"
                  disabled={pending}
                  onClick={() =>
                    runAction(
                      createSpecificationNextDraftAction,
                      "Создан новый черновик",
                    )
                  }
                >
                  Новый черновик
                </Button>
              ) : null}
            </div>
          }
        />
      }
    >
      {error ? (
        <p className="text-portal-body text-portal-danger" role="alert">
          {error}
        </p>
      ) : null}

      <SectionCard title="Изделия" size="compact">
        {!current || current.product_lines.length === 0 ? (
          <p className="text-portal-caption text-portal-muted">Нет строк изделий.</p>
        ) : (
          <DataTableFrame>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Техкарта</DataTableHeaderCell>
                  <DataTableHeaderCell>Номенклатура</DataTableHeaderCell>
                  <DataTableHeaderCell>Модель</DataTableHeaderCell>
                  <DataTableHeaderCell>Сборка</DataTableHeaderCell>
                  <DataTableHeaderCell>Кол-во</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {current.product_lines.map((line) => (
                  <DataTableRow key={line.id}>
                    <DataTableCell>
                      <Link
                        href={`/production/tech-cards/${line.technical_card_id}`}
                        className="text-portal-primary hover:underline"
                      >
                        ТК #{line.technical_card_id}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>
                      {line.nomenclature_name?.trim() || "—"}
                    </DataTableCell>
                    <DataTableCell>
                      {line.product_model_name?.trim() || "—"}
                    </DataTableCell>
                    <DataTableCell>
                      {line.assembly_variant_name?.trim() || "—"}
                    </DataTableCell>
                    <DataTableCell>
                      {formatSpecificationQty(line.quantity)}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )}
      </SectionCard>

      <SectionCard
        title="Материалы"
        description="План и факт из состава техкарт (только line_kind=material)"
        size="compact"
      >
        {!current || current.material_lines.length === 0 ? (
          <p className="text-portal-caption text-portal-muted">Нет материалов.</p>
        ) : (
          <DataTableFrame>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Материал</DataTableHeaderCell>
                  <DataTableHeaderCell>Ед.</DataTableHeaderCell>
                  <DataTableHeaderCell>План</DataTableHeaderCell>
                  <DataTableHeaderCell>Факт</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {current.material_lines.map((line) => (
                  <DataTableRow key={line.id}>
                    <DataTableCell>{line.snapshot_name}</DataTableCell>
                    <DataTableCell>{line.unit?.trim() || "—"}</DataTableCell>
                    <DataTableCell>
                      {formatSpecificationQty(line.planned_qty)}
                    </DataTableCell>
                    <DataTableCell>
                      {formatSpecificationQty(line.fact_qty)}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )}
      </SectionCard>

      <SectionCard
        title="Операции"
        description="Маршрут: факт при завершённом цехе. Пошив: факт из журнала Stage 24."
        size="compact"
      >
        {!current || current.operation_lines.length === 0 ? (
          <p className="text-portal-caption text-portal-muted">Нет операций.</p>
        ) : (
          <DataTableFrame>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Операция</DataTableHeaderCell>
                  <DataTableHeaderCell>Источник</DataTableHeaderCell>
                  <DataTableHeaderCell>Цех</DataTableHeaderCell>
                  <DataTableHeaderCell>План</DataTableHeaderCell>
                  <DataTableHeaderCell>Факт</DataTableHeaderCell>
                  <DataTableHeaderCell>Время</DataTableHeaderCell>
                  <DataTableHeaderCell>Исполнитель</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {current.operation_lines.map((line) => (
                  <DataTableRow key={line.id}>
                    <DataTableCell>{line.operation_name}</DataTableCell>
                    <DataTableCell>
                      {specificationOperationSourceLabel(line.source_kind)}
                    </DataTableCell>
                    <DataTableCell>{line.stage_label?.trim() || "—"}</DataTableCell>
                    <DataTableCell>
                      {formatSpecificationQty(line.planned_volume)}
                    </DataTableCell>
                    <DataTableCell>
                      {formatSpecificationQty(line.fact_volume)}
                    </DataTableCell>
                    <DataTableCell>
                      {formatSpecificationDuration(line.duration_seconds)}
                    </DataTableCell>
                    <DataTableCell>{line.performer_name?.trim() || "—"}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )}
      </SectionCard>

      <SectionCard title="Версии" size="compact">
        {specification.versions.length === 0 ? (
          <p className="text-portal-caption text-portal-muted">Версий нет.</p>
        ) : (
          <ul className="space-y-portal-2">
            {specification.versions.map((version) => (
              <li
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-portal-2 rounded-portal-md border border-portal-border px-portal-3 py-portal-2"
              >
                <span className="text-portal-body">v{version.version_no}</span>
                <StatusBadge
                  size="compact"
                  tone={specificationStatusTone(version.status)}
                >
                  {specificationStatusLabel(version.status)}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </DocumentCard>
  );
}
