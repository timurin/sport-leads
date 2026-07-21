import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

type ButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "compact" | "default" | "spacious";
  };

export function Button({
  children,
  className = "",
  variant = "secondary",
  size = "default",
  ...props
}: ButtonProps) {
  const variantClasses = {
    primary:
      "bg-portal-primary text-portal-primary-on hover:bg-portal-primary-hover active:bg-portal-primary-hover",
    secondary:
      "border border-portal-border bg-portal-surface text-portal-text hover:bg-portal-state-hover active:bg-portal-state-pressed",
    ghost:
      "text-portal-muted hover:bg-portal-primary-soft hover:text-portal-text active:bg-portal-state-pressed",
    danger:
      "bg-portal-danger text-portal-primary-on hover:bg-portal-danger-hover active:bg-portal-danger-hover",
  }[variant];
  const sizeClasses = {
    compact:
      "h-portal-control-compact gap-portal-1 rounded-portal-sm px-portal-3 text-portal-caption",
    default:
      "h-portal-control-default gap-portal-2 rounded-portal-md px-portal-4 text-portal-body",
    spacious:
      "h-portal-control-spacious gap-portal-2 rounded-portal-md px-portal-5 text-portal-body",
  }[size];

  return (
    <button
      {...props}
      className={[
        "portal-focus-ring inline-flex shrink-0 items-center justify-center font-medium",
        "transition-colors duration-[var(--portal-motion-normal)] ease-[var(--portal-motion-ease)]",
        "disabled:cursor-not-allowed disabled:opacity-[var(--portal-state-disabled-opacity)]",
        "disabled:pointer-events-none",
        sizeClasses,
        variantClasses,
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
