"use client";

import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Layers,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  addAssemblyVariantSewingOperations,
  createAssemblyVariant,
} from "@/app/(workspace)/settings/catalogs/product-models/product-model-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatAssemblyCost,
  sumSelectedSewingOperationCosts,
  validateAssemblyVariantDraft,
} from "@/lib/product-models";
import {
  mergeTemplateOperationIds,
  type SewingOperationTemplate,
} from "@/lib/sewing-operation-templates";
import {
  buildSewingCatalogTreeRows,
  filterSewingOperations,
  formatDurationMinutesSeconds,
  formatSewingCost,
  sewingOperationLineTotal,
  visibleSewingCatalogTreeRows,
  type SewingOperation,
  type SewingOperationFolder,
} from "@/lib/sewing-operations";

type AssemblyVariantSewingOpsDrawerProps = {
  open: boolean;
  modelId: number;
  sewingOperations: SewingOperation[];
  folders?: SewingOperationFolder[];
  templates?: SewingOperationTemplate[];
  /** When set, selected ops are appended to an existing variant. */
  variantId?: number | null;
  excludeSewingOperationIds?: number[];
  onClose: () => void;
  onSaved: () => void;
};

/** Right panel: pick sewing operations into an assembly variant (`6.3.6` + template apply `6.3.13`). */
export function AssemblyVariantSewingOpsDrawer({
  open,
  modelId,
  sewingOperations,
  folders = [],
  templates = [],
  variantId = null,
  excludeSewingOperationIds = [],
  onClose,
  onSaved,
}: AssemblyVariantSewingOpsDrawerProps) {
  const isAppend = variantId != null;
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [folderExpanded, setFolderExpanded] = useState<Set<number>>(
    () => new Set(folders.map((folder) => folder.id)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setSearch("");
    setSelectedIds([]);
    setTemplateId("");
    setError("");
    setFolderExpanded(new Set(folders.map((folder) => folder.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on open
  }, [open]);

  const excluded = useMemo(
    () => new Set(excludeSewingOperationIds),
    [excludeSewingOperationIds],
  );

  const availableOps = useMemo(
    () =>
      filterSewingOperations(
        sewingOperations.filter((row) => !excluded.has(row.id)),
        search,
      ),
    [excluded, search, sewingOperations],
  );

  const availableIdSet = useMemo(
    () => new Set(availableOps.map((row) => row.id)),
    [availableOps],
  );

  const catalogTree = useMemo(
    () => buildSewingCatalogTreeRows(folders, availableOps),
    [availableOps, folders],
  );

  const visibleTreeRows = useMemo(() => {
    if (search.trim()) {
      // Search: show matching ops + ancestor folders without collapse.
      return catalogTree.filter((row) => {
        if (row.kind === "operation") return true;
        return availableOps.some(
          (op) =>
            op.folder_id != null &&
            (op.folder_id === row.id ||
              isDescendantFolder(folders, op.folder_id, row.id)),
        );
      });
    }
    return visibleSewingCatalogTreeRows(catalogTree, folderExpanded);
  }, [availableOps, catalogTree, folderExpanded, folders, search]);

  const selectedOps = useMemo(() => {
    const byId = new Map(sewingOperations.map((row) => [row.id, row]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((row): row is SewingOperation => row != null);
  }, [selectedIds, sewingOperations]);

  const total = sumSelectedSewingOperationCosts(selectedOps);
  const totalDuration = selectedOps.reduce((sum, operation) => {
    const duration = Number(operation.duration_seconds) || 0;
    const qty = Math.max(1, Number(operation.quantity_per_item) || 1);
    return sum + duration * qty;
  }, 0);

  const selectedTemplate = useMemo(() => {
    if (!templateId) return null;
    const id = Number(templateId);
    return templates.find((row) => row.id === id) ?? null;
  }, [templateId, templates]);

  function resetAndClose() {
    if (saving) return;
    setName("");
    setSearch("");
    setSelectedIds([]);
    setTemplateId("");
    setError("");
    onClose();
  }

  function toggle(operationId: number) {
    setSelectedIds((current) =>
      current.includes(operationId)
        ? current.filter((id) => id !== operationId)
        : [...current, operationId],
    );
    setError("");
  }

  function toggleFolder(folderId: number) {
    setFolderExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function applyTemplate(mode: "append" | "replace") {
    if (selectedTemplate == null) {
      setError("Выберите шаблон операций пошива");
      return;
    }
    const templateIds = selectedTemplate.lines.map(
      (line) => line.sewing_operation_id,
    );
    if (templateIds.length === 0) {
      setError("В выбранном шаблоне нет операций");
      return;
    }
    if (
      mode === "replace" &&
      selectedIds.length > 0 &&
      !window.confirm("Заменить текущий выбор операций составом шаблона?")
    ) {
      return;
    }
    const next = mergeTemplateOperationIds(selectedIds, templateIds, {
      mode,
      excludedIds: excludeSewingOperationIds,
    });
    if (next.length === 0) {
      setError(
        isAppend
          ? "Все операции шаблона уже есть в варианте или недоступны"
          : "В шаблоне нет доступных операций",
      );
      return;
    }
    setSelectedIds(next);
    if (!isAppend && !name.trim()) {
      setName(selectedTemplate.name);
    }
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAppend) {
      const validationError = validateAssemblyVariantDraft({ name });
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    if (selectedIds.length === 0) {
      setError("Выберите хотя бы одну операцию пошива");
      return;
    }

    setSaving(true);
    setError("");
    const result = isAppend
      ? await addAssemblyVariantSewingOperations(modelId, variantId, selectedIds)
      : await createAssemblyVariant(modelId, name, selectedIds);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setName("");
    setSearch("");
    setSelectedIds([]);
    setTemplateId("");
    onSaved();
    onClose();
  }

  return (
    <CreateDrawer
      open={open}
      title={isAppend ? "Добавить операции пошива" : "Новый вариант сборки"}
      description="Вариант — группа операций пошива. Можно собрать из шаблона или отметить вручную. Итог = стоимость × количество на изделие."
      onClose={resetAndClose}
      variant="overlay"
    >
      <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-portal-5 overflow-y-auto p-portal-6">
          {!isAppend ? (
            <Field label="Название варианта" required>
              <Input
                autoFocus
                required
                maxLength={255}
                value={name}
                disabled={saving}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
                placeholder="Например, С отстрочкой"
              />
            </Field>
          ) : null}

          <div className="rounded-portal-md border border-portal-border bg-portal-surface-2/50 p-portal-4">
            <div className="mb-portal-3 flex items-center gap-portal-2">
              <Layers className="size-4 text-portal-primary" aria-hidden />
              <h3 className="text-portal-body font-semibold text-portal-text">
                Из шаблона
              </h3>
            </div>
            {templates.length === 0 ? (
              <p className="text-portal-caption text-portal-muted">
                Шаблонов пока нет. Создайте заготовку в «Операции пошива» →
                шаблоны.
              </p>
            ) : (
              <div className="space-y-portal-3">
                <Field label="Шаблон операций">
                  <Select
                    value={templateId}
                    disabled={saving}
                    onChange={(event) => {
                      setTemplateId(event.target.value);
                      setError("");
                    }}
                    aria-label="Шаблон операций пошива"
                  >
                    <option value="">Выберите шаблон…</option>
                    {templates.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                        {row.lines.length > 0
                          ? ` (${row.lines.length})`
                          : " (пустой)"}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="flex flex-wrap gap-portal-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="compact"
                    disabled={saving || !templateId}
                    onClick={() => applyTemplate("append")}
                  >
                    Добавить в выбор
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="compact"
                    disabled={saving || !templateId}
                    onClick={() => applyTemplate("replace")}
                  >
                    Заменить выбор
                  </Button>
                </div>
                {selectedTemplate != null && selectedTemplate.lines.length > 0 ? (
                  <p className="text-portal-caption text-portal-muted">
                    Состав:{" "}
                    {selectedTemplate.lines
                      .map(
                        (line) =>
                          line.operation_name ?? `#${line.sewing_operation_id}`,
                      )
                      .join(" → ")}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div>
            <div className="mb-portal-3 flex flex-wrap items-end justify-between gap-portal-2">
              <h3 className="text-portal-body font-semibold text-portal-text">
                Операции пошива
              </h3>
              <p className="text-portal-caption text-portal-muted">
                Выбрано: {selectedIds.length} · Итого: {formatAssemblyCost(total)}{" "}
                ₽ · Время сборки 1 изделия{" "}
                {formatDurationMinutesSeconds(totalDuration)}
              </p>
            </div>
            <Field label="Поиск">
              <Input
                value={search}
                disabled={saving}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Найти операцию"
                aria-label="Поиск операций пошива"
              />
            </Field>

            {availableOps.length === 0 ? (
              <div className="mt-portal-4">
                <EmptyState
                  title={
                    sewingOperations.length === 0
                      ? "Справочник пуст"
                      : "Нет доступных операций"
                  }
                  description={
                    sewingOperations.length === 0
                      ? "Сначала добавьте операции в «Операции пошива»."
                      : "Все операции уже в варианте или не найдены по поиску."
                  }
                  size="compact"
                />
              </div>
            ) : (
              <ul className="mt-portal-4 divide-y divide-portal-border overflow-hidden rounded-portal-md border border-portal-border">
                {visibleTreeRows.map((row) => {
                  if (row.kind === "folder") {
                    const expanded = search.trim()
                      ? true
                      : folderExpanded.has(row.id);
                    return (
                      <li
                        key={`folder-${row.id}`}
                        className="bg-portal-surface-2/40 px-portal-3 py-portal-2"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-1.5 text-left text-portal-caption font-medium text-portal-muted"
                          style={{ paddingLeft: `${row.depth * 0.75}rem` }}
                          onClick={() => toggleFolder(row.id)}
                          disabled={Boolean(search.trim())}
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
                      </li>
                    );
                  }
                  if (!availableIdSet.has(row.id)) return null;
                  const operation = row.operation;
                  const checked = selectedIds.includes(operation.id);
                  return (
                    <li
                      key={`op-${operation.id}`}
                      className="px-portal-3 py-portal-2"
                      style={{ paddingLeft: `${row.depth * 0.75 + 0.75}rem` }}
                    >
                      <Checkbox
                        id={`sewing-op-${operation.id}`}
                        checked={checked}
                        disabled={saving}
                        onChange={() => toggle(operation.id)}
                        label={`${operation.name} — ${formatSewingCost(operation.cost)} ₽ × ${operation.quantity_per_item ?? 1} = ${formatSewingCost(sewingOperationLineTotal(operation.cost, operation.quantity_per_item))} ₽ · ${operation.duration_seconds ?? 0} с`}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {error ? (
            <p className="text-portal-body text-portal-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
          <Button type="button" onClick={resetAndClose} disabled={saving}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving || selectedIds.length === 0}
          >
            {saving
              ? "Сохранение…"
              : isAppend
                ? "Добавить в вариант"
                : "Создать вариант"}
          </Button>
        </footer>
      </form>
    </CreateDrawer>
  );
}

function isDescendantFolder(
  folders: SewingOperationFolder[],
  folderId: number,
  ancestorId: number,
): boolean {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  let current: number | null = folderId;
  const guard = new Set<number>();
  while (current != null && !guard.has(current)) {
    if (current === ancestorId) return true;
    guard.add(current);
    current = byId.get(current)?.parent_id ?? null;
  }
  return false;
}
