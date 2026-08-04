"use client";

import Link from "next/link";
import {
  Archive,
  CheckCircle2,
  Eye,
  FilePlus2,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  activatePrintForm,
  archivePrintForm,
  createPrintFormVersion,
  previewPrintForm,
  publishPrintFormVersion,
  updatePrintForm,
} from "@/app/(workspace)/settings/print-forms/print-form-actions";
import { SimpleEntityCard } from "@/components/entity/simple-entity-card";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { EntityHeader } from "@/components/ui/entity-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  emptyPrintFormVersionDraft,
  getCurrentVersion,
  printFormBindingTypeOptions,
  printFormOutputFormatOptions,
  printFormStatusLabels,
  printFormVersionStatusLabels,
  printFormToDraft,
  validatePrintFormDraft,
  validatePrintFormVersionDraft,
  type PrintForm,
  type PrintFormBindingType,
  type PrintFormDraft,
  type PrintFormOutputFormat,
  type PrintFormPreview,
  type PrintFormVersionDraft,
} from "@/lib/print-forms";

function statusTone(status: string): "neutral" | "success" | "warning" {
  if (status === "active") return "success";
  if (status === "draft") return "warning";
  return "neutral";
}

export function PrintFormCard({
  printForm,
  canWrite,
}: {
  printForm: PrintForm;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [draft, setDraft] = useState<PrintFormDraft>(() => printFormToDraft(printForm));
  const [versionDraft, setVersionDraft] = useState<PrintFormVersionDraft>(
    emptyPrintFormVersionDraft,
  );
  const [previewPayload, setPreviewPayload] = useState(
    JSON.stringify(
      {
        document_number: "SO-2026-001",
        customer: { name: "ООО Спорт" },
        totals: { amount: 150000 },
      },
      null,
      2,
    ),
  );
  const [preview, setPreview] = useState<PrintFormPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => {
    const baseline = printFormToDraft(printForm);
    return (
      baseline.title !== draft.title.trim() ||
      baseline.description !== draft.description.trim() ||
      baseline.binding_type !== draft.binding_type ||
      baseline.binding_key !== draft.binding_key.trim() ||
      baseline.output_format !== draft.output_format
    );
  }, [draft, printForm]);

  const currentVersion = getCurrentVersion(printForm);
  const statusHint = canWrite
    ? "Карточка доступна для редактирования и публикации"
    : "Режим просмотра. Для записи нужно право print_forms.write";

  const parsePreviewPayload = (): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(previewPayload) as Record<string, unknown>;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  };

  const save = async () => {
    if (!canWrite) return;
    setError(null);
    const validation = validatePrintFormDraft(draft);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    const result = await updatePrintForm(printForm.id, draft);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast("Печатная форма сохранена", "success");
    router.refresh();
  };

  const createVersion = async () => {
    if (!canWrite) return;
    setError(null);
    const validation = validatePrintFormVersionDraft(versionDraft);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    const result = await createPrintFormVersion(printForm.id, versionDraft);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setVersionDraft(emptyPrintFormVersionDraft());
    pushToast(`Версия v${result.version.version_no} создана`, "success");
    router.refresh();
  };

  const publishVersion = async (versionId: number) => {
    if (!canWrite) return;
    setError(null);
    setPublishingId(versionId);
    const result = await publishPrintFormVersion(printForm.id, versionId);
    setPublishingId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast(`Версия v${result.version.version_no} опубликована`, "success");
    router.refresh();
  };

  const activate = async () => {
    if (!canWrite) return;
    setError(null);
    setSaving(true);
    const result = await activatePrintForm(printForm.id);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast("Печатная форма активирована", "success");
    router.refresh();
  };

  const archive = async () => {
    if (!canWrite) return;
    setError(null);
    setSaving(true);
    const result = await archivePrintForm(printForm.id);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast("Печатная форма отправлена в архив", "success");
    router.refresh();
  };

  const previewTemplate = async (versionId: number | null) => {
    setError(null);
    const payload = parsePreviewPayload();
    if (!payload) {
      setError("Превью payload должен быть валидным JSON");
      return;
    }
    setPreviewing(true);
    const result = await previewPrintForm(printForm.id, versionId, payload);
    setPreviewing(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPreview(result.preview);
    pushToast("Превью обновлено", "success");
  };

  return (
    <SimpleEntityCard
      header={
        <EntityHeader
          eyebrow={
            <Link
              href="/settings/print-forms"
              className="text-portal-primary hover:underline"
            >
              Печатные формы
            </Link>
          }
          title={printForm.title}
          description="Карточка шаблона печати под Administration registry Stage 18.3"
          meta={
            <>
              <span>Код: {printForm.code}</span>
              <span>Привязка: {printForm.binding_type} / {printForm.binding_key}</span>
              <span>Формат: {printForm.output_format.toUpperCase()}</span>
            </>
          }
          status={
            <StatusBadge size="compact" tone={statusTone(printForm.status)}>
              {printFormStatusLabels[printForm.status] ?? printForm.status}
            </StatusBadge>
          }
          actions={
            <div className="flex flex-wrap items-center gap-portal-2">
              <Link
                href="/settings/print-forms"
                className="portal-focus-ring inline-flex h-portal-control-default items-center justify-center gap-portal-2 rounded-portal-md border border-portal-border bg-portal-surface px-portal-4 text-portal-body font-medium text-portal-text hover:bg-portal-state-hover"
              >
                ← К списку
              </Link>
              <IconButton
                type="button"
                label="????????"
                title="????????"
                variant="secondary"
                disabled={!canWrite || saving || !dirty}
                onClick={() => {
                  setDraft(printFormToDraft(printForm));
                  setError(null);
                }}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton
                type="button"
                label="?????????"
                title="?????????"
                variant="primary"
                disabled={!canWrite || saving || !dirty}
                onClick={() => void save()}
              >
                <Save className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton
                type="button"
                label="????????????"
                title="?????."
                variant="secondary"
                disabled={!canWrite || saving || printForm.status === "active"}
                onClick={() => void activate()}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton
                type="button"
                label="????????????"
                title="?????"
                variant="secondary"
                disabled={!canWrite || saving || printForm.status === "archived"}
                onClick={() => void archive()}
              >
                <Archive className="size-4" aria-hidden="true" />
              </IconButton>
            </div>
          }
        />
      }
    >
      <SectionCard title="Статус доступа" size="compact">
        <p className="text-portal-body text-portal-muted">{statusHint}</p>
      </SectionCard>

      <SectionCard title="Реквизиты" size="compact">
        {error ? (
          <p className="mb-portal-3 text-portal-body text-portal-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="grid gap-portal-4 md:grid-cols-2">
          <Field label="Код" htmlFor="print-form-code">
            <Input id="print-form-code" value={printForm.code} disabled />
          </Field>
          <Field label="Название" htmlFor="print-form-title">
            <Input
              id="print-form-title"
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
              disabled={!canWrite || saving}
            />
          </Field>
          <Field label="Тип привязки" htmlFor="print-form-binding-type">
            <select
              id="print-form-binding-type"
              value={draft.binding_type}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  binding_type: event.target.value as PrintFormBindingType,
                }))
              }
              disabled={!canWrite || saving}
              className="h-portal-control-default w-full rounded-portal-md border border-portal-border bg-portal-surface px-portal-3 text-portal-body text-portal-text outline-none"
            >
              {printFormBindingTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ключ привязки" htmlFor="print-form-binding-key">
            <Input
              id="print-form-binding-key"
              value={draft.binding_key}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  binding_key: event.target.value,
                }))
              }
              disabled={!canWrite || saving}
            />
          </Field>
          <Field label="Формат" htmlFor="print-form-output-format">
            <select
              id="print-form-output-format"
              value={draft.output_format}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  output_format: event.target.value as PrintFormOutputFormat,
                }))
              }
              disabled={!canWrite || saving}
              className="h-portal-control-default w-full rounded-portal-md border border-portal-border bg-portal-surface px-portal-3 text-portal-body text-portal-text outline-none"
            >
              {printFormOutputFormatOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Описание" htmlFor="print-form-description">
              <Textarea
                id="print-form-description"
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={3}
                disabled={!canWrite || saving}
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Текущая версия"
        description="Активация доступна только при наличии current published версии."
        size="compact"
      >
        {currentVersion ? (
          <div className="grid gap-portal-3 md:grid-cols-3">
            <div className="rounded-portal-md border border-portal-border bg-portal-surface-secondary p-portal-3">
              <div className="text-portal-caption text-portal-muted">Версия</div>
              <div className="mt-1 font-semibold text-portal-text">
                v{currentVersion.version_no}
              </div>
            </div>
            <div className="rounded-portal-md border border-portal-border bg-portal-surface-secondary p-portal-3">
              <div className="text-portal-caption text-portal-muted">Метка</div>
              <div className="mt-1 font-semibold text-portal-text">
                {currentVersion.template_label}
              </div>
            </div>
            <div className="rounded-portal-md border border-portal-border bg-portal-surface-secondary p-portal-3">
              <div className="text-portal-caption text-portal-muted">Статус</div>
              <div className="mt-1">
                <StatusBadge
                  size="compact"
                  tone={currentVersion.status === "published" ? "success" : "warning"}
                >
                  {printFormVersionStatusLabels[currentVersion.status] ??
                    currentVersion.status}
                </StatusBadge>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-portal-body text-portal-muted">
            Current version ещё не назначена.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Версии шаблона"
        description="Новая версия создаётся как draft, затем публикуется и становится current."
        size="compact"
      >
        <div className="space-y-portal-4">
          {canWrite ? (
            <div className="grid gap-portal-4 xl:grid-cols-[240px_180px_1fr_auto]">
              <Field label="Метка версии" htmlFor="print-form-version-label">
                <Input
                  id="print-form-version-label"
                  value={versionDraft.template_label}
                  onChange={(event) =>
                    setVersionDraft((current) => ({
                      ...current,
                      template_label: event.target.value,
                    }))
                  }
                  disabled={saving}
                />
              </Field>
              <Field label="Тип хранения" htmlFor="print-form-version-storage">
                <select
                  id="print-form-version-storage"
                  value={versionDraft.storage_kind}
                  onChange={(event) =>
                    setVersionDraft((current) => ({
                      ...current,
                      storage_kind: event.target.value as "inline_text" | "file_ref",
                    }))
                  }
                  disabled={saving}
                  className="h-portal-control-default w-full rounded-portal-md border border-portal-border bg-portal-surface px-portal-3 text-portal-body text-portal-text outline-none"
                >
                  <option value="inline_text">inline_text</option>
                  <option value="file_ref">file_ref</option>
                </select>
              </Field>
              <Field label="Источник шаблона" htmlFor="print-form-version-source">
                <Textarea
                  id="print-form-version-source"
                  value={versionDraft.template_source}
                  onChange={(event) =>
                    setVersionDraft((current) => ({
                      ...current,
                      template_source: event.target.value,
                    }))
                  }
                  rows={4}
                  disabled={saving}
                />
              </Field>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="primary"
                  disabled={saving}
                  onClick={() => void createVersion()}
                >
                  <FilePlus2 className="size-4" aria-hidden="true" />
                  Добавить версию
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-portal-3">
            {printForm.versions.length === 0 ? (
              <p className="text-portal-body text-portal-muted">
                Версии ещё не созданы.
              </p>
            ) : (
              printForm.versions
                .slice()
                .sort((a, b) => b.version_no - a.version_no)
                .map((version) => (
                  <div
                    key={version.id}
                    className="rounded-portal-md border border-portal-border bg-portal-surface-secondary p-portal-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-portal-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-portal-2">
                          <strong className="text-portal-text">
                            v{version.version_no} · {version.template_label}
                          </strong>
                          {version.is_current ? (
                            <StatusBadge size="compact" tone="primary">
                              Current
                            </StatusBadge>
                          ) : null}
                          <StatusBadge
                            size="compact"
                            tone={version.status === "published" ? "success" : "warning"}
                          >
                            {printFormVersionStatusLabels[version.status] ?? version.status}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-portal-caption text-portal-muted">
                          {version.storage_kind} · {version.updated_at.slice(0, 10)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-portal-2">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={previewing}
                          onClick={() => void previewTemplate(version.id)}
                        >
                          <Eye className="size-4" aria-hidden="true" />
                          Превью
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={
                            !canWrite ||
                            publishingId === version.id ||
                            version.status === "published"
                          }
                          onClick={() => void publishVersion(version.id)}
                        >
                          <Sparkles className="size-4" aria-hidden="true" />
                          {publishingId === version.id
                            ? "Публикация…"
                            : "Publish current"}
                        </Button>
                      </div>
                    </div>
                    <pre className="mt-portal-3 overflow-x-auto rounded-portal-md bg-[#0f172a] p-portal-3 text-xs leading-5 text-slate-100">
                      {version.template_source}
                    </pre>
                  </div>
                ))
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Превью"
        description="Payload передаётся в registry preview и подставляется в inline template placeholders."
        size="compact"
      >
        <div className="grid gap-portal-4 xl:grid-cols-[360px_1fr]">
          <Field label="Preview payload (JSON)" htmlFor="print-form-preview-payload">
            <Textarea
              id="print-form-preview-payload"
              value={previewPayload}
              onChange={(event) => setPreviewPayload(event.target.value)}
              rows={14}
              disabled={previewing}
            />
          </Field>
          <div className="space-y-portal-3">
            <div className="flex flex-wrap items-center gap-portal-2">
              <Button
                type="button"
                variant="secondary"
                disabled={previewing}
                onClick={() => void previewTemplate(currentVersion?.id ?? null)}
              >
                <Eye className="size-4" aria-hidden="true" />
                {previewing ? "Рендер…" : "Обновить превью"}
              </Button>
            </div>
            <div className="rounded-portal-md border border-portal-border bg-portal-surface-secondary p-portal-3">
              {preview ? (
                <div className="space-y-portal-3">
                  <div className="text-portal-caption text-portal-muted">
                    {preview.file_name} · {preview.content_type}
                  </div>
                  <div className="overflow-x-auto rounded-portal-md border border-portal-border bg-white p-portal-4">
                    {preview.output_format === "html" ? (
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: preview.content }}
                      />
                    ) : (
                      <pre className="text-xs leading-5 text-portal-text">
                        {preview.content}
                      </pre>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-portal-body text-portal-muted">
                  Сначала выполните рендер превью для текущей или выбранной версии.
                </p>
              )}
            </div>
          </div>
        </div>
      </SectionCard>
    </SimpleEntityCard>
  );
}
