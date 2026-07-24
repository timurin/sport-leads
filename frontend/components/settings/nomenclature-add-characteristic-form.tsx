"use client";

import { Check, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import { addNomenclatureCharacteristicWithValue } from "@/app/(workspace)/settings/catalogs/nomenclature/characteristics-actions";
import { IconButton } from "@/components/ui/button";
import { controlClassName } from "@/lib/design-system/control-styles";
import type {
  CharacteristicDefinition,
  CharacteristicOption,
} from "@/lib/nomenclature";
import { findCharacteristicByName } from "@/lib/nomenclature";

type ValueSuggestion = {
  id: string;
  label: string;
  payload: string;
};

type NomenclatureAddCharacteristicFormProps = {
  nomenclatureId: number;
  /** Full characteristics handbook (including variant dimensions). */
  definitions: CharacteristicDefinition[];
  assignedIds: Set<number>;
  fieldOptions: Record<number, CharacteristicOption[]>;
  /** Distinct labels already used / catalog options per characteristic id. */
  usedValuesById?: Record<number, string[]>;
  onCancel: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

function pickValuePayload(
  definition: CharacteristicDefinition | null,
  options: CharacteristicOption[],
  typedValue: string,
): { kind: string; value: string } {
  const trimmed = typedValue.trim();
  if (!definition) {
    return { kind: "STRING", value: trimmed };
  }
  const kind = definition.kind ?? "STRING";
  if (kind === "LIST" || kind === "MULTI_SELECT" || kind === "COLOR") {
    const match =
      options.find(
        (option) =>
          option.is_active &&
          (String(option.id) === trimmed ||
            option.label.toLocaleLowerCase("ru") ===
              trimmed.toLocaleLowerCase("ru") ||
            option.code.toLocaleLowerCase("ru") ===
              trimmed.toLocaleLowerCase("ru")),
      ) ?? null;
    return {
      kind,
      value: match ? String(match.id) : trimmed,
    };
  }
  return {
    kind,
    value: trimmed,
  };
}

function findValueSuggestion(
  suggestions: ValueSuggestion[],
  raw: string,
): ValueSuggestion | null {
  const needle = raw.trim().toLocaleLowerCase("ru");
  if (!needle) return null;
  return (
    suggestions.find(
      (item) => item.label.toLocaleLowerCase("ru") === needle,
    ) ?? null
  );
}

/** Add row: Name + Value with autocomplete against catalog definitions/options. */
export function NomenclatureAddCharacteristicForm({
  nomenclatureId,
  definitions,
  assignedIds,
  fieldOptions,
  usedValuesById = {},
  onCancel,
  onSaved,
  onError,
}: NomenclatureAddCharacteristicFormProps) {
  const input = controlClassName({ size: "compact" });
  const nameListId = useId();
  const valueListId = useId();
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [nameOpen, setNameOpen] = useState(false);
  const [valueOpen, setValueOpen] = useState(false);
  const [nameActive, setNameActive] = useState(0);
  const [valueActive, setValueActive] = useState(0);
  const [saving, setSaving] = useState(false);

  const catalogMatch = useMemo(
    () => findCharacteristicByName(definitions, name),
    [definitions, name],
  );
  const alreadyAssigned = catalogMatch
    ? assignedIds.has(catalogMatch.id)
    : false;
  const matchedDefinition =
    catalogMatch && !alreadyAssigned ? catalogMatch : null;

  const available = useMemo(
    () =>
      definitions.filter(
        (field) => field.is_active && !assignedIds.has(field.id),
      ),
    [definitions, assignedIds],
  );

  const nameSuggestions = useMemo(() => {
    const needle = name.trim().toLocaleLowerCase("ru");
    return available
      .filter(
        (field) =>
          !needle ||
          field.name.toLocaleLowerCase("ru").includes(needle) ||
          field.code.toLocaleLowerCase("ru").includes(needle),
      )
      .slice(0, 8);
  }, [available, name]);

  const options = useMemo(
    () =>
      matchedDefinition
        ? (fieldOptions[matchedDefinition.id] ?? []).filter(
            (option) => option.is_active,
          )
        : [],
    [matchedDefinition, fieldOptions],
  );

  const valueSuggestions = useMemo((): ValueSuggestion[] => {
    if (!matchedDefinition) return [];
    const fromOptions: ValueSuggestion[] = options.map((option) => ({
      id: `opt-${option.id}`,
      label: option.label,
      payload: option.label,
    }));
    const fromUsed = (usedValuesById[matchedDefinition.id] ?? [])
      .filter((label) => {
        const needle = label.trim().toLocaleLowerCase("ru");
        return !fromOptions.some(
          (option) => option.label.toLocaleLowerCase("ru") === needle,
        );
      })
      .map((label, index) => ({
        id: `used-${matchedDefinition.id}-${index}`,
        label,
        payload: label,
      }));
    return [...fromOptions, ...fromUsed].slice(0, 12);
  }, [matchedDefinition, options, usedValuesById]);

  const filteredValueSuggestions = useMemo(() => {
    const needle = value.trim().toLocaleLowerCase("ru");
    return valueSuggestions
      .filter(
        (item) =>
          !needle || item.label.toLocaleLowerCase("ru").includes(needle),
      )
      .slice(0, 8);
  }, [value, valueSuggestions]);

  // When characteristic is matched, keep value open so options are discoverable.
  useEffect(() => {
    if (matchedDefinition && valueSuggestions.length > 0) {
      setValueOpen(true);
      setValueActive(0);
    }
  }, [matchedDefinition?.id, valueSuggestions.length]);

  const chooseName = (field: CharacteristicDefinition) => {
    setName(field.name);
    setNameOpen(false);
    setNameActive(0);
    setValueOpen(true);
  };

  const chooseValue = (item: ValueSuggestion) => {
    setValue(item.payload);
    setValueOpen(false);
    setValueActive(0);
  };

  const applyExactNameMatch = () => {
    const match = findCharacteristicByName(definitions, name);
    if (match) {
      setName(match.name);
    }
  };

  const applyExactValueMatch = () => {
    const match = findValueSuggestion(valueSuggestions, value);
    if (match) {
      setValue(match.payload);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      onError("Укажите название характеристики");
      return;
    }
    const existing = findCharacteristicByName(definitions, trimmedName);
    if (existing && assignedIds.has(existing.id)) {
      onError("Эта характеристика уже добавлена на карточку");
      return;
    }
    setSaving(true);
    try {
      const definition =
        existing && !assignedIds.has(existing.id) ? existing : null;
      const exactValue = findValueSuggestion(valueSuggestions, value);
      const payload = pickValuePayload(
        definition,
        options,
        exactValue?.payload ?? value,
      );
      const data = new FormData();
      data.append("nomenclature_id", String(nomenclatureId));
      data.append("name", existing?.name ?? trimmedName);
      data.append("value", payload.value);
      data.append("kind", payload.kind);
      if (definition) {
        data.append("characteristic_id", String(definition.id));
      }
      await addNomenclatureCharacteristicWithValue(data);
      onSaved();
    } catch (caught) {
      onError(
        caught instanceof Error
          ? caught.message
          : "Не удалось добавить характеристику",
      );
    } finally {
      setSaving(false);
    }
  };

  const nameExpanded = nameOpen && nameSuggestions.length > 0;
  const valueExpanded = valueOpen && filteredValueSuggestions.length > 0;
  const submitBlocked = alreadyAssigned;

  let nameHint: string | null = null;
  if (name.trim()) {
    if (alreadyAssigned) {
      nameHint = "Эта характеристика уже на карточке";
    } else if (matchedDefinition) {
      nameHint = `Подставлен: ${matchedDefinition.name}`;
    } else if (!nameOpen) {
      nameHint = "Будет создана новая характеристика";
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-2 grid gap-2 rounded-portal-md border border-dashed border-portal-border bg-portal-surface-secondary p-portal-3"
    >
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div className="relative min-w-0">
          <label className="mb-1 block text-portal-caption text-portal-muted">
            Название
          </label>
          <input
            value={name}
            onChange={(event) => {
              const next = event.target.value;
              setName(next);
              setNameActive(0);
              setNameOpen(true);
              const exact = findCharacteristicByName(definitions, next);
              if (exact) {
                setName(exact.name);
              }
            }}
            onFocus={() => setNameOpen(true)}
            onBlur={() => {
              applyExactNameMatch();
              setNameOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && nameOpen) {
                event.preventDefault();
                setNameOpen(false);
                return;
              }
              if (!nameExpanded) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setNameActive((current) => (current + 1) % nameSuggestions.length);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setNameActive(
                  (current) =>
                    (current - 1 + nameSuggestions.length) %
                    nameSuggestions.length,
                );
              } else if (event.key === "Enter" && nameSuggestions.length) {
                event.preventDefault();
                chooseName(
                  nameSuggestions[
                    Math.min(nameActive, nameSuggestions.length - 1)
                  ],
                );
              }
            }}
            placeholder="Начните вводить название"
            required
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={nameExpanded}
            aria-controls={nameExpanded ? nameListId : undefined}
            className={input}
          />
          {nameExpanded ? (
            <div
              id={nameListId}
              role="listbox"
              className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
            >
              {nameSuggestions.map((field, index) => {
                const active =
                  index === Math.min(nameActive, nameSuggestions.length - 1);
                return (
                  <button
                    key={field.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setNameActive(index)}
                    onClick={() => chooseName(field)}
                    className={`block w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm ${
                      active
                        ? "bg-blue-50 text-blue-800"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {field.name}{" "}
                    <span className="text-xs text-slate-500">({field.code})</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="relative min-w-0">
          <label className="mb-1 block text-portal-caption text-portal-muted">
            Значение
          </label>
          <input
            value={value}
            onChange={(event) => {
              const next = event.target.value;
              setValue(next);
              setValueActive(0);
              setValueOpen(true);
              const exact = findValueSuggestion(valueSuggestions, next);
              if (exact) {
                setValue(exact.payload);
              }
            }}
            onFocus={() => setValueOpen(true)}
            onBlur={() => {
              applyExactValueMatch();
              setValueOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && valueOpen) {
                event.preventDefault();
                setValueOpen(false);
                return;
              }
              if (!valueExpanded) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setValueActive(
                  (current) =>
                    (current + 1) % filteredValueSuggestions.length,
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setValueActive(
                  (current) =>
                    (current - 1 + filteredValueSuggestions.length) %
                    filteredValueSuggestions.length,
                );
              } else if (
                event.key === "Enter" &&
                filteredValueSuggestions.length
              ) {
                event.preventDefault();
                chooseValue(
                  filteredValueSuggestions[
                    Math.min(valueActive, filteredValueSuggestions.length - 1)
                  ],
                );
              }
            }}
            placeholder={
              valueSuggestions.length
                ? "Выберите или введите значение"
                : "Введите значение"
            }
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={valueExpanded}
            aria-controls={valueExpanded ? valueListId : undefined}
            className={input}
          />
          {valueExpanded ? (
            <div
              id={valueListId}
              role="listbox"
              className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
            >
              {filteredValueSuggestions.map((item, index) => {
                const active =
                  index ===
                  Math.min(valueActive, filteredValueSuggestions.length - 1);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setValueActive(index)}
                    onClick={() => chooseValue(item)}
                    className={`block w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm ${
                      active
                        ? "bg-blue-50 text-blue-800"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            type="submit"
            label="Добавить"
            title="Добавить"
            variant="primary"
            disabled={saving || submitBlocked}
          >
            <Check className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            type="button"
            label="Отмена"
            title="Отмена"
            variant="secondary"
            disabled={saving}
            onClick={onCancel}
          >
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {nameHint ? (
        <p
          className={[
            "text-portal-caption",
            alreadyAssigned ? "text-portal-danger" : "text-portal-muted",
          ].join(" ")}
          role={alreadyAssigned ? "alert" : undefined}
        >
          {nameHint}
        </p>
      ) : null}
    </form>
  );
}
