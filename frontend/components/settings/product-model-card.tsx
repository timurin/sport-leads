"use client";

import Link from "next/link";
import { ArrowLeftRight, History, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { VersionedWorkspace } from "@/components/entity/versioned-workspace";
import { ProductModelVersionBar } from "@/components/settings/product-model-version-bar";
import { Button } from "@/components/ui/button";
import { CompactTabs } from "@/components/ui/compact-tabs";
import { EntityHeader } from "@/components/ui/entity-header";
import { SectionCard } from "@/components/ui/section-card";
import type { ProductModelReference } from "@/lib/demo-data/product-model-reference";

const workspaceTabs = [
  { id: "structure", label: "Состав модели" },
  { id: "links", label: "Связи" },
] as const;

/** PT-08 reference versioned workspace (`DS-PT-08`, demo data). */
export function ProductModelCard({ model }: { model: ProductModelReference }) {
  const initialActive =
    model.versions.find((version) => version.isActive)?.id ?? model.versions[0]?.id ?? "";
  const [activeVersionId, setActiveVersionId] = useState(initialActive);
  const [workspaceTab, setWorkspaceTab] = useState<string>("structure");
  const [compareOpen, setCompareOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const activeVersion = useMemo(
    () => model.versions.find((version) => version.id === activeVersionId),
    [activeVersionId, model.versions],
  );

  const publishedBaseline = model.versions.find((version) => version.isPublishedBaseline);

  function restoreFromVersion() {
    if (
      !window.confirm(
        "Создать новый черновик на основе выбранной версии? Действие будет выполняться через API в этапе 6.1.",
      )
    ) {
      return;
    }
    setNotice("Восстановление версии будет подключено к API продукта (roadmap 6.1).");
  }

  return (
    <>
      <VersionedWorkspace
        header={
          <>
            <div className="rounded-portal-md border border-dashed border-portal-warning bg-portal-warning-soft px-portal-3 py-portal-2 text-portal-body text-portal-text">
              <strong className="font-semibold">Демо PT-08.</strong> Карточка модели
              продукции без backend; эталон шаблона Versioned Workspace до этапа 6.1.
            </div>
            <div className="mt-portal-4 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 shadow-portal-card sm:p-portal-5">
              <EntityHeader
                eyebrow={
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-1.5 font-medium text-portal-primary hover:underline"
                  >
                    ← Настройки
                  </Link>
                }
                title={model.name}
                description={`Код ${model.code}`}
                meta={
                  <>
                    <span>Номенклатура: {model.nomenclatureLabel}</span>
                    <span>ID: {model.id}</span>
                  </>
                }
              />
            </div>
          </>
        }
        versionBar={
          <ProductModelVersionBar
            versions={model.versions}
            activeVersionId={activeVersionId}
            onSelect={setActiveVersionId}
          />
        }
        toolbar={
          <div className="flex min-w-0 flex-wrap items-center gap-portal-2">
            <Button
              type="button"
              variant="ghost"
              size="compact"
              onClick={() => setCompareOpen(true)}
            >
              <ArrowLeftRight size={16} aria-hidden="true" />
              Сравнить с…
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="compact"
              onClick={restoreFromVersion}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Восстановить в черновик
            </Button>
            <Button type="button" variant="primary" size="compact" disabled>
              Опубликовать
            </Button>
          </div>
        }
      >
        {notice ? (
          <p className="text-portal-body text-portal-muted" role="status">
            {notice}
          </p>
        ) : null}

        <SectionCard title="Рабочая область версии" size="compact">
          <p className="mb-portal-3 text-portal-body text-portal-muted">
            Просмотр:{" "}
            <strong className="text-portal-text">
              {activeVersion?.label ?? "—"}
            </strong>
            {publishedBaseline && activeVersion?.id !== publishedBaseline.id ? (
              <>
                {" "}
                · опубликованная база: {publishedBaseline.label}
              </>
            ) : null}
          </p>
          <CompactTabs
            items={[...workspaceTabs]}
            value={workspaceTab}
            onChange={setWorkspaceTab}
            label="Разделы модели"
            size="compact"
          />
          <div className="mt-portal-4 text-portal-body text-portal-muted">
            {workspaceTab === "structure" ? (
              <p>
                Здесь будет редактор состава модели (размерные сетки, лекала,
                спецификации) после этапа 6.1. Сейчас — каркас PT-08.
              </p>
            ) : (
              <p>
                Связь с номенклатурой и заказами — read-only ссылки без дублирования
                каталога (roadmap 6.1.11–6.1.12).
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="История версий"
          description="Публикации и черновики модели"
          size="compact"
        >
          <ul className="divide-y divide-portal-border">
            {model.versions.map((version) => (
              <li
                key={version.id}
                className="flex min-w-0 flex-col gap-1 py-portal-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-portal-text">{version.label}</p>
                  <p className="text-portal-caption text-portal-muted">
                    <History
                      size={14}
                      className="mr-1 inline opacity-70"
                      aria-hidden="true"
                    />
                    {version.author} ·{" "}
                    {new Date(version.updatedAt).toLocaleString("ru-RU")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="compact"
                  className="shrink-0"
                  onClick={() => setActiveVersionId(version.id)}
                >
                  Открыть
                </Button>
              </li>
            ))}
          </ul>
        </SectionCard>
      </VersionedWorkspace>

      {compareOpen ? (
        <div
          className="fixed inset-0 z-portal-modal-1 flex items-center justify-center p-portal-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="compare-versions-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Закрыть сравнение"
            onClick={() => setCompareOpen(false)}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-portal-lg border border-portal-border bg-portal-surface p-portal-5 shadow-portal-overlay">
            <h2
              id="compare-versions-title"
              className="text-portal-section font-semibold text-portal-text"
            >
              Сравнение версий
            </h2>
            <p className="mt-1 text-portal-body text-portal-muted">
              Демо-оболочка PT-08. Полный diff — после API 6.1.
            </p>
            <p className="mt-portal-3 text-portal-body text-portal-muted">
              Слева — активная версия ({activeVersion?.label ?? "—"}), справа —
              опубликованная база ({publishedBaseline?.label ?? "—"}).
            </p>
            <div className="mt-portal-4 grid gap-portal-2 sm:grid-cols-2">
              <div className="rounded-portal-md border border-portal-border p-portal-3">
                <p className="text-portal-caption font-semibold text-portal-muted">
                  Активная
                </p>
                <ul className="mt-2 space-y-1 text-portal-text">
                  <li>Состав: 12 позиций</li>
                  <li>Размерная сетка: Юниор</li>
                  <li>Примечание: черновик коллекции 2026</li>
                </ul>
              </div>
              <div className="rounded-portal-md border border-portal-border p-portal-3">
                <p className="text-portal-caption font-semibold text-portal-muted">
                  Базовая
                </p>
                <ul className="mt-2 space-y-1 text-portal-text">
                  <li>Состав: 11 позиций</li>
                  <li>Размерная сетка: Юниор</li>
                  <li>Примечание: —</li>
                </ul>
              </div>
            </div>
            <div className="mt-portal-5 flex justify-end">
              <Button type="button" variant="ghost" onClick={() => setCompareOpen(false)}>
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
