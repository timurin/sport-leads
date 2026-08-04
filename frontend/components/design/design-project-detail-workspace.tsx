"use client";

import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  createDesignVersionAction,
  createDesignVersionAssetAction,
  createDesignVersionCommentAction,
  deleteDesignVersionAssetAction,
  deleteDesignVersionCommentAction,
  listDesignVersionAssetsAction,
  listDesignVersionCommentsAction,
  setDesignVersionAssetPrimaryAction,
  setDesignVersionCurrentAction,
  updateDesignProjectAction,
} from "@/app/(workspace)/design/projects/design-project-actions";
import { Button, IconButton } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { PageToolbar } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  designAssetContentAbsoluteUrl,
  designAssetKindLabel,
  designProjectStatusLabel,
  designProjectStatusTone,
  designVersionStatusLabel,
  designVersionStatusTone,
  type DesignProjectDetail,
  type DesignVersionAsset,
  type DesignVersionComment,
} from "@/lib/design/design-projects";

const PROJECT_STATUS_OPTIONS = [
  { value: "draft", label: "Черновик" },
  { value: "in_progress", label: "В работе" },
  { value: "ready", label: "Готов" },
  { value: "archived", label: "В архиве" },
];

const ASSET_KIND_OPTIONS = [
  { value: "layout", label: "Макет" },
  { value: "logo", label: "Логотип" },
  { value: "other", label: "Прочее" },
];

