"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { controlClassName } from "@/lib/design-system/control-styles";

export type CreatableTagOption = {
  id: number;
  name: string;
};

export type CreatableTagValue = {
  /** Catalog id when known; null for create-on-save names. */
  id: number | null;
  name: string;
};

function normalize(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function sameName(a: string, b: string): boolean {
  return a.toLocaleLowerCase("ru") === b.toLocaleLowerCase("ru");
}

/**
 * WooCommerce-style tags input: chips + typeahead + create-on-miss.
 * Creating is local until the parent persists (e.g. model Materials save).
 */
export function CreatableTagsInput({
  values,
  options,
  onChange,
  disabled = false,
  placeholder = "Начните ввод…",
  "aria-label": ariaLabel = "Метки",
}: {
  values: CreatableTagValue[];
  options: CreatableTagOption[];
  onChange: (next: CreatableTagValue[]) => void;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedKeys = useMemo(
    () => new Set(values.map((row) => row.name.toLocaleLowerCase("ru"))),
    [values],
  );

  const suggestions = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru");
    return options
      .filter((row) => !selectedKeys.has(row.name.toLocaleLowerCase("ru")))
      .filter((row) =>
        needle ? row.name.toLocaleLowerCase("ru").includes(needle) : true,
      )
      .slice(0, 8);
  }, [options, query, selectedKeys]);

  const canCreate = useMemo(() => {
    const name = normalize(query);
    if (!name) return false;
    if (selectedKeys.has(name.toLocaleLowerCase("ru"))) return false;
    return !options.some((row) => sameName(row.name, name));
  }, [options, query, selectedKeys]);

  const menuItems = useMemo(() => {
    const items: Array<
      | { kind: "option"; option: CreatableTagOption }
      | { kind: "create"; name: string }
    > = suggestions.map((option) => ({ kind: "option" as const, option }));
    if (canCreate) {
      items.push({ kind: "create", name: normalize(query) });
    }
    return items;
  }, [canCreate, query, suggestions]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const addTag = (tag: CreatableTagValue) => {
    const name = normalize(tag.name);
    if (!name) return;
    if (values.some((row) => sameName(row.name, name))) {
      setQuery("");
      return;
    }
    const fromCatalog = options.find((row) => sameName(row.name, name));
    onChange([
      ...values,
      fromCatalog
        ? { id: fromCatalog.id, name: fromCatalog.name }
        : { id: tag.id, name },
    ]);
    setQuery("");
    setOpen(true);
    inputRef.current?.focus();
  };

  const removeTag = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
    inputRef.current?.focus();
  };

  const commitQuery = () => {
    const name = normalize(query);
    if (!name) return;
    const fromCatalog = options.find((row) => sameName(row.name, name));
    if (fromCatalog) {
      addTag({ id: fromCatalog.id, name: fromCatalog.name });
      return;
    }
    addTag({ id: null, name });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !query && values.length > 0) {
      event.preventDefault();
      removeTag(values.length - 1);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      if (!open) setOpen(true);
      event.preventDefault();
      setActiveIndex((current) =>
        menuItems.length === 0 ? 0 : (current + 1) % menuItems.length,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      if (!open) setOpen(true);
      event.preventDefault();
      setActiveIndex((current) =>
        menuItems.length === 0
          ? 0
          : (current - 1 + menuItems.length) % menuItems.length,
      );
      return;
    }
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      if (open && menuItems[activeIndex]) {
        const item = menuItems[activeIndex];
        if (item.kind === "option") {
          addTag({ id: item.option.id, name: item.option.name });
        } else {
          addTag({ id: null, name: item.name });
        }
        return;
      }
      commitQuery();
      return;
    }
    if (event.key === "Tab" && query.trim()) {
      event.preventDefault();
      commitQuery();
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-[220px]">
      <div
        className={controlClassName({
          size: "compact",
          className: [
            "flex h-auto min-h-portal-control-compact flex-wrap items-center gap-1 py-1",
            disabled
              ? "pointer-events-none opacity-[var(--portal-state-disabled-opacity)]"
              : "",
          ]
            .filter(Boolean)
            .join(" "),
        })}
        onClick={() => {
          if (!disabled) inputRef.current?.focus();
        }}
      >
        {values.map((tag, index) => (
          <span
            key={`${tag.id ?? "new"}-${tag.name}-${index}`}
            className="inline-flex max-w-full items-center gap-0.5 rounded-portal-sm bg-portal-surface-secondary px-1.5 py-0.5 text-portal-caption text-portal-text"
          >
            <span className="truncate">{tag.name}</span>
            {!disabled ? (
              <button
                type="button"
                aria-label={`Убрать «${tag.name}»`}
                className="inline-flex size-4 items-center justify-center rounded-sm text-portal-muted hover:bg-portal-state-hover hover:text-portal-text"
                onClick={(event) => {
                  event.stopPropagation();
                  removeTag(index);
                }}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            ) : null}
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          role="combobox"
          placeholder={values.length === 0 ? placeholder : ""}
          className="min-w-[8rem] flex-1 border-0 bg-transparent p-0 text-portal-caption text-portal-text outline-none placeholder:text-portal-muted"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            window.setTimeout(() => {
              if (!rootRef.current?.contains(document.activeElement)) {
                if (normalize(query)) commitQuery();
                setOpen(false);
              }
            }, 0);
          }}
        />
      </div>
      {open && !disabled && menuItems.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-portal-md border border-portal-border bg-portal-surface py-1 shadow-md"
        >
          {menuItems.map((item, index) => {
            const active = index === activeIndex;
            if (item.kind === "option") {
              return (
                <li
                  key={`opt-${item.option.id}`}
                  role="option"
                  aria-selected={active}
                >
                  <button
                    type="button"
                    className={[
                      "block w-full px-portal-3 py-1.5 text-left text-portal-caption",
                      active
                        ? "bg-portal-primary-soft text-portal-text"
                        : "text-portal-text hover:bg-portal-state-hover",
                    ].join(" ")}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() =>
                      addTag({ id: item.option.id, name: item.option.name })
                    }
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    {item.option.name}
                  </button>
                </li>
              );
            }
            return (
              <li
                key={`create-${item.name}`}
                role="option"
                aria-selected={active}
              >
                <button
                  type="button"
                  className={[
                    "block w-full px-portal-3 py-1.5 text-left text-portal-caption",
                    active
                      ? "bg-portal-primary-soft text-portal-text"
                      : "text-portal-text hover:bg-portal-state-hover",
                  ].join(" ")}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addTag({ id: null, name: item.name })}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  Создать «{item.name}»
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
