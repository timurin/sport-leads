"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import {
  createSizeGridRow,
  deleteSizeGrid,
  deleteSizeGridRow,
  updateSizeGrid,
  updateSizeGridRow,
} from "@/app/(workspace)/settings/catalogs/size-grids/size-grid-actions";
import { SimpleEntityCard } from "@/components/entity/simple-entity-card";
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
import { Field, Input } from "@/components/ui/form-controls";
import { EntityHeader } from "@/components/ui/entity-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  auditEventsSummary,
  formatAuditAction,
  formatAuditActor,
  type AuditEvent,
} from "@/lib/audit-events-mapping";
import {
  SIZE_GRID_SIZE_TYPE_LABELS,
  emptySizeGridRowDraft,
  formatHeightLabel,
  sizeGridRowToDraft,
  type SizeGrid,
  type SizeGridDraft,
  type SizeGridRowDraft,
} from "@/lib/size-grids";

const sizeTypeTone = {
  men: "primary",
  women: "success",
  kids: "neutral",
} as const;

function RowEditorFields({
  draft,
  onChange,
  disabled,
}: {
  draft: SizeGridRowDraft;
  onChange: (next: SizeGridRowDraft) => void;
  disabled?: boolean;
}) {
  const set =
    (field: keyof SizeGridRowDraft) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...draft, [field]: event.target.value });
    };

  return (
    <div className="grid gap-portal-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Порядок">
        <Input
          value={draft.sort_order}
          onChange={set("sort_order")}
          disabled={disabled}
          inputMode="numeric"
        />
      </Field>
      <Field label="RU" required>
        <Input value={draft.ru_size} onChange={set("ru_size")} disabled={disabled} />
      </Field>
      <Field label="INT" required>
        <Input
          value={draft.int_label}
          onChange={set("int_label")}
          disabled={disabled}
        />
      </Field>
      <Field label="Грудь" required>
        <Input value={draft.chest} onChange={set("chest")} disabled={disabled} />
      </Field>
      <Field label="Талия" required>
        <Input value={draft.waist} onChange={set("waist")} disabled={disabled} />
      </Field>
      <Field label="Бёдра" required>
        <Input value={draft.hip} onChange={set("hip")} disabled={disabled} />
      </Field>
      <Field label="Рост S">
        <Input
          value={draft.height_s}
          onChange={set("height_s")}
          disabled={disabled}
        />
      </Field>
      <Field label="Рост N">
        <Input
          value={draft.height_n}
          onChange={set("height_n")}
          disabled={disabled}
        />
      </Field>
      <Field label="Рост T">
        <Input
          value={draft.height_t}
          onChange={set("height_t")}
          disabled={disabled}
        />
      </Field>
    </div>
  );
}