function defaultVersionId(project: DesignProjectDetail): number | null {
  const current = project.versions.find((row) => row.status === "current");
  if (current) return current.id;
  return project.versions[0]?.id ?? null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Не удалось прочитать файл"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

/** PT-07-style design project card with versions, assets, comments (ADR-021/022). */
export function DesignProjectDetailWorkspace({
  project,
}: {
  project: DesignProjectDetail;
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versionNotes, setVersionNotes] = useState("");
  const [makeCurrent, setMakeCurrent] = useState(false);
  const [status, setStatus] = useState(project.status);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(
    defaultVersionId(project),
  );
  const [assets, setAssets] = useState<DesignVersionAsset[]>([]);
  const [comments, setComments] = useState<DesignVersionComment[]>([]);
  const [assetKind, setAssetKind] = useState("layout");
  const [assetPrimary, setAssetPrimary] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentAuthor, setCommentAuthor] = useState("");

  const refresh = () => router.refresh();
  const archived = project.status === "archived";

  const selectedVersion = useMemo(
    () => project.versions.find((row) => row.id === selectedVersionId) ?? null,
    [project.versions, selectedVersionId],
  );

  useEffect(() => {
    setSelectedVersionId((current) => {
      if (current != null && project.versions.some((row) => row.id === current)) {
        return current;
      }
      return defaultVersionId(project);
    });
    setStatus(project.status);
  }, [project]);

  useEffect(() => {
    let cancelled = false;
    async function loadSidePanels() {
      if (selectedVersionId == null) {
        setAssets([]);
        setComments([]);
        return;
      }
      const [assetsResult, commentsResult] = await Promise.all([
        listDesignVersionAssetsAction(project.id, selectedVersionId),
        listDesignVersionCommentsAction(project.id, selectedVersionId),
      ]);
      if (cancelled) return;
      if (assetsResult.ok) setAssets(assetsResult.assets);
      else setError(assetsResult.message);
      if (commentsResult.ok) setComments(commentsResult.comments);
      else setError(commentsResult.message);
    }
    void loadSidePanels();
    return () => {
      cancelled = true;
    };
  }, [project.id, selectedVersionId]);

  const onCreateVersion = async () => {
    setBusy(true);
    setError(null);
    const result = await createDesignVersionAction(project.id, {
      notes: versionNotes.trim() || null,
      make_current: makeCurrent,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast(`Версия ${result.version.label} создана`, "success");
    setVersionNotes("");
    setMakeCurrent(false);
    setSelectedVersionId(result.version.id);
    refresh();
  };

  const onSetCurrent = async (versionId: number) => {
    setBusy(true);
    setError(null);
    const result = await setDesignVersionCurrentAction(project.id, versionId);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast(`Текущая версия: ${result.version.label}`, "success");
    setSelectedVersionId(versionId);
    refresh();
  };

  const onSaveStatus = async () => {
    if (status === project.status) return;
    setBusy(true);
    setError(null);
    const result = await updateDesignProjectAction(project.id, { status });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setStatus(project.status);
      return;
    }
    pushToast("Статус проекта обновлён", "success");
    refresh();
  };

  const onUploadAsset = async (fileList: FileList | null) => {
    if (!fileList?.[0] || selectedVersionId == null) return;
    const file = fileList[0];
    setBusy(true);
    setError(null);
    try {
      const content_base64 = await fileToBase64(file);
      const result = await createDesignVersionAssetAction(project.id, selectedVersionId, {
        filename: file.name,
        mime_type: file.type || "application/octet-stream",
        content_base64,
        kind: assetKind,
        is_primary: assetPrimary,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      pushToast(`Файл ${result.asset.filename} загружен`, "success");
      setAssetPrimary(false);
      const listed = await listDesignVersionAssetsAction(project.id, selectedVersionId);
      if (listed.ok) setAssets(listed.assets);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Ошибка чтения файла",
      );
    } finally {
      setBusy(false);
    }
  };

  const onSetPrimary = async (assetId: number) => {
    if (selectedVersionId == null) return;
    setBusy(true);
    setError(null);
    const result = await setDesignVersionAssetPrimaryAction(
      project.id,
      selectedVersionId,
      assetId,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast("Primary обновлён", "success");
    const listed = await listDesignVersionAssetsAction(project.id, selectedVersionId);
    if (listed.ok) setAssets(listed.assets);
  };

  const onDeleteAsset = async (assetId: number) => {
    if (selectedVersionId == null) return;
    if (!window.confirm("Удалить файл?")) return;
    setBusy(true);
    setError(null);
    const result = await deleteDesignVersionAssetAction(
      project.id,
      selectedVersionId,
      assetId,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast("Файл удалён", "success");
    setAssets((current) => current.filter((row) => row.id !== assetId));
  };

  const onAddComment = async () => {
    if (selectedVersionId == null) return;
    setBusy(true);
    setError(null);
    const result = await createDesignVersionCommentAction(project.id, selectedVersionId, {
      body: commentBody,
      author_name: commentAuthor.trim() || null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast("Комментарий добавлен", "success");
    setCommentBody("");
    setComments((current) => [...current, result.comment]);
  };

  const onDeleteComment = async (commentId: number) => {
    if (selectedVersionId == null) return;
    if (!window.confirm("Удалить комментарий?")) return;
    setBusy(true);
    setError(null);
    const result = await deleteDesignVersionCommentAction(
      project.id,
      selectedVersionId,
      commentId,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast("Комментарий удалён", "success");
    setComments((current) => current.filter((row) => row.id !== commentId));
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageToolbar
        start={
          <div className="flex min-w-0 flex-wrap items-center gap-portal-2">
            <Link
              href="/design/projects"
              className="text-portal-caption text-portal-muted hover:text-portal-primary hover:underline"
            >
              ← Дизайн-проекты
            </Link>
            <h1 className="truncate text-portal-title font-semibold text-portal-fg">
              {project.number}
            </h1>
            <StatusBadge size="compact" tone={designProjectStatusTone(project.status)}>
              {designProjectStatusLabel(project.status)}
            </StatusBadge>
          </div>
        }
      />

      <div className="min-h-0 flex-1 space-y-portal-4 overflow-auto p-portal-6">
        {error ? (
          <p className="text-portal-body text-portal-danger" role="alert">
            {error}
          </p>
        ) : null}

        <SectionCard title="Проект">
          <dl className="grid gap-portal-3 sm:grid-cols-2">
            <div>
              <dt className="text-portal-caption text-portal-muted">Заказ покупателя</dt>
              <dd>
                <Link
                  href={`/sales/orders/${project.sales_order_id}`}
                  className="text-portal-primary hover:underline"
                >
                  {project.sales_order_number?.trim() || `#${project.sales_order_id}`}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-portal-caption text-portal-muted">Название</dt>
              <dd>{project.title?.trim() || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-portal-caption text-portal-muted">Примечание</dt>
              <dd>{project.notes?.trim() || "—"}</dd>
            </div>
          </dl>
          <div className="mt-portal-4 flex flex-wrap items-end gap-portal-3">
            <Field label="Статус проекта" className="min-w-[12rem]">
              <Select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                disabled={busy || archived}
                size="compact"
              >
                {PROJECT_STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              type="button"
              variant="secondary"
              size="compact"
              disabled={busy || archived || status === project.status}
              onClick={onSaveStatus}
            >
              Сохранить статус
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Версии"
          actions={
            !archived ? (
              <IconButton
                label="Создать версию"
                variant="primary"
                disabled={busy}
                onClick={onCreateVersion}
              >
                <Plus className="size-4" aria-hidden="true" />
              </IconButton>
            ) : null
          }
        >
          {!archived ? (
            <div className="mb-portal-4 flex flex-wrap items-end gap-portal-3">
              <Field label="Примечание версии" className="min-w-[16rem] flex-1">
                <Input
                  value={versionNotes}
                  onChange={(event) => setVersionNotes(event.target.value)}
                  disabled={busy}
                  size="compact"
                  placeholder="Опционально"
                />
              </Field>
              <label className="flex items-center gap-portal-2 text-portal-body text-portal-fg">
                <input
                  type="checkbox"
                  checked={makeCurrent}
                  onChange={(event) => setMakeCurrent(event.target.checked)}
                  disabled={busy}
                />
                Сразу current
              </label>
            </div>
          ) : (
            <p className="mb-portal-4 text-portal-caption text-portal-muted">
              Проект в архиве — новые версии и смена current недоступны.
            </p>
          )}

          {project.versions.length === 0 ? (
            <EmptyState
              title="Нет версий"
              description="Создайте первую версию макета."
            />
          ) : (
            <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
              <DataTable>
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell>Метка</DataTableHeaderCell>
                    <DataTableHeaderCell>Статус</DataTableHeaderCell>
                    <DataTableHeaderCell>Примечание</DataTableHeaderCell>
                    <DataTableHeaderCell>Действия</DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {project.versions.map((version) => (
                    <DataTableRow key={version.id}>
                      <DataTableCell>
                        <button
                          type="button"
                          className={
                            version.id === selectedVersionId
                              ? "font-semibold text-portal-primary"
                              : "text-portal-primary hover:underline"
                          }
                          onClick={() => setSelectedVersionId(version.id)}
                        >
                          {version.label}
                        </button>
                      </DataTableCell>
                      <DataTableCell>
                        <StatusBadge
                          size="compact"
                          tone={designVersionStatusTone(version.status)}
                        >
                          {designVersionStatusLabel(version.status)}
                        </StatusBadge>
                      </DataTableCell>
                      <DataTableCell>{version.notes?.trim() || "—"}</DataTableCell>
                      <DataTableCell>
                        <div className="flex flex-wrap gap-portal-2">
                          {version.id !== selectedVersionId ? (
                            <Button
                              type="button"
                              size="compact"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => setSelectedVersionId(version.id)}
                            >
                              Открыть
                            </Button>
                          ) : null}
                          {version.status !== "current" && !archived ? (
                            <Button
                              type="button"
                              size="compact"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => onSetCurrent(version.id)}
                            >
                              Сделать current
                            </Button>
                          ) : null}
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTableFrame>
          )}
        </SectionCard>

        <SectionCard
          title={
            selectedVersion
              ? `Активы версии ${selectedVersion.label}`
              : "Активы версии"
          }
        >
          {selectedVersionId == null ? (
            <EmptyState
              title="Выберите версию"
              description="Активы привязаны к DesignVersion (ADR-022)."
            />
          ) : (
            <>
              {!archived ? (
                <div className="mb-portal-4 flex flex-wrap items-end gap-portal-3">
                  <Field label="Тип" className="min-w-[10rem]">
                    <Select
                      value={assetKind}
                      onChange={(event) => setAssetKind(event.target.value)}
                      disabled={busy}
                      size="compact"
                    >
                      {ASSET_KIND_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <label className="flex items-center gap-portal-2 text-portal-body">
                    <input
                      type="checkbox"
                      checked={assetPrimary}
                      onChange={(event) => setAssetPrimary(event.target.checked)}
                      disabled={busy}
                    />
                    Primary
                  </label>
                  <Field label="Файл" className="min-w-[14rem]">
                    <Input
                      type="file"
                      size="compact"
                      disabled={busy}
                      accept=".png,.jpg,.jpeg,.webp,.svg,.pdf,image/*,application/pdf"
                      onChange={(event) => {
                        void onUploadAsset(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </Field>
                </div>
              ) : null}
              {assets.length === 0 ? (
                <EmptyState
                  title="Нет файлов"
                  description="Загрузите макет, логотип или PDF."
                />
              ) : (
                <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
                  <DataTable>
                    <DataTableHead>
                      <tr>
                        <DataTableHeaderCell>Файл</DataTableHeaderCell>
                        <DataTableHeaderCell>Тип</DataTableHeaderCell>
                        <DataTableHeaderCell>Primary</DataTableHeaderCell>
                        <DataTableHeaderCell>Действия</DataTableHeaderCell>
                      </tr>
                    </DataTableHead>
                    <DataTableBody>
                      {assets.map((asset) => (
                        <DataTableRow key={asset.id}>
                          <DataTableCell>
                            <a
                              href={designAssetContentAbsoluteUrl(asset.content_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-portal-primary hover:underline"
                            >
                              {asset.filename}
                            </a>
                          </DataTableCell>
                          <DataTableCell>
                            {designAssetKindLabel(asset.kind)}
                          </DataTableCell>
                          <DataTableCell>
                            {asset.is_primary ? "да" : "—"}
                          </DataTableCell>
                          <DataTableCell>
                            <div className="flex flex-wrap gap-portal-2">
                              {!asset.is_primary && !archived ? (
                                <Button
                                  type="button"
                                  size="compact"
                                  variant="secondary"
                                  disabled={busy}
                                  onClick={() => onSetPrimary(asset.id)}
                                >
                                  Сделать primary
                                </Button>
                              ) : null}
                              {!archived ? (
                                <IconButton
                                  label="Удалить файл"
                                  variant="secondary"
                                  disabled={busy}
                                  onClick={() => onDeleteAsset(asset.id)}
                                >
                                  <Trash2 className="size-4" aria-hidden="true" />
                                </IconButton>
                              ) : null}
                            </div>
                          </DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                </DataTableFrame>
              )}
            </>
          )}
        </SectionCard>

        <SectionCard
          title={
            selectedVersion
              ? `Комментарии ${selectedVersion.label}`
              : "Комментарии версии"
          }
        >
          {selectedVersionId == null ? (
            <EmptyState
              title="Выберите версию"
              description="Комментарии дизайн-модуля — не чат Stage 19."
            />
          ) : (
            <>
              {!archived ? (
                <div className="mb-portal-4 flex flex-wrap items-end gap-portal-3">
                  <Field label="Автор" className="min-w-[10rem]">
                    <Input
                      value={commentAuthor}
                      onChange={(event) => setCommentAuthor(event.target.value)}
                      disabled={busy}
                      size="compact"
                      placeholder="Опционально"
                    />
                  </Field>
                  <Field label="Комментарий" className="min-w-[16rem] flex-1">
                    <Input
                      value={commentBody}
                      onChange={(event) => setCommentBody(event.target.value)}
                      disabled={busy}
                      size="compact"
                      placeholder="Заметка по макету"
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="primary"
                    size="compact"
                    disabled={busy || !commentBody.trim()}
                    onClick={onAddComment}
                  >
                    Добавить
                  </Button>
                </div>
              ) : null}
              {comments.length === 0 ? (
                <EmptyState
                  title="Нет комментариев"
                  description="Добавьте заметку по выбранной версии."
                />
              ) : (
                <ul className="space-y-portal-3">
                  {comments.map((comment) => (
                    <li
                      key={comment.id}
                      className="flex items-start justify-between gap-portal-3 border-b border-portal-border pb-portal-3"
                    >
                      <div>
                        <p className="text-portal-body text-portal-fg">{comment.body}</p>
                        <p className="text-portal-caption text-portal-muted">
                          {comment.author_name?.trim() || "Без автора"}
                        </p>
                      </div>
                      {!archived ? (
                        <IconButton
                          label="Удалить комментарий"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => onDeleteComment(comment.id)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </IconButton>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
