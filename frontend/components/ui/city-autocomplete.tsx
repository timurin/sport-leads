"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useId, useState } from "react";

import { controlClassName, labelClassName } from "@/lib/design-system/control-styles";
import {
  rankCitySuggestions,
  readPlatformCitySuggestionNames,
  toPlatformCitySuggestionsPath,
} from "@/lib/platform-city-suggestions";

type CityAutocompleteProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
};

const defaultInputClass = controlClassName({ className: "mt-portal-1" });

export function CityAutocomplete({
  id,
  label,
  value,
  onChange,
  className = "",
  inputClassName = defaultInputClass,
}: CityAutocompleteProps) {
  const generatedId = useId();
  const listboxId = `${id}-${generatedId.replaceAll(":", "")}-suggestions`;
  const canSuggest = value.trim().length >= 2;
  const deferredValue = useDeferredValue(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [resolvedQuery, setResolvedQuery] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (deferredValue.trim().length < 2) {
      return;
    }

    const controller = new AbortController();
    const query = deferredValue.trim();

    void fetch(toPlatformCitySuggestionsPath(query), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          let message = `Ошибка подсказок (${response.status})`;
          try {
            const body = (await response.json()) as { detail?: string };
            if (typeof body.detail === "string" && body.detail.trim()) {
              message = body.detail;
            }
          } catch {
            // Keep default message.
          }
          throw new Error(message);
        }
        return response.json();
      })
      .then((payload) => {
        const names = readPlatformCitySuggestionNames(payload);
        setSuggestions(rankCitySuggestions(query, names));
        setResolvedQuery(query);
        setActiveIndex(0);
        setLoadError("");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setSuggestions([]);
        setResolvedQuery(query);
        setActiveIndex(0);
        setLoadError(
          error instanceof Error && error.message.trim()
            ? error.message
            : "Не удалось загрузить города из справочника платформы.",
        );
      });

    return () => controller.abort();
  }, [deferredValue]);

  function choose(city: string) {
    onChange(city);
    setOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (!open || suggestions.length === 0) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + suggestions.length) % suggestions.length,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(suggestions[Math.min(activeIndex, suggestions.length - 1)]);
    }
  }

  const expanded = open && canSuggest;
  const queryResolved = resolvedQuery === deferredValue.trim();
  const visibleSuggestions = queryResolved ? suggestions : [];
  const visibleError = queryResolved ? loadError : "";
  const loading = canSuggest && !queryResolved && !visibleError;
  const activeOptionId =
    expanded && visibleSuggestions.length
      ? `${listboxId}-option-${Math.min(activeIndex, visibleSuggestions.length - 1)}`
      : undefined;

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className={labelClassName()}>
        {label}
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          maxLength={150}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          className={inputClassName}
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listboxId : undefined}
          aria-activedescendant={activeOptionId}
        />
      </label>
      {expanded ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          {loading ? (
            <p className="px-3 py-2 text-xs font-normal text-slate-500">
              Загружаем города из справочника платформы…
            </p>
          ) : visibleError ? (
            <div className="px-3 py-2">
              <p className="text-xs font-normal text-red-700">{visibleError}</p>
              <Link
                href="/settings/platform-directories/cities"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-xs font-medium text-blue-700 hover:underline"
              >
                Открыть справочник городов
              </Link>
            </div>
          ) : visibleSuggestions.length ? (
            visibleSuggestions.map((city, index) => {
              const optionId = `${listboxId}-option-${index}`;
              const active =
                index === Math.min(activeIndex, visibleSuggestions.length - 1);
              return (
                <button
                  id={optionId}
                  key={city}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(city)}
                  className={`block w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm font-normal ${active ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"}`}
                >
                  {city}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2">
              <p className="text-xs font-normal text-slate-500">
                Совпадений нет. Можно сохранить введённое значение.
              </p>
              <Link
                href="/settings/platform-directories/cities"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-xs font-medium text-blue-700 hover:underline"
              >
                Открыть справочник городов
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
