"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  createSewingOperationTemplate,
  deleteSewingOperationTemplate,
  updateSewingOperationTemplate,
} from "@/app/(workspace)/settings/catalogs/sewing_operation_templates/sewing-operation-template-actions";
import { Button, IconButton } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Input } from "@/components/ui/form-controls";
import {
  filterSewingOperationTemplates,
  moveIdInList,
  type SewingOperationTemplate,
} from "@/lib/sewing-operation-templates";
import {
  buildSewingCatalogTreeRows,
  visibleSewingCatalogTreeRows,
  type SewingOperation,
  type SewingOperationFolder,
} from "@/lib/sewing-operations";

type EditorMode = "idle" | "create" | "edit";

/** Templates library as fullscreen modal on sewing-operations catalog (`6.3.12`). */
export function SewingOperationTemplatesModal({
  open,
  onClose,
  templates,
  operations,
  folders,
}: {
  open: boolean;
  onClose: () => void;
  templates: SewingOperationTemplate[];
  operations: SewingOperation[];
  folders: SewingOperationFolder[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(templates);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<EditorMode>("idle");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [lineIds, setLineIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerExpanded, setPickerExpanded] = useState<Set<number>>(
    () => new Set(folders.map((folder) => folder.id)),
  );

  useEffect(() => {
    if (!open) return;
    setRows(templates);
    setPickerExpanded(new Set(folders.map((folder) => folder.id)));
    setMode("idle");
    setEditingId(null);
    setSelectedId(null);
    setNameDraft("");
    setLineIds([]);
    setError(null);
    setQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open-only sync
  }, [open]);

  const filtered = useMemo(
    () => filterSewingOperationTemplates(rows, query),
    [query, rows],
  );

  const opsById = useMemo(() => {
    const map = new Map<number, SewingOperation>();
    for (const op of operations) map.set(op.id, op);
    return map;
  }, [operations]);

  const catalogTree = useMemo(
    () => buildSewingCatalogTreeRows(folders, operations),
    [folders, operations],
  );

  const visiblePickerRows = useMemo(
    () => visibleSewingCatalogTreeRows(catalogTree, pickerExpanded),
    [catalogTree, pickerExpanded],
  );

  const selectedTemplate =
    selectedId == null
      ? null
      : (rows.find((row) => row.id === selectedId) ?? null);

  const isEditing = mode === "create" || mode === "edit";

  const handleClose = () => {
    onClose();
  };

  const startCreate = () => {
    setMode("create");
    setEditingId(null);
    setSelectedId(null);
    setNameDraft("");
    setLineIds([]);
    setError(null);
  };

  const startEdit = (row: SewingOperationTemplate) => {
    setMode("edit");
    setEditingId(row.id);
    setSelectedId(row.id);
    setNameDraft(row.name);
    setLineIds(row.lines.map((line) => line.sewing_operation_id));
    setError(null);
  };

  const cancelEditor = () => {
    setMode("idle");
    setEditingId(null);
    setNameDraft("");
    setLineIds([]);
    setError(null);
  };

  const selectTemplate = (row: SewingOperationTemplate) => {
    if (isEditing) return;
    setSelectedId(row.id);
    setError(null);
  };

  const saveEditor = async () => {
    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        const result = await createSewingOperationTemplate({
          name: nameDraft,
          sewing_operation_ids: lineIds,
        });
        if (!result.ok) {
          setError(result.message);
          setSaving(false);
          return;
        }
        setRows((prev) => [result.template, ...prev]);
        setSelectedId(result.template.id);
        cancelEditor();
        router.refresh();
      } else if (mode === "edit" && editingId != null) {
        const result = await updateSewingOperationTemplate(editingId, {
          name: nameDraft,
          sewing_operation_ids: lineIds,
        });
        if (!result.ok) {
          setError(result.message);
          setSaving(false);
          return;
        }
        setRows((prev) =>
          prev.map((row) =>
            row.id === result.template.id ? result.template : row,
          ),
        );
        setSelectedId(result.template.id);
        cancelEditor();
        router.refresh();
      }
    } catch {
      setError(
        mode === "create"
          ? "Не удалось создать шаблон."
          : "Не удалось сохранить шаблон.",
      );
    }
    setSaving(false);
  };

  const onDelete = async (row: SewingOperationTemplate) => {
    if (!window.confirm(`Удалить шаблон «${row.name}»?`)) return;
    setSaving(true);
    setError(null);
    try {
      const result = await deleteSewingOperationTemplate(row.id);
      if (!result.ok) {
        setError(result.message);
        setSaving(false);
        return;
      }
      setRows((prev) => prev.filter((item) => item.id !== row.id));
      if (selectedId === row.id) setSelectedId(null);
      if (editingId === row.id) cancelEditor();
      router.refresh();
    } catch {
      setError("Не удалось удалить шаблон.");
    }
    setSaving(false);
  };

  const toggleOp = (opId: number) => {
    setLineIds((ids) =>
      ids.includes(opId) ? ids.filter((id) => id !== opId) : [...ids, opId],
    );
  };

  const removeLine = (opId: number) => {
    setLineIds((ids) => ids.filter((id) => id !== opId));
  };

  const togglePickerFolder = (folderId: number) => {
    setPickerExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  return (
    <CreateDrawer
      open={open}
      onClose={handleClose}
      title="Шаблоны операций пошива"
      description="Соберите заготовку из операций каталога — потом примените её к варианту сборки"
      variant="fullscreen"
    >
      <div className="flex h-full min-h-0 flex-col lg:flex-row">
        {/* Left: template list */}
        <aside className="flex w-full min-h-0 flex-col border-b border-portal-border lg:w-[22rem] lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="flex shrink-0 flex-col gap-portal-3 border-b border-portal-border p-portal-4">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти шаблон…"
              aria-label="Поиск шаблонов операций пошива"
            />
            <Button
              type="button"
              variant="primary"
              size="compact"
              disabled={saving || isEditing}
              onClick={startCreate}
              className="w-full gap-portal-2"
            >
              <Plus className="size-4" aria-hidden />
              Новый шаблон
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-portal-3">
            {filtered.length === 0 ? (
              <EmptyState
                title={query.trim() ? "Ничего не найдено" : "Пока нет шаблонов"}
                description={
                  query.trim()
                    ? "Измените поисковый запрос."
                    : "Создайте первую заготовку — набор операций для типовых изделий."
                }
              />
            ) : (
              <ul className="space-y-portal-2">
                {filtered.map((row) => {
                  const active =
                    selectedId === row.id ||
                    (mode === "edit" && editingId === row.id);
                  return (
                    <li key={row.id}>
                      <div
                        className={[
                          "rounded-portal-md border px-portal-3 py-portal-3 transition-colors",
                          active
                            ? "border-portal-primary bg-portal-primary-soft"
                            : "border-portal-border bg-portal-surface hover:bg-portal-surface-2",
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          disabled={isEditing && editingId !== row.id}
                          onClick={() => selectTemplate(row)}
                        >
                          <div className="truncate text-portal-body font-medium text-portal-text">
                            {row.name}
                          </div>
                          <div className="mt-1 text-portal-caption text-portal-muted">
                            {row.lines.length === 0
                              ? "Без операций"
                              : `${row.lines.length} ${opsWord(row.lines.length)}`}
                          </div>
                          {row.lines.length > 0 ? (
                            <p className="mt-2 line-clamp-2 text-portal-caption text-portal-muted">
                              {row.lines
                                .map(
                                  (line) =>
                                    line.operation_name ??
                                    `#${line.sewing_operation_id}`,
                                )
                                .join(" → ")}
                            </p>
                          ) : null}
                        </button>
                        {!isEditing ? (
                          <div className="mt-2 flex justify-end gap-1 border-t border-portal-line pt-2">
                            <IconButton
                              type="button"
                              label="Изменить"
                              disabled={saving}
                              onClick={() => startEdit(row)}
                            >
                              <Pencil className="size-3.5" />
                            </IconButton>
                            <IconButton
                              type="button"
                              label="Удалить"
                              disabled={saving}
                              onClick={() => void onDelete(row)}
                            >
                              <Trash2 className="size-3.5" />
                            </IconButton>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="shrink-0 border-t border-portal-border px-portal-4 py-portal-3 text-portal-caption text-portal-muted">
            Шаблонов: {filtered.length}
            {filtered.length !== rows.length ? ` из ${rows.length}` : ""}
          </div>
        </aside>

        {/* Right: preview or editor */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-portal-surface-2/40">
          {error ? (
            <div className="shrink-0 border-b border-portal-line bg-portal-surface px-portal-5 py-portal-3 text-portal-caption text-red-700">
              {error}
            </div>
          ) : null}

          {isEditing ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto p-portal-5">
                <div className="mx-auto flex max-w-3xl flex-col gap-portal-5">
                  <div>
                    <h3 className="text-portal-page font-semibold text-portal-text">
                      {mode === "create"
                        ? "Новый шаблон"
                        : "Редактирование шаблона"}
                    </h3>
                    <p className="mt-1 text-portal-body text-portal-muted">
                      Отметьте операции в дереве каталога, затем расставьте
                      порядок в списке справа.
                    </p>
                  </div>

                  <Field label="Наименование" htmlFor="template-name" required>
                    <Input
                      id="template-name"
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      placeholder="Например: Футболка базовая"
                      aria-label="Название шаблона"
                      autoFocus
                    />
                  </Field>

                  <div className="grid gap-portal-4 md:grid-cols-2">
                    <div className="flex min-h-0 flex-col rounded-portal-md border border-portal-border bg-portal-surface">
                      <div className="border-b border-portal-border px-portal-4 py-portal-3">
                        <div className="text-portal-body font-medium text-portal-text">
                          Каталог операций
                        </div>
                        <p className="mt-0.5 text-portal-caption text-portal-muted">
                          Папки как в справочнике. Выбирайте только операции.
                        </p>
                      </div>
                      <div className="max-h-[min(28rem,50vh)] min-h-[14rem] space-y-0.5 overflow-y-auto p-portal-3">
                        {operations.length === 0 && folders.length === 0 ? (
                          <p className="px-1 py-2 text-portal-caption text-portal-muted">
                            В каталоге пока нет операций.
                          </p>
                        ) : (
                          visiblePickerRows.map((row) => {
                            if (row.kind === "folder") {
                              const expanded = pickerExpanded.has(row.id);
                              return (
                                <button
                                  key={`folder-${row.id}`}
                                  type="button"
                                  className="flex w-full items-center gap-1.5 rounded-portal-sm px-1.5 py-1.5 text-left text-portal-caption font-medium text-portal-muted hover:bg-portal-surface-2"
                                  style={{
                                    paddingLeft: `${row.depth * 0.85 + 0.35}rem`,
                                  }}
                                  onClick={() => togglePickerFolder(row.id)}
                                >
                                  {expanded ? (
                                    <ChevronDown className="size-3.5 shrink-0" />
                                  ) : (
                                    <ChevronRight className="size-3.5 shrink-0" />
                                  )}
                                  {expanded ? (
                                    <FolderOpen className="size-3.5 shrink-0 text-portal-primary" />
                                  ) : (
                                    <Folder className="size-3.5 shrink-0 text-portal-primary" />
                                  )}
                                  <span className="truncate">{row.name}</span>
                                </button>
                              );
                            }
                            return (
                              <div
                                key={`op-${row.id}`}
                                className="rounded-portal-sm px-1 py-0.5 hover:bg-portal-surface-2"
                                style={{
                                  paddingLeft: `${row.depth * 0.85 + 1.35}rem`,
                                }}
                              >
                                <Checkbox
                                  label={row.name}
                                  checked={lineIds.includes(row.id)}
                                  disabled={saving}
                                  onChange={() => toggleOp(row.id)}
                                />
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="flex min-h-0 flex-col rounded-portal-md border border-portal-border bg-portal-surface">
                      <div className="border-b border-portal-border px-portal-4 py-portal-3">
                        <div className="text-portal-body font-medium text-portal-text">
                          Порядок в шаблоне
                        </div>
                        <p className="mt-0.5 text-portal-caption text-portal-muted">
                          {lineIds.length === 0
                            ? "Пока пусто — отметьте операции слева."
                            : `${lineIds.length} ${opsWord(lineIds.length)} · стрелки меняют порядок`}
                        </p>
                      </div>
                      <div className="max-h-[min(28rem,50vh)] min-h-[14rem] overflow-y-auto p-portal-3">
                        {lineIds.length === 0 ? (
                          <div className="flex h-full min-h-[10rem] items-center justify-center rounded-portal-sm border border-dashed border-portal-border px-portal-4 text-center text-portal-caption text-portal-muted">
                            Выбранные операции появятся здесь по порядку
                            применения.
                          </div>
                        ) : (
                          <ol className="space-y-portal-2">
                            {lineIds.map((id, index) => {
                              const op = opsById.get(id);
                              return (
                                <li
                                  key={id}
                                  className="flex items-center gap-portal-2 rounded-portal-md border border-portal-border bg-portal-surface-2/60 px-portal-3 py-portal-2"
                                >
                                  <span className="flex size-7 shrink-0 items-center justify-center rounded-portal-sm bg-portal-primary-soft text-portal-caption font-semibold text-portal-primary">
                                    {index + 1}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-portal-body text-portal-text">
                                    {op?.name ?? `#${id}`}
                                  </span>
                                  <span className="flex shrink-0 gap-0.5">
                                    <IconButton
                                      type="button"
                                      label="Выше"
                                      disabled={saving || index === 0}
                                      onClick={() =>
                                        setLineIds((ids) =>
                                          moveIdInList(ids, id, "up"),
                                        )
                                      }
                                    >
                                      <ArrowUp className="size-3.5" />
                                    </IconButton>
                                    <IconButton
                                      type="button"
                                      label="Ниже"
                                      disabled={
                                        saving || index === lineIds.length - 1
                                      }
                                      onClick={() =>
                                        setLineIds((ids) =>
                                          moveIdInList(ids, id, "down"),
                                        )
                                      }
                                    >
                                      <ArrowDown className="size-3.5" />
                                    </IconButton>
                                    <IconButton
                                      type="button"
                                      label="Убрать"
                                      disabled={saving}
                                      onClick={() => removeLine(id)}
                                    >
                                      <X className="size-3.5" />
                                    </IconButton>
                                  </span>
                                </li>
                              );
                            })}
                          </ol>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <footer className="flex shrink-0 flex-wrap items-center justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-5 py-portal-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  disabled={saving}
                  onClick={cancelEditor}
                >
                  Отмена
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="compact"
                  disabled={saving}
                  onClick={() => void saveEditor()}
                >
                  {mode === "create" ? "Создать шаблон" : "Сохранить"}
                </Button>
              </footer>
            </div>
          ) : selectedTemplate ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-portal-5">
              <div className="mx-auto max-w-2xl">
                <div className="flex flex-wrap items-start justify-between gap-portal-3">
                  <div>
                    <h3 className="text-portal-page font-semibold text-portal-text">
                      {selectedTemplate.name}
                    </h3>
                    <p className="mt-1 text-portal-body text-portal-muted">
                      {selectedTemplate.lines.length === 0
                        ? "В шаблоне пока нет операций"
                        : `${selectedTemplate.lines.length} ${opsWord(selectedTemplate.lines.length)} в порядке применения`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="compact"
                    disabled={saving}
                    onClick={() => startEdit(selectedTemplate)}
                    className="gap-portal-2"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    Изменить
                  </Button>
                </div>

                {selectedTemplate.lines.length === 0 ? (
                  <div className="mt-portal-5 rounded-portal-md border border-dashed border-portal-border bg-portal-surface px-portal-5 py-portal-8 text-center text-portal-body text-portal-muted">
                    Добавьте операции через «Изменить».
                  </div>
                ) : (
                  <ol className="mt-portal-5 space-y-portal-2">
                    {selectedTemplate.lines.map((line, index) => (
                      <li
                        key={line.id}
                        className="flex items-center gap-portal-3 rounded-portal-md border border-portal-border bg-portal-surface px-portal-4 py-portal-3"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-portal-sm bg-portal-primary-soft text-portal-caption font-semibold text-portal-primary">
                          {index + 1}
                        </span>
                        <span className="text-portal-body text-portal-text">
                          {line.operation_name ?? `#${line.sewing_operation_id}`}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center p-portal-6">
              <EmptyState
                title="Выберите шаблон"
                description="Слева откройте готовую заготовку или создайте новую кнопкой «Новый шаблон»."
              />
            </div>
          )}
        </section>
      </div>
    </CreateDrawer>
  );
}

function opsWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "операция";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "операции";
  }
  return "операций";
}
