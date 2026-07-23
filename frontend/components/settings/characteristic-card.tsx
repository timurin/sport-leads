"use client";

import Link from "next/link";
import { Check, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createCharacteristicOption,
  deleteCharacteristicOption,
  updateCharacteristic,
  updateCharacteristicOption,
} from "@/app/(workspace)/settings/catalogs/nomenclature/characteristics-actions";
import { VersionedWorkspace } from "@/components/entity/versioned-workspace";
import { IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityHeader } from "@/components/ui/entity-header";
import { Input } from "@/components/ui/form-controls";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  CharacteristicDefinition,
  CharacteristicOption,
} from "@/lib/nomenclature";

const OPTION_KINDS = new Set(["COLOR", "LIST", "MULTI_SELECT"]);

/** Values grid: mobile 1 → ≥640 (&lt;1300): 2 → ≥1300: 3 → ≥1700: 4 */
const VALUES_GRID_CLASS =
  "grid grid-cols-1 gap-portal-2 min-[640px]:grid-cols-2 min-[1300px]:grid-cols-3 min-[1700px]:grid-cols-4";

type OptionDraft = {
  label: string;
  hex_value: string;
};

function slugifyOptionCode(label: string): string {
  const base = label
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/[а-яё]/g, (ch) => {
      const map: Record<string, string> = {
        а: "a",
        б: "b",
        в: "v",
        г: "g",
        д: "d",
        е: "e",
        ё: "e",
        ж: "zh",
        з: "z",
        и: "i",
        й: "y",
        к: "k",
        л: "l",
        м: "m",
        н: "n",
        о: "o",
        п: "p",
        р: "r",
        с: "s",
        т: "t",
        у: "u",
        ф: "f",
        х: "h",
        ц: "c",
        ч: "ch",
        ш: "sh",
        щ: "sch",
        ъ: "",
        ы: "y",
        ь: "",
        э: "e",
        ю: "yu",
        я: "ya",
      };
      return map[ch] ?? "";
    })
    .replace(/[^a-z0-9_-]+/g, "")
    .replace(/^-+|-+$/g, "");
  return base || `value-${Date.now().toString(36)}`;
}

