"use client";

import { useEffect, useRef, useState } from "react";

import { TechCardMediaCarousel } from "@/components/production/tech-card-media-carousel";
import { OrderCollaborationPanel } from "@/components/sales/order-collaboration-panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  designElapsedSeconds,
  designerSizeTypeLabel,
  formatDesignDuration,
  isDesignReviewSubmitted,
  personalizationSpreadsheetXml,
} from "@/lib/production/tech-card-designer";
import { productionQuantityLabel } from "@/lib/production/tech-card-display";
import type { ShopStageModule } from "@/lib/production/shop-stage-modules";
import {
  stageResultStatusLabel,
  techCardModelLabel,
} from "@/lib/production/tech-cards";
import { sameOriginApiMediaUrl } from "@/lib/api-media";
import type {
  ApiTechnicalCard,
  ApiTechnicalCardMedia,
  ApiTechnicalCardStageResult,
} from "@/lib/sales/order-tech-cards-api";

type TechCardDesignerStageProps = {
  card: ApiTechnicalCard;
  shopStage: ShopStageModule;
  shopStageMatchesCurrent: boolean;
  mediaItems: ApiTechnicalCardMedia[];
  activeStage: ApiTechnicalCardStageResult | null;
  busy: boolean;
  canStart: boolean;
  canSendToPrint: boolean;
  onAccept: () => void;
  onSendForReview: () => void;
  onSendToPrint: (durationSeconds: number) => void;
  onExpandMedia: (src: string) => void;
};

function stageTone(status: string): "neutral" | "warning" | "success" {
  if (status === "completed") return "success";
  if (status === "in_progress") return "warning";
  return "neutral";
}

