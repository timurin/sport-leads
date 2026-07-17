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
    primary: "bg-portal-primary text-white hover:bg-blue-700",
    secondary: "border border-portal-border bg-portal-surface text-slate-700 hover:bg-portal-surface-secondary",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  const sizeClasses = {
    compact: "h-8 gap-1.5 rounded-md px-3 text-xs",
    default: "h-10 gap-2 rounded-lg px-4 text-sm",
    spacious: "h-11 gap-2 rounded-lg px-5 text-sm",
  }[size];

  return (
    <button
      {...props}
      className={[
        "inline-flex shrink-0 items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        sizeClasses,
        variantClasses,
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
