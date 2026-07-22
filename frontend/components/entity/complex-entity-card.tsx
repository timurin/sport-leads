import type { ReactNode } from "react";

type ComplexEntityCardProps = {
  children: ReactNode;
  className?: string;
};

/**
 * PT-06 complex entity card body frame (`DS-PT-06`).
 * Header (stage rail / domain chrome) stays a sibling above `PageContent`.
 */
export function ComplexEntityCard({
  children,
  className = "",
}: ComplexEntityCardProps) {
  return (
    <div
      data-complex-entity-card
      className={["min-w-0", className].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}