export function TechCardDesignerStage({
  card,
  shopStage,
  shopStageMatchesCurrent,
  mediaItems,
  activeStage,
  busy,
  canStart,
  canSendToPrint,
  onAccept,
  onSendForReview,
  onSendToPrint,
  onExpandMedia,
}: TechCardDesignerStageProps) {
  const [now, setNow] = useState(() => new Date());
  const status = String(activeStage?.status ?? "pending");
  const inProgress = status === "in_progress";
  const completed = status === "completed";
  const reviewSent = isDesignReviewSubmitted(activeStage?.notes);
  const lines = [...(card.unit_lines ?? [])].sort((a, b) => a.unit_index - b.unit_index);
  const elapsed = designElapsedSeconds(
    activeStage?.started_at,
    activeStage?.completed_at,
    now,
  );
  const storedDuration =
    activeStage?.duration_seconds != null ? Number(activeStage.duration_seconds) : null;
  const shownSeconds = completed && storedDuration != null ? storedDuration : elapsed;
  const cover = sameOriginApiMediaUrl(card.product_model_cover_image_url);
  const hasChat = card.sales_order_id != null || card.order_group_id != null;

  useEffect(() => {
    if (!inProgress || !activeStage?.started_at) return;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [inProgress, activeStage?.started_at]);

  function downloadExcel() {
    const xml = personalizationSpreadsheetXml(lines);
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${card.number}-personalization.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const chat = hasChat ? (
    card.sales_order_id != null ? (
      <OrderCollaborationPanel
        orderId={card.sales_order_id}
        technicalCardId={card.id}
        embedded
        fillHeight
        title="Чат с менеджером"
        reloadToken={card.updated_at}
      />
    ) : (
      <OrderCollaborationPanel
        standaloneCardId={card.id}
        technicalCardId={card.id}
        embedded
        fillHeight
        title="Чат с менеджером"
        reloadToken={card.updated_at}
      />
    )
  ) : (
    <EmptyState
      title="Чат недоступен"
      description="У техкарты нет заказа, к которому можно привязать переписку."
    />
  );

  const splitRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = splitRef.current;
    const main = document.querySelector("[data-app-shell-main]");
    if (!el || !(main instanceof HTMLElement)) return;
    const previousOverflow = main.style.overflow;
    const apply = () => {
      const wide = window.matchMedia("(min-width: 768px)").matches;
      main.style.overflow = wide ? "hidden" : previousOverflow;
      if (!wide) {
        el.style.height = "";
        return;
      }
      const top = el.getBoundingClientRect().top;
      const bottomGap = 16;
      el.style.height = `${Math.max(320, Math.round(window.innerHeight - top - bottomGap))}px`;
    };
    apply();
    const frame = window.requestAnimationFrame(apply);
    window.addEventListener("resize", apply);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", apply);
      el.style.height = "";
      main.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      ref={splitRef}
      className="grid grid-cols-1 items-stretch gap-portal-4 md:grid-cols-2 md:overflow-hidden"
      data-tech-card-designer-stage
      data-tech-card-designer-layout="split"
    >
      <div className="grid min-h-0 min-w-0 content-start gap-portal-4 md:overflow-y-auto md:pr-1">
      <SectionCard title="Работа дизайнера" size="compact">
        {!shopStageMatchesCurrent || !activeStage ? (
          <EmptyState
            title={`Этап «${shopStage.title}» не текущий`}
            description={`Техкарта сейчас на «${card.current_stage_label ?? "не назначен"}». Действия дизайнера недоступны.`}
          />
        ) : (
          <div className="grid gap-portal-3">
            <div className="flex flex-wrap items-center gap-portal-2">
              <StatusBadge size="compact" tone={stageTone(status)}>
                {completed
                  ? "Отправлен в печать"
                  : reviewSent
                    ? "На утверждении"
                    : stageResultStatusLabel(status)}
              </StatusBadge>
              <span className="text-portal-caption text-portal-muted">
                {shownSeconds == null
                  ? "Время начнётся после «Принят в работу»"
                  : `Время: ${formatDesignDuration(shownSeconds)}`}
              </span>
            </div>
            <div className="flex flex-wrap gap-portal-2">
              <Button
                type="button"
                size="compact"
                variant={canStart ? "primary" : "secondary"}
                disabled={busy || !canStart}
                onClick={onAccept}
              >
                Принят в работу
              </Button>
              <Button
                type="button"
                size="compact"
                variant={inProgress && !reviewSent ? "primary" : "secondary"}
                disabled={busy || !inProgress || reviewSent}
                onClick={onSendForReview}
              >
                На утверждении
              </Button>
              <Button
                type="button"
                size="compact"
                variant={canSendToPrint && inProgress ? "primary" : "secondary"}
                disabled={busy || !canSendToPrint || !inProgress}
                onClick={() => onSendToPrint(shownSeconds ?? 0)}
              >
                Отправил в печать
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Макет от клиента"
        description="Загружает менеджер. На этом экране макет только для просмотра."
        size="compact"
      >
        <TechCardMediaCarousel
          items={mediaItems}
          busy={busy}
          readOnly
          size="default"
          onExpand={onExpandMedia}
          onSetPrimary={() => undefined}
          onDelete={() => undefined}
          onReplace={() => undefined}
          onAdd={() => undefined}
        />
      </SectionCard>

      <SectionCard title="Модель изделия" size="compact">
        <div className="flex flex-wrap gap-portal-4">
          {cover ? (
            <img
              src={cover}
              alt={techCardModelLabel(card)}
              className="h-24 w-24 rounded-portal-md border border-portal-border object-cover"
            />
          ) : null}
          <dl className="grid flex-1 gap-portal-3 sm:grid-cols-2">
            <div>
              <dt className="text-portal-caption text-portal-muted">Модель</dt>
              <dd className="mt-1 text-portal-body">{techCardModelLabel(card)}</dd>
            </div>
            <div>
              <dt className="text-portal-caption text-portal-muted">Сборка</dt>
              <dd className="mt-1 text-portal-body">{card.assembly_variant_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-portal-caption text-portal-muted">Тип размера</dt>
              <dd className="mt-1 text-portal-body">
                {designerSizeTypeLabel(card.product_model_size_type)}
              </dd>
            </div>
            <div>
              <dt className="text-portal-caption text-portal-muted">Количество</dt>
              <dd className="mt-1 text-portal-body tabular-nums">
                {productionQuantityLabel(card.quantity)}
              </dd>
            </div>
            <div>
              <dt className="text-portal-caption text-portal-muted">Клиент</dt>
              <dd className="mt-1 text-portal-body">{card.client_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-portal-caption text-portal-muted">Изделие</dt>
              <dd className="mt-1 text-portal-body">{card.nomenclature_name ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </SectionCard>

      <SectionCard
        title="Персонализация"
        description="Только просмотр. Скачивается вся таблица, без обрезки первых строк."
        size="compact"
        actions={
          <Button
            type="button"
            size="compact"
            disabled={lines.length === 0}
            onClick={downloadExcel}
          >
            Скачать Excel
          </Button>
        }
      >
        {lines.length === 0 ? (
          <EmptyState title="Персонализация не заполнена" description="Строки единиц появятся после заполнения менеджером." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-portal-caption">
              <thead className="text-portal-muted">
                <tr>
                  <th className="px-2 py-1 font-medium">№</th>
                  <th className="px-2 py-1 font-medium">Тип размера</th>
                  <th className="px-2 py-1 font-medium">Размер</th>
                  <th className="px-2 py-1 font-medium">Персонализация</th>
                  <th className="px-2 py-1 font-medium">Номер</th>
                  <th className="px-2 py-1 font-medium">Цвет</th>
                  <th className="px-2 py-1 font-medium">Примечание</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-t border-portal-border">
                    <td className="px-2 py-1 tabular-nums">{line.unit_index}</td>
                    <td className="px-2 py-1">{designerSizeTypeLabel(line.size_type)}</td>
                    <td className="px-2 py-1">{line.size?.trim() || "—"}</td>
                    <td className="px-2 py-1">{line.personalization?.trim() || "—"}</td>
                    <td className="px-2 py-1">{line.print_number?.trim() || "—"}</td>
                    <td className="px-2 py-1">{line.color?.trim() || "—"}</td>
                    <td className="px-2 py-1">{line.notes?.trim() || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      </div>
      <aside className="flex min-h-[28rem] min-w-0 flex-col md:h-full md:min-h-0">
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card">
          {chat}
        </div>
      </aside>
    </div>
  );
}
