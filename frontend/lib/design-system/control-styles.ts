/**
 * Shared form control class builders (Stage 5.4.1 / DS-FORM-01).
 * Keep visual tokens here so Input/Select/Textarea stay in sync.
 */

export type ControlSize = "compact" | "default" | "spacious";

type ControlClassOptions = {
  size?: ControlSize;
  invalid?: boolean;
  readOnly?: boolean;
  className?: string;
};

const SIZE_CLASSES: Record<ControlSize, string> = {
  compact: "h-portal-control-compact px-portal-2 text-portal-dense",
  default: "h-portal-control-default px-portal-3 text-portal-body",
  spacious: "h-portal-control-spacious px-portal-4 text-portal-body",
};

/** Single-line controls: text, number, date, select. */
export function controlClassName({
  size = "default",
  invalid = false,
  readOnly = false,
  className = "",
}: ControlClassOptions = {}): string {
  return [
    "portal-focus-ring w-full min-w-0 rounded-portal-md border bg-portal-surface text-portal-text",
    "placeholder:text-portal-text-subtle outline-none transition-colors",
    "duration-[var(--portal-motion-normal)] ease-[var(--portal-motion-ease)]",
    "border-portal-border focus:border-portal-primary",
    "disabled:cursor-not-allowed disabled:bg-portal-surface-secondary",
    "disabled:opacity-[var(--portal-state-disabled-opacity)] disabled:pointer-events-none",
    readOnly ? "bg-portal-surface-secondary text-portal-muted" : null,
    invalid ? "border-portal-danger focus:border-portal-danger" : null,
    SIZE_CLASSES[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Multiline textarea — same chrome, auto height. */
export function textareaClassName({
  size = "default",
  invalid = false,
  readOnly = false,
  className = "",
}: ControlClassOptions = {}): string {
  const pad =
    size === "compact"
      ? "px-portal-2 py-portal-2 text-portal-dense"
      : size === "spacious"
        ? "px-portal-4 py-portal-3 text-portal-body"
        : "px-portal-3 py-portal-2 text-portal-body";

  return controlClassName({
    size,
    invalid,
    readOnly,
    className: `h-auto min-h-[4.5rem] ${pad} ${className}`.trim(),
  });
}

export function labelClassName(className = ""): string {
  return [
    "mb-portal-2 block text-portal-body font-medium text-portal-text",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function helpClassName(invalid = false): string {
  return invalid
    ? "mt-portal-1 text-portal-meta text-portal-danger"
    : "mt-portal-1 text-portal-meta text-portal-muted";
}

export function checkboxClassName(className = ""): string {
  return [
    "portal-focus-ring size-4 shrink-0 rounded-portal-sm border border-portal-border",
    "text-portal-primary accent-[var(--portal-primary)]",
    "disabled:cursor-not-allowed disabled:opacity-[var(--portal-state-disabled-opacity)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function switchClassName(checked: boolean, className = ""): string {
  return [
    "portal-focus-ring relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-portal-full border",
    "transition-colors duration-[var(--portal-motion-normal)]",
    checked
      ? "border-portal-primary bg-portal-primary"
      : "border-portal-border bg-portal-surface-secondary",
    "disabled:cursor-not-allowed disabled:opacity-[var(--portal-state-disabled-opacity)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}
