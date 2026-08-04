"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, FileText, FilePlus2, Printer, Receipt } from "lucide-react";
import { useState, useTransition } from "react";

import {
  createOrderInvoice,
  createOrderQuotation,
  generatePrintForm,
  type PrintFormRender,
  type SalesInvoice,
  type SalesQuotation,
} from "@/app/(workspace)/sales/orders/[orderId]/order-commercial-doc-actions";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import {
  buildSalesInvoicePrintRequest,
  buildSalesOrderPrintRequest,
  buildSalesQuotationPrintRequest,
} from "@/lib/sales/commercial-print";
import {
  buildOrderDocumentTree,
  type OrderDocumentNode,
} from "@/lib/sales/order-documents-tree";
import type { SalesOrderDetails } from "@/lib/sales/order-details";

function DocumentTreeNode({
  node,
  depth,
}: {
  node: OrderDocumentNode;
  depth: number;
}) {
  const hasChildren = Boolean(node.children?.length);
  const [open, setOpen] = useState(true);
  const planned = node.status === "planned";

  return (
    <li className="min-w-0">
      <div
        className="flex min-w-0 items-center gap-1.5 rounded-portal-md px-2 py-1.5 hover:bg-portal-surface-secondary"
        style={{ paddingLeft: `${0.5 + depth * 1.1}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="inline-flex size-5 shrink-0 items-center justify-center rounded text-portal-muted hover:bg-portal-state-hover hover:text-portal-text"
            aria-expanded={open}
            aria-label={open ? `Свернуть «${node.label}»` : `Развернуть «${node.label}»`}
            onClick={() => setOpen((current) => !current)}
          >
            <ChevronRight
              className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`}
              aria-hidden="true"
            />
          </button>
        ) : (
          <span className="inline-flex size-5 shrink-0 items-center justify-center text-portal-muted">
            <FileText className="size-3.5" aria-hidden="true" />
          </span>
        )}
        {node.href && !planned ? (
          <Link
            href={node.href}
            className="min-w-0 truncate text-sm font-medium text-portal-primary hover:underline"
          >
            {node.label}
          </Link>
        ) : (
          <span className="min-w-0 truncate text-sm font-medium text-portal-text">
            {node.label}
          </span>
        )}
        {planned ? (
          <span className="shrink-0 rounded-full bg-portal-surface-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-portal-muted">
            скоро
          </span>
        ) : null}
      </div>
      {hasChildren && open ? (
        <ul className="min-w-0">
          {node.children!.map((child) => (
            <DocumentTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function openGeneratedPrintForm(render: PrintFormRender): string | null {
  if (render.output_format === "html") {
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) {
      return "Браузер заблокировал окно печати. Разрешите popup и повторите.";
    }
    popup.document.open();
    popup.document.write(render.content);
    popup.document.title = render.file_name;
    popup.document.close();
    return null;
  }

  const blob = new Blob([render.content], { type: render.content_type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = render.file_name;
  link.click();
  URL.revokeObjectURL(url);
  return null;
}

export function SalesOrderDocumentsTree({
  order,
  quotations,
  invoices,
}: {
  order: SalesOrderDetails;
  quotations: SalesQuotation[];
  invoices: SalesInvoice[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const tree = buildOrderDocumentTree({
    ...order,
    quotations: quotations.map((doc) => ({
      id: doc.id,
      number: doc.number,
      status: doc.status,
    })),
    invoices: invoices.map((doc) => ({
      id: doc.id,
      number: doc.number,
      status: doc.status,
      quotationId: doc.quotation_id,
    })),
  });

  function runCreate(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  function runPrint(action: () => Promise<{
    ok: boolean;
    message: string;
    render: PrintFormRender | null;
  }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok && result.render) {
        const clientMessage = openGeneratedPrintForm(result.render);
        setMessage(clientMessage ?? result.message);
        return;
      }
      setMessage(result.message);
    });
  }

  const latestQuotationId = quotations[0]?.id ?? null;
  const latestQuotation = quotations[0] ?? null;
  const latestInvoice = invoices[0] ?? null;

  return (
    <SectionCard
      title="Документы"
      description="КП и счета создаются snapshot’ом заказа; печать использует реестр Stage 18.3."
      size="compact"
      className="min-w-0"
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="compact"
            disabled={isPending}
            onClick={() => runCreate(() => createOrderQuotation(order.id))}
          >
            <FilePlus2 className="size-3.5" aria-hidden="true" />
            Создать КП
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            disabled={isPending}
            onClick={() =>
              runCreate(() => createOrderInvoice(order.id, latestQuotationId))
            }
            title={
              latestQuotationId
                ? `Счёт из последнего КП #${latestQuotationId}`
                : "Счёт напрямую из заказа"
            }
          >
            <Receipt className="size-3.5" aria-hidden="true" />
            Создать счёт
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            disabled={isPending}
            title={`Печать заказа ${order.number}`}
            onClick={() =>
              runPrint(() => generatePrintForm(buildSalesOrderPrintRequest(order)))
            }
          >
            <Printer className="size-3.5" aria-hidden="true" />
            Печать заказа
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            disabled={isPending || latestQuotation === null}
            title={
              latestQuotation
                ? `Печать КП ${latestQuotation.number}`
                : "Сначала создайте КП"
            }
            onClick={() =>
              latestQuotation
                ? runPrint(() =>
                    generatePrintForm(
                      buildSalesQuotationPrintRequest(order, latestQuotation),
                    ),
                  )
                : undefined
            }
          >
            <Printer className="size-3.5" aria-hidden="true" />
            Печать КП
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            disabled={isPending || latestInvoice === null}
            title={
              latestInvoice
                ? `Печать счёта ${latestInvoice.number}`
                : "Сначала создайте счёт"
            }
            onClick={() =>
              latestInvoice
                ? runPrint(() =>
                    generatePrintForm(
                      buildSalesInvoicePrintRequest(order, latestInvoice),
                    ),
                  )
                : undefined
            }
          >
            <Printer className="size-3.5" aria-hidden="true" />
            Печать счёта
          </Button>
        </div>
      }
    >
      {message ? (
        <p className="mb-2 text-portal-meta text-portal-muted" role="status">
          {message}
        </p>
      ) : null}
      <ul className="min-w-0 rounded-portal-md border border-portal-border bg-portal-surface py-1">
        {tree.map((node) => (
          <DocumentTreeNode key={node.id} node={node} depth={0} />
        ))}
      </ul>
    </SectionCard>
  );
}