/** Characteristic card — toolbar + values grid (etalon product-models chrome). */
export function CharacteristicCard({
  definition,
  options,
}: {
  definition: CharacteristicDefinition;
  options: CharacteristicOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tracked, setTracked] = useState(definition);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(definition.name);
  const [isActive, setIsActive] = useState(definition.is_active);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
  const [optionDraft, setOptionDraft] = useState<OptionDraft | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newHex, setNewHex] = useState("");

  if (definition.id !== tracked.id) {
    setTracked(definition);
    setEditing(false);
    setName(definition.name);
    setIsActive(definition.is_active);
    setActionError(null);
    setEditingOptionId(null);
    setOptionDraft(null);
    setAdding(false);
    setNewLabel("");
    setNewHex("");
  } else if (definition !== tracked && !editing) {
    setTracked(definition);
    setName(definition.name);
    setIsActive(definition.is_active);
  }

  const supportsOptions = OPTION_KINDS.has(definition.kind);
  const dirty =
    editing &&
    (name.trim() !== definition.name || isActive !== definition.is_active);
  const displayActive = editing ? isActive : definition.is_active;

  const cancelEdit = () => {
    setEditing(false);
    setName(definition.name);
    setIsActive(definition.is_active);
    setActionError(null);
  };

  const startEdit = () => {
    setEditing(true);
    setName(definition.name);
    setIsActive(definition.is_active);
    setActionError(null);
  };

  const onSave = () => {
    if (!dirty) return;
    startTransition(async () => {
      try {
        setActionError(null);
        const data = new FormData();
        data.set("id", String(definition.id));
        data.set("name", name.trim());
        data.set("is_active", String(isActive));
        await updateCharacteristic(data);
        setEditing(false);
        router.refresh();
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Не удалось сохранить",
        );
      }
    });
  };

  const startOptionEdit = (option: CharacteristicOption) => {
    setEditingOptionId(option.id);
    setOptionDraft({
      label: option.label,
      hex_value: option.hex_value ?? "",
    });
    setError(null);
    setAdding(false);
  };

  const cancelOptionEdit = () => {
    setEditingOptionId(null);
    setOptionDraft(null);
  };

  const saveOption = (option: CharacteristicOption) => {
    if (!optionDraft) return;
    startTransition(async () => {
      try {
        setError(null);
        const data = new FormData();
        data.set("id", String(option.id));
        data.set("characteristic_id", String(definition.id));
        data.set("label", optionDraft.label.trim());
        data.set("sort_order", String(option.sort_order));
        data.set("hex_value", optionDraft.hex_value.trim());
        data.set("is_active", String(option.is_active));
        await updateCharacteristicOption(data);
        cancelOptionEdit();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка сохранения");
      }
    });
  };

  const removeOption = (option: CharacteristicOption) => {
    if (option.can_delete === false) {
      setError("Значение нельзя удалить: есть использование или проводки");
      return;
    }
    if (!window.confirm(`Удалить значение «${option.label}»?`)) return;
    startTransition(async () => {
      try {
        setError(null);
        const data = new FormData();
        data.set("id", String(option.id));
        data.set("characteristic_id", String(definition.id));
        await deleteCharacteristicOption(data);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка удаления");
      }
    });
  };

  const addOption = () => {
    const label = newLabel.trim();
    if (!label) {
      setError("Введите значение");
      return;
    }
    if (definition.kind === "COLOR" && !newHex.trim()) {
      setError("Укажите HEX цвета");
      return;
    }
    startTransition(async () => {
      try {
        setError(null);
        const data = new FormData();
        data.set("characteristic_id", String(definition.id));
        data.set("code", slugifyOptionCode(label));
        data.set("label", label);
        data.set("sort_order", String(options.length));
        if (definition.kind === "COLOR") {
          data.set("hex_value", newHex.trim());
        }
        await createCharacteristicOption(data);
        setNewLabel("");
        setNewHex("");
        setAdding(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка создания");
      }
    });
  };

  const sortedOptions = [...options].sort(
    (a, b) =>
      a.sort_order - b.sort_order || a.label.localeCompare(b.label, "ru"),
  );

  return (
    <VersionedWorkspace
      header={
        <div className="rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 shadow-portal-card sm:p-portal-5">
          <EntityHeader
            eyebrow={
              <Link
                href="/settings/catalogs/product-characteristics"
                className="inline-flex items-center gap-1.5 font-medium text-portal-primary hover:underline"
              >
                ← Характеристики номенклатуры
              </Link>
            }
            title={
              editing ? (
                <Input
                  value={name}
                  size="compact"
                  className="max-w-md text-portal-page font-semibold"
                  disabled={pending}
                  aria-label="Название"
                  onChange={(event) => setName(event.target.value)}
                />
              ) : (
                definition.name
              )
            }
            status={
              editing ? (
                <button
                  type="button"
                  className="portal-focus-ring rounded-portal-md"
                  disabled={pending}
                  onClick={() => setIsActive((prev) => !prev)}
                  aria-label={
                    isActive
                      ? "Статус: Активна. Нажмите, чтобы сделать неактивной"
                      : "Статус: Неактивна. Нажмите, чтобы сделать активной"
                  }
                >
                  <StatusBadge
                    size="compact"
                    tone={isActive ? "success" : "neutral"}
                  >
                    {isActive ? "Активна" : "Неактивна"}
                  </StatusBadge>
                </button>
              ) : (
                <StatusBadge
                  size="compact"
                  tone={displayActive ? "success" : "neutral"}
                >
                  {displayActive ? "Активна" : "Неактивна"}
                </StatusBadge>
              )
            }
            actions={
              <div className="flex flex-col items-stretch gap-1 sm:items-end">
                <div
                  className="flex flex-wrap items-center gap-1"
                  role="toolbar"
                  aria-label="Действия характеристики"
                >
                  {editing ? (
                    <IconButton
                      label="Отменить редактирование"
                      variant="secondary"
                      disabled={pending}
                      onClick={cancelEdit}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </IconButton>
                  ) : (
                    <IconButton
                      label="Редактировать"
                      variant="secondary"
                      disabled={pending}
                      onClick={startEdit}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </IconButton>
                  )}
                  <IconButton
                    label="Сохранить"
                    variant={dirty ? "primary" : "secondary"}
                    disabled={pending || !dirty}
                    onClick={onSave}
                  >
                    <Save className="size-4" aria-hidden="true" />
                  </IconButton>
                </div>
                {actionError ? (
                  <p
                    className="text-portal-caption text-portal-danger"
                    role="alert"
                  >
                    {actionError}
                  </p>
                ) : null}
              </div>
            }
          />
        </div>
      }
    >
      <SectionCard
        title="Значения характеристики"
        description={
          supportsOptions
            ? "Значения, доступные для выбора в номенклатуре"
            : "Для этого типа значения задаются на карточке номенклатуры"
        }
        size="compact"
        actions={
          supportsOptions ? (
            <IconButton
              label="Добавить значение"
              variant="primary"
              disabled={pending || adding || editingOptionId != null}
              onClick={() => {
                setAdding(true);
                setError(null);
                cancelOptionEdit();
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
            </IconButton>
          ) : undefined
        }
      >
        <div className="grid min-w-0 gap-portal-3">
          {error ? (
            <p className="text-portal-caption text-portal-danger" role="alert">
              {error}
            </p>
          ) : null}

          {!supportsOptions ? (
            <EmptyState
              title="Справочник значений не требуется"
              description="Тип без списка вариантов — значение вводится на карточке номенклатуры."
              size="compact"
            />
          ) : sortedOptions.length === 0 && !adding ? (
            <EmptyState
              title="Значений пока нет"
              description="Нажмите «+», чтобы добавить первое значение."
              size="compact"
            />
          ) : (
            <ul className={VALUES_GRID_CLASS}>
              {adding ? (
                <li className="col-span-full rounded-portal-md border border-portal-border bg-portal-surface-secondary">
                  <div className="flex min-w-0 flex-nowrap items-center gap-portal-2 px-portal-3 py-portal-2">
                    <div className="min-w-0 flex-1">
                      <Input
                        value={newLabel}
                        size="compact"
                        placeholder="Значение"
                        disabled={pending}
                        autoFocus
                        aria-label="Новое значение"
                        onChange={(event) => setNewLabel(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addOption();
                          }
                          if (event.key === "Escape") {
                            setAdding(false);
                            setNewLabel("");
                            setNewHex("");
                          }
                        }}
                      />
                    </div>
                    {definition.kind === "COLOR" ? (
                      <div className="w-28 shrink-0">
                        <Input
                          value={newHex}
                          size="compact"
                          placeholder="#000000"
                          disabled={pending}
                          aria-label="HEX цвет"
                          onChange={(event) => setNewHex(event.target.value)}
                        />
                      </div>
                    ) : null}
                    <div className="flex shrink-0 items-center gap-1">
                      <IconButton
                        label="Сохранить"
                        variant="primary"
                        disabled={pending}
                        onClick={addOption}
                      >
                        <Check className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label="Отмена"
                        disabled={pending}
                        onClick={() => {
                          setAdding(false);
                          setNewLabel("");
                          setNewHex("");
                        }}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  </div>
                </li>
              ) : null}

              {sortedOptions.map((option) => {
                const rowEditing =
                  editingOptionId === option.id && optionDraft != null;
                return (
                  <li
                    key={option.id}
                    className={[
                      "flex min-h-0 rounded-portal-md border border-portal-border bg-portal-surface-secondary",
                      rowEditing ? "col-span-full" : "h-full",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="flex min-h-0 min-w-0 flex-1 flex-nowrap items-stretch gap-portal-2 px-portal-3 py-portal-2">
                      {rowEditing ? (
                        <>
                          <div className="min-w-0 flex-1">
                            <Input
                              value={optionDraft.label}
                              size="compact"
                              disabled={pending}
                              aria-label="Значение"
                              onChange={(event) =>
                                setOptionDraft({
                                  ...optionDraft,
                                  label: event.target.value,
                                })
                              }
                            />
                          </div>
                          {definition.kind === "COLOR" ? (
                            <div className="w-28 shrink-0">
                              <Input
                                value={optionDraft.hex_value}
                                size="compact"
                                disabled={pending}
                                aria-label="HEX"
                                onChange={(event) =>
                                  setOptionDraft({
                                    ...optionDraft,
                                    hex_value: event.target.value,
                                  })
                                }
                              />
                            </div>
                          ) : null}
                          <div className="flex shrink-0 items-center gap-1">
                            <IconButton
                              label="Сохранить"
                              variant="primary"
                              disabled={pending}
                              onClick={() => saveOption(option)}
                            >
                              <Check className="size-4" aria-hidden="true" />
                            </IconButton>
                            <IconButton
                              label="Отмена"
                              disabled={pending}
                              onClick={cancelOptionEdit}
                            >
                              <X className="size-4" aria-hidden="true" />
                            </IconButton>
                          </div>
                        </>
                      ) : (
                        <div className="flex min-h-[4.5rem] min-w-0 flex-1 flex-col gap-portal-2">
                          <div className="flex min-w-0 items-start justify-between gap-portal-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-portal-2">
                              {definition.kind === "COLOR" &&
                              option.hex_value ? (
                                <i
                                  className="inline-block size-4 shrink-0 rounded-portal-sm border border-portal-border"
                                  style={{
                                    backgroundColor: option.hex_value,
                                  }}
                                  aria-hidden="true"
                                />
                              ) : null}
                              <span className="font-semibold text-portal-text">
                                {option.label}
                              </span>
                              {definition.kind === "COLOR" &&
                              option.hex_value ? (
                                <span className="text-portal-caption text-portal-muted">
                                  {option.hex_value}
                                </span>
                              ) : null}
                            </div>
                            <div
                              className="flex shrink-0 flex-wrap items-center gap-1"
                              role="toolbar"
                              aria-label={`Действия значения ${option.label}`}
                            >
                              <IconButton
                                label="Редактировать"
                                variant="secondary"
                                disabled={pending || adding}
                                onClick={() => startOptionEdit(option)}
                              >
                                <Pencil
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </IconButton>
                              <IconButton
                                label={
                                  option.can_delete === false
                                    ? "Удаление недоступно"
                                    : "Удалить"
                                }
                                variant="danger"
                                disabled={
                                  pending ||
                                  adding ||
                                  option.can_delete === false
                                }
                                onClick={() => removeOption(option)}
                              >
                                <Trash2
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </IconButton>
                            </div>
                          </div>
                          <div className="mt-auto self-start">
                            <StatusBadge
                              size="compact"
                              tone={
                                option.is_active ? "success" : "neutral"
                              }
                            >
                              {option.is_active ? "Активно" : "Неактивно"}
                            </StatusBadge>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SectionCard>
    </VersionedWorkspace>
  );
}
