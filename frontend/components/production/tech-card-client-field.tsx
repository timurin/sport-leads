"use client";

import { useEffect, useId, useMemo, useState } from "react";

import {
  listTechnicalCardClientCandidates,
  type TechnicalCardClientCandidate,
} from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { ClientCreateDrawer } from "@/components/sales/client-create-drawer";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-controls";
import { controlClassName } from "@/lib/design-system/control-styles";
import { clientCreateAllowed } from "@/lib/production/tech-card-client-binding";

type TechCardClientFieldProps = {
  clientId: number | null;
  label: string;
  disabled?: boolean;
  scopeMessage?: string | null;
  confirmRequired?: boolean;
  confirmed?: boolean;
  onConfirmedChange?: (value: boolean) => void;
  onChange: (clientId: number | null, label: string) => void;
};

export function TechCardClientField({
  clientId,
  label,
  disabled = false,
  scopeMessage = null,
  confirmRequired = false,
  confirmed = false,
  onConfirmedChange,
  onChange,
}: TechCardClientFieldProps) {
  const listboxId = useId();
  const [candidates, setCandidates] = useState<TechnicalCardClientCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [createAllowed, setCreateAllowed] = useState(true);
  const expanded = open && !disabled && !createOpen;

  const options = useMemo(() => {
    const byId = new Map<number, TechnicalCardClientCandidate>();
    for (const row of candidates) byId.set(row.id, row);
    if (clientId != null && !byId.has(clientId) && label.trim()) {
      byId.set(clientId, { id: clientId, label: label.trim() });
    }
    return [...byId.values()];
  }, [candidates, clientId, label]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void (async () => {
        const result = await listTechnicalCardClientCandidates(label);
        if (!result.ok) {
          setListError(result.message);
          setCreateAllowed(clientCreateAllowed(result.status));
          return;
        }
        setListError(null);
        setCreateAllowed(true);
        setCandidates(result.candidates);
      })();
    }, 200);
    return () => window.clearTimeout(handle);
  }, [label]);

  const selectClient = (row: TechnicalCardClientCandidate) => {
    onChange(row.id, row.label);
    setOpen(false);
  };

  const openCreate = () => {
    setOpen(false);
    setCreateOpen(true);
  };

  return (
    <Field label="Контрагент" htmlFor="tech-card-client">
      <div className="relative">
        <input
          id="tech-card-client"
          type="text"
          role="combobox"
          autoComplete="off"
          value={label}
          disabled={disabled}
          placeholder="Начните ввод — выберите или создайте"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listboxId : undefined}
          data-tech-card-client-combobox
          className={controlClassName()}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next.trim() === label.trim() ? clientId : null, next);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              return;
            }
            if (!expanded || options.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => (index + 1) % options.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => (index - 1 + options.length) % options.length);
            } else if (event.key === "Enter") {
              event.preventDefault();
              const pick = options[Math.min(activeIndex, options.length - 1)];
              if (pick) selectClient(pick);
            }
          }}
        />
        {expanded ? (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-portal-border bg-portal-surface p-1 shadow-lg"
          >
            {options.length > 0 ? (
              options.map((item, index) => {
                const active = index === Math.min(activeIndex, options.length - 1);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectClient(item)}
                    className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
                      active
                        ? "bg-portal-surface-secondary text-portal-primary"
                        : "text-portal-text hover:bg-portal-surface-secondary"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-sm text-portal-muted">Совпадений нет</div>
            )}
            {createAllowed ? (
              <button
                type="button"
                data-tech-card-client-create
                className="mt-1 block w-full rounded-md px-3 py-2 text-left text-sm text-portal-primary hover:bg-portal-surface-secondary"
                onMouseDown={(event) => event.preventDefault()}
                onClick={openCreate}
              >
                Создать контрагента
                {label.trim() && clientId == null ? ` «${label.trim()}»` : ""}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {listError ? (
        <p className="mt-portal-2 text-portal-caption text-portal-danger" role="alert">
          {listError}
        </p>
      ) : null}
      {createAllowed && clientId == null && label.trim() ? (
        <div className="mt-portal-2">
          <Button
            type="button"
            size="compact"
            variant="secondary"
            data-tech-card-client-create
            disabled={disabled}
            onClick={openCreate}
          >
            Создать контрагента
          </Button>
        </div>
      ) : null}
      {scopeMessage ? (
        <p className="mt-portal-2 text-portal-caption text-portal-muted" data-tech-card-client-scope>
          {scopeMessage}
        </p>
      ) : null}
      {confirmRequired ? (
        <label className="mt-portal-2 flex items-start gap-2 text-portal-caption text-portal-text">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={confirmed}
            disabled={disabled}
            data-tech-card-client-share-confirm
            onChange={(event) => onConfirmedChange?.(event.target.checked)}
          />
          Подтверждаю смену контрагента у связанных техкарт
        </label>
      ) : null}
      <ClientCreateDrawer
        open={createOpen}
        elevated
        title="Создать контрагента"
        initialContactName={clientId == null ? label : ""}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          setCandidates((rows) => {
            const next = rows.filter((row) => row.id !== created.id);
            return [{ id: created.id, label: created.label }, ...next];
          });
          onChange(created.id, created.label);
        }}
      />
    </Field>
  );
}
