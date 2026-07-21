"use client";

import { useId, useMemo, useState } from "react";

import { getCitySuggestions } from "@/lib/city-suggestions";

type CityAutocompleteProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
};

const defaultInputClass =
  "mt-1 h-portal-control-default w-full rounded-portal-md border border-portal-border bg-portal-surface px-portal-3 text-portal-body text-portal-text placeholder:text-portal-subtle outline-none transition focus:border-portal-primary focus:ring-2 focus:ring-portal-primary-soft";

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
  const suggestions = useMemo(() => getCitySuggestions(value), [value]);
  const canSuggest = value.trim().length >= 2;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

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
      setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(suggestions[Math.min(activeIndex, suggestions.length - 1)]);
    }
  }

  const expanded = open && canSuggest;
  const activeOptionId = expanded && suggestions.length
    ? `${listboxId}-option-${Math.min(activeIndex, suggestions.length - 1)}`
    : undefined;

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
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
        <div id={listboxId} role="listbox" className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {suggestions.length ? suggestions.map((city, index) => {
            const optionId = `${listboxId}-option-${index}`;
            const active = index === Math.min(activeIndex, suggestions.length - 1);
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
          }) : (
            <p className="px-3 py-2 text-xs font-normal text-slate-500">
              Совпадений нет. Можно сохранить введённое значение.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
