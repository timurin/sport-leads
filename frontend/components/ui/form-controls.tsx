import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import {
  checkboxClassName,
  controlClassName,
  helpClassName,
  labelClassName,
  textareaClassName,
  type ControlSize,
} from "@/lib/design-system/control-styles";

type FieldProps = {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  help?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Label + control + help/error stack (`DS-FORM-01`). */
export function Field({
  label,
  htmlFor,
  required,
  help,
  error,
  children,
  className = "",
}: FieldProps) {
  return (
    <div data-form-field className={className || undefined}>
      <label htmlFor={htmlFor} className={labelClassName()}>
        {label}
        {required ? (
          <span className="text-portal-danger" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className={helpClassName(true)} role="alert">
          {error}
        </p>
      ) : help ? (
        <p className={helpClassName(false)}>{help}</p>
      ) : null}
    </div>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: ControlSize;
  invalid?: boolean;
};

export function Input({
  className = "",
  size = "default",
  invalid = false,
  readOnly,
  type = "text",
  ...props
}: InputProps) {
  return (
    <input
      {...props}
      type={type}
      readOnly={readOnly}
      aria-invalid={invalid || undefined}
      data-form-control="input"
      className={controlClassName({ size, invalid, readOnly, className })}
    />
  );
}

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> & {
  size?: ControlSize;
  invalid?: boolean;
};

export function Textarea({
  className = "",
  size = "default",
  invalid = false,
  readOnly,
  ...props
}: TextareaProps) {
  return (
    <textarea
      {...props}
      readOnly={readOnly}
      aria-invalid={invalid || undefined}
      data-form-control="textarea"
      className={textareaClassName({ size, invalid, readOnly, className })}
    />
  );
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  size?: ControlSize;
  invalid?: boolean;
};

export function Select({
  className = "",
  size = "default",
  invalid = false,
  children,
  ...props
}: SelectProps) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      data-form-control="select"
      className={controlClassName({ size, invalid, className })}
    >
      {children}
    </select>
  );
}

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  label?: ReactNode;
};

export function Checkbox({
  className = "",
  label,
  id,
  ...props
}: CheckboxProps) {
  const control = (
    <input
      {...props}
      id={id}
      type="checkbox"
      data-form-control="checkbox"
      className={checkboxClassName(className)}
    />
  );

  if (!label) {
    return control;
  }

  return (
    <label
      htmlFor={id}
      className="inline-flex items-center gap-portal-2 text-portal-body text-portal-text"
    >
      {control}
      <span>{label}</span>
    </label>
  );
}

type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  label?: ReactNode;
};

export function Radio({
  className = "",
  label,
  id,
  ...props
}: RadioProps) {
  const control = (
    <input
      {...props}
      id={id}
      type="radio"
      data-form-control="radio"
      className={checkboxClassName(`rounded-portal-full ${className}`)}
    />
  );

  if (!label) {
    return control;
  }

  return (
    <label
      htmlFor={id}
      className="inline-flex items-center gap-portal-2 text-portal-body text-portal-text"
    >
      {control}
      <span>{label}</span>
    </label>
  );
}

type SwitchProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size" | "children"
> & {
  label?: ReactNode;
};

/** Accessible switch built on a checkbox (native form-compatible). */
export function Switch({
  className = "",
  label,
  id,
  ...props
}: SwitchProps) {
  return (
    <label
      htmlFor={id}
      className="inline-flex items-center gap-portal-2 text-portal-body text-portal-text"
    >
      <span className="relative inline-flex">
        <input
          {...props}
          id={id}
          type="checkbox"
          data-form-control="switch"
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={[
            "portal-focus-ring relative inline-flex h-6 w-11 shrink-0 rounded-portal-full border",
            "border-portal-border bg-portal-surface-secondary transition-colors",
            "peer-checked:border-portal-primary peer-checked:bg-portal-primary",
            "peer-checked:[&>span]:translate-x-5",
            "peer-disabled:cursor-not-allowed peer-disabled:opacity-[var(--portal-state-disabled-opacity)]",
            className,
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 left-0.5 size-5 rounded-portal-full bg-portal-surface shadow-portal-sm",
              "translate-x-0 transition-transform duration-[var(--portal-motion-normal)]",
            ].join(" ")}
          />
        </span>
      </span>
      {label ? <span>{label}</span> : null}
    </label>
  );
}

type DateInputProps = Omit<InputProps, "type">;

export function DateInput(props: DateInputProps) {
  return <Input {...props} type="date" data-form-control="date" />;
}

type MoneyInputProps = {
  name?: string;
  currencyName?: string;
  defaultValue?: string | number;
  defaultCurrency?: string;
  currencyOptions?: string[];
  min?: string | number;
  step?: string | number;
  required?: boolean;
  size?: ControlSize;
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
};

/** Number amount + currency select/text (`5.4.1.4`). */
export function MoneyInput({
  name = "amount",
  currencyName = "currency",
  defaultValue = "0",
  defaultCurrency = "RUB",
  currencyOptions,
  min = 0,
  step = "0.01",
  required,
  size = "default",
  invalid,
  disabled,
  readOnly,
  className = "",
}: MoneyInputProps) {
  return (
    <div
      data-form-control="money"
      className={`grid min-w-0 grid-cols-[minmax(0,1fr)_5.5rem] gap-portal-2 ${className}`}
    >
      <Input
        name={name}
        type="number"
        min={min}
        step={step}
        defaultValue={defaultValue}
        required={required}
        size={size}
        invalid={invalid}
        disabled={disabled}
        readOnly={readOnly}
      />
      {currencyOptions && currencyOptions.length > 0 ? (
        <Select
          name={currencyName}
          defaultValue={defaultCurrency}
          size={size}
          invalid={invalid}
          disabled={disabled}
        >
          {currencyOptions.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          name={currencyName}
          defaultValue={defaultCurrency}
          maxLength={3}
          size={size}
          invalid={invalid}
          disabled={disabled}
          readOnly={readOnly}
          aria-label="Валюта"
        />
      )}
    </div>
  );
}
