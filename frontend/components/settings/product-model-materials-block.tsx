"use client";

import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { replaceProductModelMaterialLinesAction } from "@/app/(workspace)/settings/catalogs/product-models/model-materials-actions";
import { Button, IconButton } from "@/components/ui/button";
import {
  CreatableTagsInput,
  type CreatableTagValue,
} from "@/components/ui/creatable-tags-input";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/form-controls";
import { SectionCard } from "@/components/ui/section-card";
import type { CharacteristicOption } from "@/lib/nomenclature";
import type { DetailingItem } from "@/lib/detailing";
import {
  MODEL_MATERIAL_KIND_LABELS,
  type ProductModelMaterialKind,
  type ProductModelMaterialLine,
  type ProductModelMaterialLineWrite,
} from "@/lib/product-model-materials";

type MaterialOption = { id: number; name: string; unit: string; is_active: boolean };

type DraftLine = {
  key: string;
  kind: ProductModelMaterialKind;
  nomenclature_id: string;
  nomenclature_name: string;
  planned_qty: string;
  fabric_stage_code: string;
  type_option_id: string;
  color_option_id: string;
  detailing_tags: CreatableTagValue[];
};

const KINDS: ProductModelMaterialKind[] = [
  "print",
  "fabric",
  "cutting",
  "hardware",
  "packaging",
];

function toDraft(lines: ProductModelMaterialLine[]): DraftLine[] {
  return lines.map((line) => ({
    key: `id-${line.id}`,
    kind: line.kind,
    nomenclature_id: String(line.nomenclature_id),
    nomenclature_name: line.nomenclature_name ?? "",
    planned_qty: String(line.planned_qty),
    fabric_stage_code: line.fabric_stage_code ?? "",
    type_option_id: line.type_option_id != null ? String(line.type_option_id) : "",
    color_option_id:
      line.color_option_id != null ? String(line.color_option_id) : "",
    detailing_tags: line.detailing_items.map((item) => ({
      id: item.id,
      name: item.name,
    })),
  }));
}

function emptyDraft(kind: ProductModelMaterialKind): DraftLine {
  return {
    key: `new-${kind}-${Date.now()}-${Math.random()}`,
    kind,
    nomenclature_id: "",
    nomenclature_name: "",
    planned_qty: "1",
    fabric_stage_code: kind === "fabric" ? "print" : "",
    type_option_id: "",
    color_option_id: "",
    detailing_tags: [],
  };
}

