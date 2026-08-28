"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  createDetailingItem,
  deleteDetailingItem,
  updateDetailingItem,
} from "@/app/(workspace)/settings/catalogs/detailing/detailing-actions";
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
import { Checkbox, Field, Input } from "@/components/ui/form-controls";
import { PageToolbar } from "@/components/ui/page-header";
import {
  detailingApplicabilityLabel,
  type DetailingItem,
} from "@/lib/detailing";
import type { ProductType } from "@/lib/product-types";

export function DetailingWorkspace({
  items,
  productTypes,
}: {
  items: DetailingItem[];
  productTypes: ProductType[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(items);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftTypeIds, setDraftTypeIds] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru");
    if (!needle) return rows;
    return rows.filter(
      (row) =>
        row.name.toLocaleLowerCase("ru").includes(needle) ||
        detailingApplicabilityLabel(row).toLocaleLowerCase("ru").includes(needle),
    );
  }, [query, rows]);

  const beginCreate = () => {
    setCreating(true);
    setEditingId(null);
    setDraftName("");
    setDraftTypeIds([]);
    setError(null);
  };

  const beginEdit = (row: DetailingItem) => {
    setCreating(false);
    setEditingId(row.id);
    setDraftName(row.name);
    setDraftTypeIds(row.applicability_product_types.map((item) => item.id));
    setError(null);
  };

  const cancel = () => {
    setCreating(false);
    setEditingId(null);
    setError(null);
  };

  const toggleType = (typeId: number) => {
    setDraftTypeIds((current) =>
      current.includes(typeId)
        ? current.filter((id) => id !== typeId)
        : [...current, typeId],
    );
  };

  const onSave = async () => {
    setBusy(true);
    setError(null);
    const draft = {
      name: draftName,
      applicability_product_type_ids: draftTypeIds,
    };
    const result =
      creating || editingId == null
        ? await createDetailingItem(draft)
        : await updateDetailingItem(editingId, draft);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setRows((current) => {
      const without = current.filter((row) => row.id !== result.item.id);
      return [...without, result.item].sort((a, b) =>
        a.name.localeCompare(b.name, "ru"),
      );
    });
    cancel();
    router.refresh();
  };

  const onDelete = async (row: DetailingItem) => {
    if (!window.confirm(`Удалить «${row.name}»?`)) return;
    setBusy(true);
    const result = await deleteDetailingItem(row.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setRows((current) => current.filter((item) => item.id !== row.id));
    router.refresh();
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-portal-4 p-portal-6">
      <PageToolbar
        start={
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск деталировки…"
            size="compact"
            aria-label="Поиск деталировки"
            className="max-w-xs"
          />
        }
        end={
          <IconButton
            label="Добавить"
            variant="primary"
            disabled={busy}
            onClick={beginCreate}
          >
            <Plus className="size-4" aria-hidden="true" />
          </IconButton>
        }
      />
      {error ? (
        <p className="text-portal-caption text-portal-danger" role="alert">
          {error}
        </p>
      ) : null}
      {creating || editingId != null ? (
        <div className="grid max-w-xl gap-portal-3 rounded-portal-md border border-portal-border p-portal-4">
          <Field label="Наименование">
            <Input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              size="compact"
              disabled={busy}
            />
          </Field>
          <Field label="Применимость (виды изделий)">
            <div className="max-h-48 space-y-portal-1 overflow-y-auto rounded-portal-md border border-portal-border p-portal-2">
              {productTypes.length === 0 ? (
                <p className="text-portal-caption text-portal-muted">
                  Справочник видов изделий пуст.
                </p>
              ) : (
                productTypes.map((row) => (
                  <label
                    key={row.id}
                    className="flex cursor-pointer items-center gap-portal-2 text-portal-body"
                  >
                    <Checkbox
                      checked={draftTypeIds.includes(row.id)}
                      disabled={busy}
                      onChange={() => toggleType(row.id)}
                      aria-label={row.name}
                    />
                    <span>
                      {row.name}
                      {row.is_active ? "" : " (неактивен)"}
                    </span>
                  </label>
                ))
              )}
            </div>
          </Field>
          <div className="flex gap-portal-2">
            <Button
              type="button"
              variant="primary"
              size="compact"
              disabled={busy}
              onClick={() => void onSave()}
            >
              Сохранить
            </Button>
            <Button
              type="button"
              size="compact"
              disabled={busy}
              onClick={cancel}
            >
              Отмена
            </Button>
          </div>
        </div>
      ) : null}
      {filtered.length === 0 ? (
        <EmptyState
          title="Элементов нет"
          description="Добавьте первую позицию деталировки."
        />
      ) : (
        <DataTableFrame>
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>ID</DataTableHeaderCell>
                <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                <DataTableHeaderCell>Применимость</DataTableHeaderCell>
                <DataTableHeaderCell className="w-24 text-right">
                  —
                </DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {filtered.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell>{row.id}</DataTableCell>
                  <DataTableCell>{row.name}</DataTableCell>
                  <DataTableCell>{detailingApplicabilityLabel(row)}</DataTableCell>
                  <DataTableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <IconButton
                        label="Редактировать"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => beginEdit(row)}
                      >
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton
                        label="Удалить"
                        variant="danger"
                        disabled={busy}
                        onClick={() => void onDelete(row)}
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </DataTableFrame>
      )}
    </div>
  );
}
