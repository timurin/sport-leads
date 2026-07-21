"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, CircleUserRound, GripVertical } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { shouldOpenKanbanCard } from "@/components/kanban/kanban-interaction";
import type { KanbanCardData, KanbanBadgeTone } from "@/components/kanban/kanban-types";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";

const badgeToneMap: Record<KanbanBadgeTone, StatusBadgeTone> = {
  blue: "primary",
  amber: "warning",
  emerald: "success",
  red: "danger",
  slate: "neutral",
  violet: "primary",
};

type KanbanCardProps = {
  card: KanbanCardData;
  onSelect?: (cardId: string) => void;
};

type KanbanCardContentProps = {
  card: KanbanCardData;
  dragging?: boolean;
  dragHandle?: React.ReactNode;
  onSelect?: () => void;
};

export function KanbanCardContent({
  card,
  dragging = false,
  dragHandle,
  onSelect,
}: KanbanCardContentProps) {
  return (
    <article className={[
      "rounded-xl border bg-white p-4 text-slate-900 shadow-sm transition",
      dragging
        ? "rotate-2 border-blue-400 shadow-2xl"
        : "border-slate-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md",
    ].join(" ")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {dragHandle}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-5 text-slate-900">
              {card.href && !dragging ? (
                <Link
                  href={card.href}
                  data-kanban-card-link
                  className="rounded-sm hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {card.title}
                </Link>
              ) : card.title}
            </h3>
            {card.subtitle ? <p className="mt-1 text-xs leading-5 text-slate-500">{card.subtitle}</p> : null}
          </div>
        </div>
        {card.badge ? (
          <StatusBadge
            tone={badgeToneMap[card.badge.tone]}
            size="compact"
            className="shrink-0"
          >
            {card.badge.label}
          </StatusBadge>
        ) : null}
      </div>

      {card.details?.length ? (
        <dl className="mt-3 space-y-1.5 text-xs">
          {card.details.map((detail) => (
            <div key={`${detail.label}-${detail.value}`} className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">{detail.label}</dt>
              <dd className="truncate text-right font-medium text-slate-900">{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {card.amount ? <div className="mt-3 text-base font-semibold text-slate-950">{card.amount}</div> : null}

      {card.responsible || card.nextAction ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
          {card.responsible ? (
            <div className="flex items-center gap-2"><CircleUserRound size={14} />{card.responsible}</div>
          ) : null}
          {card.nextAction ? (
            <div className="flex items-start gap-2"><CalendarDays size={14} className="mt-0.5 shrink-0" /><span>{card.nextAction}</span></div>
          ) : null}
        </div>
      ) : null}
      {card.actionLabel && onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          className="mt-3 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
        >
          {card.actionLabel}
        </button>
      ) : null}
    </article>
  );
}

export function KanbanCard({ card, onSelect }: KanbanCardProps) {
  const router = useRouter();
  const wasDraggingRef = useRef(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, disabled: card.draggable === false });

  useEffect(() => {
    if (isDragging) {
      wasDraggingRef.current = true;
      return;
    }

    if (wasDraggingRef.current) {
      const timeoutId = window.setTimeout(() => {
        wasDraggingRef.current = false;
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [isDragging]);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(event) => {
        const wasDragging = wasDraggingRef.current;
        if (wasDragging) {
          wasDraggingRef.current = false;
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (shouldOpenKanbanCard(event.target, false, card.href)) {
          router.push(card.href!);
        }
      }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      className={card.draggable === false ? undefined : "cursor-grab touch-none active:cursor-grabbing"}
    >
      <KanbanCardContent
        card={card}
        onSelect={onSelect ? () => onSelect(card.id) : undefined}
        dragHandle={card.draggable === false ? undefined : (
          <span
            className="mt-0.5 shrink-0 rounded p-0.5 text-slate-300"
            aria-hidden="true"
          >
            <GripVertical size={17} />
          </span>
        )}
      />
    </div>
  );
}