export function ProductModelMaterialsBlock({
  modelId,
  initialLines,
  materials,
  detailingItems,
  typeOptions,
  colorOptions,
}: {
  modelId: number;
  initialLines: ProductModelMaterialLine[];
  materials: MaterialOption[];
  detailingItems: DetailingItem[];
  typeOptions: CharacteristicOption[];
  colorOptions: CharacteristicOption[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<ProductModelMaterialKind>("print");
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState(() => toDraft(initialLines));
  const [persisted, setPersisted] = useState(initialLines);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabDrafts = useMemo(
    () => drafts.filter((row) => row.kind === tab),
    [drafts, tab],
  );

  const beginEdit = () => {
    setDrafts(toDraft(persisted));
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setDrafts(toDraft(persisted));
    setEditing(false);
    setError(null);
  };

  const onSave = async () => {
    setBusy(true);
    setError(null);
    const payload: ProductModelMaterialLineWrite[] = [];
    const sequenceByKind = new Map<ProductModelMaterialKind, number>();
    for (const row of drafts) {
      const nomenclatureId = Number(row.nomenclature_id);
      if (!Number.isSafeInteger(nomenclatureId) || nomenclatureId <= 0) {
        setBusy(false);
        setError("Выберите материал во всех строках");
        return;
      }
      const names = row.detailing_tags
        .filter((tag) => tag.id == null)
        .map((tag) => tag.name.trim())
        .filter(Boolean);
      const detailingIds = row.detailing_tags
        .map((tag) => tag.id)
        .filter((id): id is number => id != null && id > 0);
      const nextSeq = (sequenceByKind.get(row.kind) ?? 0) + 1;
      sequenceByKind.set(row.kind, nextSeq);
      payload.push({
        kind: row.kind,
        nomenclature_id: nomenclatureId,
        planned_qty: row.planned_qty.replace(",", "."),
        sequence: nextSeq,
        fabric_stage_code:
          row.kind === "fabric"
            ? (row.fabric_stage_code as "print" | "cutting")
            : null,
        type_option_id:
          row.kind === "hardware" && row.type_option_id
            ? Number(row.type_option_id)
            : null,
        color_option_id:
          row.kind === "hardware" && row.color_option_id
            ? Number(row.color_option_id)
            : null,
        detailing_item_ids: row.kind === "fabric" ? detailingIds : [],
        detailing_names: row.kind === "fabric" ? names : [],
      });
    }
    const result = await replaceProductModelMaterialLinesAction(modelId, payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPersisted(result.lines);
    setDrafts(toDraft(result.lines));
    setEditing(false);
    router.refresh();
  };

  return (
    <SectionCard
      title="Материалы"
      size="compact"
      description="Нормы материалов модели по цехам."
      actions={
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <IconButton
                label="Отменить"
                variant="secondary"
                disabled={busy}
                onClick={cancelEdit}
              >
                <X className="size-4" />
              </IconButton>
              <IconButton
                label="Сохранить"
                variant="primary"
                disabled={busy}
                onClick={() => void onSave()}
              >
                <Save className="size-4" />
              </IconButton>
            </>
          ) : (
            <IconButton
              label="Редактировать"
              variant="secondary"
              disabled={busy}
              onClick={beginEdit}
            >
              <Pencil className="size-4" />
            </IconButton>
          )}
        </div>
      }
    >
      <div className="mb-portal-3 flex flex-wrap gap-portal-1">
        {KINDS.map((kind) => (
          <Button
            key={kind}
            type="button"
            size="compact"
            variant={tab === kind ? "primary" : "secondary"}
            onClick={() => setTab(kind)}
          >
            {MODEL_MATERIAL_KIND_LABELS[kind]}
          </Button>
        ))}
      </div>
      {error ? (
        <p className="mb-portal-2 text-portal-caption text-portal-danger">{error}</p>
      ) : null}
      {editing ? (
        <div className="mb-portal-2">
          <Button
            type="button"
            size="compact"
            disabled={busy}
            onClick={() =>
              setDrafts((current) => [...current, emptyDraft(tab)])
            }
          >
            <Plus className="size-4" />
            Добавить строку
          </Button>
        </div>
      ) : null}
      {tabDrafts.length === 0 ? (
        <p className="text-portal-caption text-portal-muted">Строк нет.</p>
      ) : (
        <DataTableFrame>
          <DataTable minWidthClassName="min-w-[720px]">
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                <DataTableHeaderCell className="w-28">План</DataTableHeaderCell>
                {tab === "fabric" ? (
                  <DataTableHeaderCell className="w-32">Цех</DataTableHeaderCell>
                ) : null}
                {tab === "fabric" ? (
                  <DataTableHeaderCell>Деталировка</DataTableHeaderCell>
                ) : null}
                {tab === "hardware" ? (
                  <>
                    <DataTableHeaderCell className="w-40">Тип</DataTableHeaderCell>
                    <DataTableHeaderCell className="w-40">Цвет</DataTableHeaderCell>
                  </>
                ) : null}
                {editing ? (
                  <DataTableHeaderCell className="w-12 text-right">—</DataTableHeaderCell>
                ) : null}
              </tr>
            </DataTableHead>
            <DataTableBody>
              {tabDrafts.map((row) => (
                <DataTableRow key={row.key}>
                  <DataTableCell>
                    {editing ? (
                      <Select
                        size="compact"
                        value={row.nomenclature_id}
                        disabled={busy}
                        onChange={(event) =>
                          setDrafts((current) =>
                            current.map((item) =>
                              item.key === row.key
                                ? { ...item, nomenclature_id: event.target.value }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="">Выберите…</option>
                        {materials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      row.nomenclature_name ||
                      materials.find((m) => String(m.id) === row.nomenclature_id)
                        ?.name ||
                      "—"
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    {editing ? (
                      <Input
                        size="compact"
                        value={row.planned_qty}
                        disabled={busy}
                        onChange={(event) =>
                          setDrafts((current) =>
                            current.map((item) =>
                              item.key === row.key
                                ? { ...item, planned_qty: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    ) : (
                      row.planned_qty
                    )}
                  </DataTableCell>
                  {tab === "fabric" ? (
                    <DataTableCell>
                      {editing ? (
                        <Select
                          size="compact"
                          value={row.fabric_stage_code}
                          disabled={busy}
                          onChange={(event) =>
                            setDrafts((current) =>
                              current.map((item) =>
                                item.key === row.key
                                  ? {
                                      ...item,
                                      fabric_stage_code: event.target.value,
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="print">Печать</option>
                          <option value="cutting">Раскрой</option>
                        </Select>
                      ) : row.fabric_stage_code === "cutting" ? (
                        "Раскрой"
                      ) : (
                        "Печать"
                      )}
                    </DataTableCell>
                  ) : null}
                  {tab === "fabric" ? (
                    <DataTableCell>
                      {editing ? (
                        <CreatableTagsInput
                          values={row.detailing_tags}
                          options={detailingItems.map((item) => ({
                            id: item.id,
                            name: item.name,
                          }))}
                          disabled={busy}
                          placeholder="Деталировка…"
                          aria-label="Деталировка"
                          onChange={(next) =>
                            setDrafts((current) =>
                              current.map((item) =>
                                item.key === row.key
                                  ? { ...item, detailing_tags: next }
                                  : item,
                              ),
                            )
                          }
                        />
                      ) : (
                        row.detailing_tags.map((tag) => tag.name).join(", ") || "—"
                      )}
                    </DataTableCell>
                  ) : null}
                  {tab === "hardware" ? (
                    <>
                      <DataTableCell>
                        {editing ? (
                          <Select
                            size="compact"
                            value={row.type_option_id}
                            disabled={busy}
                            onChange={(event) =>
                              setDrafts((current) =>
                                current.map((item) =>
                                  item.key === row.key
                                    ? {
                                        ...item,
                                        type_option_id: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                          >
                            <option value="">—</option>
                            {typeOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          typeOptions.find(
                            (option) => String(option.id) === row.type_option_id,
                          )?.label ?? "—"
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        {editing ? (
                          <Select
                            size="compact"
                            value={row.color_option_id}
                            disabled={busy}
                            onChange={(event) =>
                              setDrafts((current) =>
                                current.map((item) =>
                                  item.key === row.key
                                    ? {
                                        ...item,
                                        color_option_id: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                          >
                            <option value="">—</option>
                            {colorOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          colorOptions.find(
                            (option) => String(option.id) === row.color_option_id,
                          )?.label ?? "—"
                        )}
                      </DataTableCell>
                    </>
                  ) : null}
                  {editing ? (
                    <DataTableCell className="text-right">
                      <IconButton
                        label="Удалить"
                        variant="danger"
                        disabled={busy}
                        onClick={() =>
                          setDrafts((current) =>
                            current.filter((item) => item.key !== row.key),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    </DataTableCell>
                  ) : null}
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </DataTableFrame>
      )}
    </SectionCard>
  );
}
