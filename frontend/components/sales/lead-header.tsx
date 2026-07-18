"use client";

import { Check, ChevronDown, Clipboard, Ellipsis, MessageSquare, UserRound } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { updateLeadResponsible, updateLeadStatus } from "@/app/(workspace)/sales/leads/[leadId]/lead-header-actions";
import { PageActions, PageContent } from "@/components/layout/page-layout";
import { LeadBackButton } from "@/components/sales/lead-back-button";
import { Button } from "@/components/ui/button";
import { salesManagers } from "@/lib/demo-data/sales";
import type { LeadDetails, LeadResponsible } from "@/lib/sales/lead-details";
import { leadFinalActions, type LeadFinalActionId } from "@/lib/sales/lead-final-actions";
import {
  getActiveLeadStages,
  loadLeadStages,
  type LeadStageAccent,
  type LeadStageConfig,
} from "@/lib/sales/lead-stages";

type OpenMenu = "status" | "responsible" | "more" | null;

const statusClasses: Record<LeadStageAccent, string> = {
  "bg-blue-500": "bg-blue-50 text-blue-700 ring-blue-200",
  "bg-cyan-500": "bg-cyan-50 text-cyan-700 ring-cyan-200",
  "bg-violet-500": "bg-violet-50 text-violet-700 ring-violet-200",
  "bg-amber-500": "bg-amber-50 text-amber-800 ring-amber-200",
  "bg-orange-500": "bg-orange-50 text-orange-700 ring-orange-200",
  "bg-emerald-500": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "bg-rose-500": "bg-rose-50 text-rose-700 ring-rose-200",
  "bg-slate-500": "bg-slate-100 text-slate-700 ring-slate-200",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

type LeadHeaderProps = {
  lead: LeadDetails;
  initialStages: LeadStageConfig[];
  lastActivityAtLabel: string;
  onAddTask: (trigger: HTMLElement) => void;
  onWrite: () => void;
  onFinalAction: (action: LeadFinalActionId) => void;
};

export function LeadHeader({
  lead,
  initialStages,
  lastActivityAtLabel,
  onAddTask,
  onWrite,
  onFinalAction,
}: LeadHeaderProps) {
  const [stages, setStages] = useState<LeadStageConfig[]>(() => (
    initialStages.map((stage) => ({ ...stage }))
  ));
  const [statusId, setStatusId] = useState<string>(lead.stageId ?? lead.status);
  const [responsible, setResponsible] = useState<LeadResponsible | null>(lead.responsible);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();
  const headerRef = useRef<HTMLElement>(null);
  const isDemoLead = lead.id.startsWith("lead-");
  const isClosed = ["completed", "won", "unqualified"].includes(statusId);

  useEffect(() => {
    if (!isDemoLead) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setStages(loadLeadStages(window.localStorage));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isDemoLead]);

  useEffect(() => {
    if (!openMenu) {
      return;
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenu]);

  const activeStages = getActiveLeadStages(stages);
  const currentStageIndex = activeStages.findIndex((stage) => stage.id === statusId);
  const currentStage = stages.find((stage) => stage.id === statusId);
  const statusLabel = currentStage?.title ?? lead.statusLabel;
  const badgeClass = currentStage
    ? statusClasses[currentStage.accentClass]
    : statusId === "won"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : statusId === "unqualified"
        ? "bg-red-50 text-red-700 ring-red-200"
        : "bg-slate-100 text-slate-700 ring-slate-200";
  const displayId = lead.id.startsWith("lead-") ? lead.id.slice(5) : lead.id;

  function chooseStatus(stage: LeadStageConfig) {
    setOpenMenu(null);
    setNotice("");

    if (isDemoLead) {
      setStatusId(stage.id);
      setNotice("Статус изменён локально до перезагрузки страницы.");
      return;
    }

    startTransition(async () => {
      const result = await updateLeadStatus(lead.id, stage.id);
      if (result.ok) {
        setStatusId(stage.id);
      }
      setNotice(result.message);
    });
  }

  function chooseResponsible(manager: (typeof salesManagers)[number]) {
    setOpenMenu(null);
    setNotice("");

    if (isDemoLead) {
      setResponsible(manager);
      setNotice("Ответственный изменён локально до перезагрузки страницы.");
      return;
    }
    if (!/^\d+$/.test(manager.id)) {
      setNotice("Ответственный не изменён: текущий список менеджеров demo и не содержит backend id.");
      return;
    }

    startTransition(async () => {
      const result = await updateLeadResponsible(lead.id, manager.id);
      if (result.ok) {
        setResponsible(manager);
      }
      setNotice(result.message);
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice("Ссылка на лид скопирована.");
    } catch {
      setNotice("Не удалось скопировать ссылку. Скопируйте адрес из строки браузера.");
    } finally {
      setOpenMenu(null);
    }
  }

  return (
    <header ref={headerRef} className="border-b border-portal-border bg-portal-surface shadow-[var(--portal-shadow-sm)]">
      <PageContent size="compact" width="full">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start">
          <LeadBackButton />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <h1 className="min-w-0 text-xl font-bold tracking-tight text-portal-text sm:text-[25px]">Лид #{displayId}</h1>
              <span className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${badgeClass}`}>
                <span className="mr-1.5 size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
                <span className="truncate">{statusLabel}</span>
              </span>
            </div>
            <p className="mt-1 break-words text-base font-medium text-portal-text sm:text-[17px]">{lead.customer.organizationName ?? lead.title}</p>
          </div>
          <PageActions className="lg:ml-auto">
            <div className="relative">
            <Button
              type="button"
              aria-haspopup="menu"
              aria-expanded={openMenu === "more"}
              aria-label="Дополнительные действия с лидом"
              onClick={() => setOpenMenu((current) => current === "more" ? null : "more")}
              className="h-9 px-3"
            >
              <Ellipsis size={17} /> Ещё
            </Button>
            {openMenu === "more" ? (
              <div className="absolute right-0 z-30 mt-2 w-60 rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface p-2 text-left shadow-[var(--portal-shadow-overlay)]" role="menu">
                {["Редактировать лид", "Создать заказ", "Закрыть лид", "Удалить лид"].map((label) => (
                  <button key={label} type="button" role="menuitem" disabled className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500 disabled:cursor-not-allowed disabled:opacity-50">
                    {label} <span className="block text-[10px]">Будет доступно позже</span>
                  </button>
                ))}
                <button type="button" role="menuitem" onClick={copyLink} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <Clipboard size={15} /> Копировать ссылку
                </button>
              </div>
            ) : null}
            </div>
          </PageActions>
        </div>

        <div className="mt-2 flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700">{responsible ? initials(responsible.name) : <UserRound size={13} />}</span><span><span className="text-slate-400">Ответственный:</span> <b className="font-medium text-slate-700">{responsible?.name ?? "Не назначен"}</b></span></span>
            <span><span className="text-slate-400">Источник:</span> <b className="font-medium text-slate-700">{lead.source ?? "Не указан"}</b></span>
            <span><span className="text-slate-400">Активность:</span> <b className="font-medium text-slate-700">{lastActivityAtLabel}</b></span>
          </div>

          <PageActions className="xl:shrink-0" align="end">
            <Button type="button" variant="primary" onClick={onWrite} className="h-9 w-full px-3 sm:w-auto">
              <MessageSquare size={16} /> Написать
            </Button>
            <Button type="button" onClick={(event) => onAddTask(event.currentTarget)} className="h-9 w-full px-3 sm:w-auto">
              Добавить задачу
            </Button>
            <div className="relative w-full sm:w-auto">
              <Button
                type="button"
                disabled={isClosed || isPending}
                aria-haspopup="menu"
                aria-expanded={openMenu === "status"}
                onClick={() => setOpenMenu((current) => current === "status" ? null : "status")}
                className="h-9 w-full px-3 sm:w-auto"
              >
                Статус <ChevronDown size={15} />
              </Button>
              {openMenu === "status" ? (
                <div className="absolute left-0 z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface p-2 text-left shadow-[var(--portal-shadow-overlay)] sm:left-auto sm:right-0" role="menu">
                  {activeStages.map((stage) => {
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        role="menuitem"
                        disabled={stage.id === statusId}
                        onClick={() => chooseStatus(stage)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className={`size-2.5 rounded-full ${stage.accentClass}`} />
                        <span className="flex-1">{stage.title}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="relative w-full sm:w-auto">
              <Button
                type="button"
                disabled={isPending}
                aria-haspopup="menu"
                aria-expanded={openMenu === "responsible"}
                onClick={() => setOpenMenu((current) => current === "responsible" ? null : "responsible")}
                className="h-9 w-full px-3 sm:w-auto"
              >
                Ответственный <ChevronDown size={15} />
              </Button>
              {openMenu === "responsible" ? (
                <div className="absolute left-0 z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface p-2 text-left shadow-[var(--portal-shadow-overlay)] sm:left-auto sm:right-0" role="menu">
                  <p className="px-3 pb-2 text-xs leading-5 text-slate-500">
                    {isDemoLead
                      ? "Демо-список · выбор сохраняется локально"
                      : "Demo-список без backend id · API-лид не изменяется локально"}
                  </p>
                  {salesManagers.map((manager) => (
                    <button
                      key={manager.id}
                      type="button"
                      role="menuitem"
                      disabled={manager.id === responsible?.id || (!isDemoLead && !/^\d+$/.test(manager.id))}
                      onClick={() => chooseResponsible(manager)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex size-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold">
                        {manager.initials}
                      </span>
                      {manager.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </PageActions>
        </div>

        {notice ? <p className="mt-2 text-sm text-slate-600" role="status" aria-live="polite">{notice}</p> : null}

        <div className="mt-3 flex min-w-0 overflow-x-auto overflow-y-hidden rounded-[var(--portal-radius-md)] pb-1" aria-label="Этапы лида">
          {activeStages.map((stage, index) => {
            const isCurrent = stage.id === statusId;
            const isDone = currentStageIndex >= 0 && index < currentStageIndex;
            return (
              <button
                key={stage.id}
                type="button"
                disabled={isClosed || isPending || isCurrent}
                onClick={() => chooseStatus(stage)}
                aria-current={isCurrent ? "step" : undefined}
                className={`lead-stage-step relative flex h-9 min-w-32 flex-1 items-center justify-center gap-2 px-4 text-xs font-semibold transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isCurrent ? "bg-portal-primary text-white" : isDone ? "bg-blue-50 text-blue-800" : "bg-portal-surface-secondary text-portal-muted hover:bg-slate-200"} disabled:cursor-default`}
              >
                <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] ${isCurrent ? "bg-white text-blue-700" : "bg-white text-slate-600"}`}>
                  {isDone ? <Check size={12} strokeWidth={3} /> : index + 1}
                </span>
                <span className="whitespace-nowrap">{stage.title}</span>
              </button>
            );
          })}
          {leadFinalActions.map((action, index) => (
            <button
              key={action.id}
              type="button"
              disabled={isClosed || isPending}
              onClick={() => onFinalAction(action.id)}
              className={`lead-stage-step relative flex h-9 min-w-40 flex-1 items-center justify-center gap-2 px-4 text-xs font-semibold transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-default ${action.id === "convert" ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "bg-red-50 text-red-800 hover:bg-red-100"}`}
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] text-slate-600">
                {activeStages.length + index + 1}
              </span>
              <span className="whitespace-nowrap">{action.title}</span>
            </button>
          ))}
        </div>
      </PageContent>
    </header>
  );
}