/** PT-05 size-grid card (`DS-PT-05`) — Mosmade-style measurement table. */
export function SizeGridCard({
  grid: initialGrid,
  canWrite = false,
  canReadAudit = false,
  auditEvents: initialAuditEvents = [],
}: {
  grid: SizeGrid;
  canWrite?: boolean;
  canReadAudit?: boolean;
  auditEvents?: AuditEvent[];
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [grid, setGrid] = useState(initialGrid);
  const [auditEvents, setAuditEvents] = useState(initialAuditEvents);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [headerEditing, setHeaderEditing] = useState(false);
  const [headerDraft, setHeaderDraft] = useState<SizeGridDraft>({
    name: initialGrid.name,
    size_type: initialGrid.size_type,
    source_note: initialGrid.source_note ?? "",
  });
  const [rowEditingId, setRowEditingId] = useState<number | "new" | null>(null);
  const [rowDraft, setRowDraft] = useState<SizeGridRowDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGrid(initialGrid);
  }, [initialGrid]);

  useEffect(() => {
    setAuditEvents(initialAuditEvents);
  }, [initialAuditEvents]);

  const rows = useMemo(
    () => [...grid.rows].sort((a, b) => a.sort_order - b.sort_order),
    [grid.rows],
  );

  const refreshAfterMutation = () => {
    if (canReadAudit) {
      router.refresh();
    }
  };

  const startHeaderEdit = () => {
    setHeaderDraft({
      name: grid.name,
      size_type: grid.size_type,
      source_note: grid.source_note ?? "",
    });
    setHeaderEditing(true);
    setError(null);
  };

  const saveHeader = async () => {
    setSaving(true);
    setError(null);
    const result = await updateSizeGrid(grid.id, headerDraft);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setGrid(result.grid);
    setHeaderEditing(false);
    pushToast("Реквизиты сохранены", "success");
    refreshAfterMutation();
  };

  const startAddRow = () => {
    const nextOrder =
      rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.sort_order)) + 1;
    setRowEditingId("new");
    setRowDraft(emptySizeGridRowDraft(nextOrder));
    setError(null);
  };

  const startEditRow = (rowId: number) => {
    const row = grid.rows.find((item) => item.id === rowId);
    if (!row) return;
    setRowEditingId(rowId);
    setRowDraft(sizeGridRowToDraft(row));
    setError(null);
  };

  const cancelRowEdit = () => {
    setRowEditingId(null);
    setRowDraft(null);
    setError(null);
  };

  const saveRow = async () => {
    if (rowDraft == null || rowEditingId == null) return;
    setSaving(true);
    setError(null);
    const result =
      rowEditingId === "new"
        ? await createSizeGridRow(grid.id, rowDraft)
        : await updateSizeGridRow(grid.id, rowEditingId, rowDraft);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setGrid(result.grid);
    cancelRowEdit();
    pushToast(
      rowEditingId === "new" ? "Строка добавлена" : "Строка сохранена",
      "success",
    );
    refreshAfterMutation();
  };

  const removeRow = async (rowId: number) => {
    if (!window.confirm("Удалить строку размера?")) return;
    setSaving(true);
    setError(null);
    const result = await deleteSizeGridRow(grid.id, rowId);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setGrid(result.grid);
    if (rowEditingId === rowId) cancelRowEdit();
    pushToast("Строка удалена", "success");
    refreshAfterMutation();
  };

  const removeGrid = async () => {
    if (!window.confirm("Удалить размерную сетку целиком?")) return;
    setSaving(true);
    setError(null);
    const result = await deleteSizeGrid(grid.id);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast("Сетка удалена", "success");
    router.push("/settings/catalogs/size-grids");
    router.refresh();
  };

  return (
    <SimpleEntityCard
      header={
        <EntityHeader
          eyebrow={
            <Link
              href="/settings/catalogs/size-grids"
              className="text-portal-primary hover:underline"
            >
              Размерные сетки
            </Link>
          }
          title={grid.name}
          description={
            grid.source_note
              ? `Эталон: ${grid.source_note}`
              : "Карточка размерной сетки"
          }
          status={
            <StatusBadge size="compact" tone={sizeTypeTone[grid.size_type]}>
              {SIZE_GRID_SIZE_TYPE_LABELS[grid.size_type]}
            </StatusBadge>
          }
          actions={
            <div className="flex flex-wrap items-center gap-portal-2">
              <Link
                href="/settings/catalogs/size-grids"
                className="portal-focus-ring inline-flex h-portal-control-default items-center justify-center gap-portal-2 rounded-portal-md border border-portal-border bg-portal-surface px-portal-4 text-portal-body font-medium text-portal-text hover:bg-portal-state-hover"
              >
                ← К списку
              </Link>
              {canWrite ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={removeGrid}
                  disabled={saving}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Удалить
                </Button>
              ) : null}
            </div>
          }
        />
      }
    >
      {error ? (
        <p className="mb-portal-4 text-portal-body text-portal-danger" role="alert">
          {error}
        </p>
      ) : null}

      <SectionCard
        title="Реквизиты"
        description="Одна сетка — один тип размера (Variant A)."
        size="compact"
        actions={
          canWrite && !headerEditing ? (
            <IconButton
              label="Редактировать реквизиты"
              variant="secondary"
              onClick={startHeaderEdit}
              disabled={saving}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </IconButton>
          ) : null
        }
      >
        {headerEditing ? (
          <div className="space-y-portal-4">
            <div className="grid gap-portal-3 sm:grid-cols-2">
              <Field label="Наименование" required>
                <Input
                  value={headerDraft.name}
                  onChange={(event) =>
                    setHeaderDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  disabled={saving}
                />
              </Field>
              <Field label="Источник / примечание">
                <Input
                  value={headerDraft.source_note}
                  onChange={(event) =>
                    setHeaderDraft((current) => ({
                      ...current,
                      source_note: event.target.value,
                    }))
                  }
                  disabled={saving}
                />
              </Field>
            </div>
            <p className="text-portal-caption text-portal-muted">
              Тип сетки: {SIZE_GRID_SIZE_TYPE_LABELS[grid.size_type]} (не
              меняется после создания).
            </p>
            <div className="flex gap-portal-2">
              <Button type="button" onClick={saveHeader} disabled={saving}>
                Сохранить
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setHeaderEditing(false)}
                disabled={saving}
              >
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          <dl className="grid gap-portal-3 sm:grid-cols-3">
            <div className="min-w-0 border-l-2 border-portal-primary/40 pl-portal-3">
              <dt className="text-portal-caption font-medium text-portal-muted">
                Наименование
              </dt>
              <dd className="mt-1 font-semibold text-portal-text">{grid.name}</dd>
            </div>
            <div className="min-w-0 border-l-2 border-portal-primary/40 pl-portal-3">
              <dt className="text-portal-caption font-medium text-portal-muted">
                Тип размерной сетки
              </dt>
              <dd className="mt-1 font-semibold text-portal-text">
                {SIZE_GRID_SIZE_TYPE_LABELS[grid.size_type]}
              </dd>
            </div>
            <div className="min-w-0 border-l-2 border-portal-border pl-portal-3">
              <dt className="text-portal-caption font-medium text-portal-muted">
                Строк размеров
              </dt>
              <dd className="mt-1 font-semibold text-portal-text">
                {rows.length}
              </dd>
            </div>
          </dl>
        )}
      </SectionCard>

      <SectionCard
        title="Таблица размеров"
        description="Справочные значения обхватов и роста (текст, как у Mosmade)."
        size="compact"
        actions={
          canWrite ? (
            <Button
              type="button"
              variant="secondary"
              onClick={startAddRow}
              disabled={saving || rowEditingId != null}
            >
              <Plus className="size-4" aria-hidden="true" />
              Добавить строку
            </Button>
          ) : null
        }
      >
        {rowEditingId != null && rowDraft != null ? (
          <div className="mb-portal-4 space-y-portal-3 rounded-portal-md border border-portal-border p-portal-4">
            <div className="flex items-center justify-between gap-portal-2">
              <p className="text-portal-body font-medium text-portal-text">
                {rowEditingId === "new" ? "Новая строка" : "Редактирование строки"}
              </p>
              <IconButton
                label="Закрыть редактор строки"
                variant="secondary"
                onClick={cancelRowEdit}
                disabled={saving}
              >
                <X className="size-4" aria-hidden="true" />
              </IconButton>
            </div>
            <RowEditorFields
              draft={rowDraft}
              onChange={setRowDraft}
              disabled={saving}
            />
            <div className="flex gap-portal-2">
              <Button type="button" onClick={saveRow} disabled={saving}>
                {saving ? "Сохранение…" : "Сохранить строку"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={cancelRowEdit}
                disabled={saving}
              >
                Отмена
              </Button>
            </div>
          </div>
        ) : null}

        {rows.length === 0 && rowEditingId == null ? (
          <EmptyState
            title="Нет строк размера"
            description={
              canWrite
                ? "Добавьте размеры в эту сетку."
                : "В этой сетке пока нет строк."
            }
          />
        ) : rows.length > 0 ? (
          <DataTableFrame>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>RU</DataTableHeaderCell>
                  <DataTableHeaderCell>INT</DataTableHeaderCell>
                  <DataTableHeaderCell>Обхват груди</DataTableHeaderCell>
                  <DataTableHeaderCell>Обхват талии</DataTableHeaderCell>
                  <DataTableHeaderCell>Обхват бедер</DataTableHeaderCell>
                  <DataTableHeaderCell>Рост S</DataTableHeaderCell>
                  <DataTableHeaderCell>Рост N</DataTableHeaderCell>
                  <DataTableHeaderCell>Рост T</DataTableHeaderCell>
                  {canWrite ? (
                    <DataTableHeaderCell className="w-24"> </DataTableHeaderCell>
                  ) : null}
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {rows.map((row) => (
                  <DataTableRow key={row.id}>
                    <DataTableCell className="font-medium">
                      {row.ru_size}
                    </DataTableCell>
                    <DataTableCell>{row.int_label}</DataTableCell>
                    <DataTableCell>{row.chest}</DataTableCell>
                    <DataTableCell>{row.waist}</DataTableCell>
                    <DataTableCell>{row.hip}</DataTableCell>
                    <DataTableCell>
                      {formatHeightLabel(row.height_s)}
                    </DataTableCell>
                    <DataTableCell>
                      {formatHeightLabel(row.height_n)}
                    </DataTableCell>
                    <DataTableCell>
                      {formatHeightLabel(row.height_t)}
                    </DataTableCell>
                    {canWrite ? (
                      <DataTableCell>
                        <div className="flex gap-portal-1">
                          <IconButton
                            label="Редактировать строку"
                            variant="secondary"
                            onClick={() => startEditRow(row.id)}
                            disabled={saving || rowEditingId != null}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            label="Удалить строку"
                            variant="secondary"
                            onClick={() => removeRow(row.id)}
                            disabled={saving}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </IconButton>
                        </div>
                      </DataTableCell>
                    ) : null}
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        ) : null}
      </SectionCard>

      {canReadAudit ? (
        <SectionCard
          title="Журнал аудита"
          description={auditEventsSummary(auditEvents.length)}
          size="compact"
          collapsed={!historyOpen}
          actions={
            <IconButton
              label={historyOpen ? "Свернуть" : "Развернуть"}
              title={historyOpen ? "Свернуть" : "Развернуть"}
              variant="secondary"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen((open) => !open)}
            >
              <ChevronDown
                className={[
                  "size-4 transition-transform",
                  historyOpen ? "rotate-180" : "",
                ].join(" ")}
                aria-hidden="true"
              />
            </IconButton>
          }
        >
          {auditEvents.length > 0 ? (
            <ul className="grid gap-portal-2">
              {auditEvents.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-portal-md border border-portal-border bg-portal-surface-secondary px-portal-3 py-portal-2"
                >
                  <p className="text-portal-body text-portal-text">
                    {formatAuditAction(entry.action)}
                  </p>
                  <p className="mt-1 text-portal-caption text-portal-muted">
                    {formatAuditActor(entry)} ·{" "}
                    {new Date(entry.occurred_at).toLocaleString("ru-RU")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-portal-caption text-portal-muted">
              Записей пока нет. Изменения сетки и строк появятся здесь после
              сохранения.
            </p>
          )}
        </SectionCard>
      ) : null}
    </SimpleEntityCard>
  );
}
