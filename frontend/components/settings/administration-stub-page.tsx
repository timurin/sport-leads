import Link from "next/link";

/** Shared stub for Stage 18 Administration surfaces until domain work ships. */
export function AdministrationStubPage({
  title,
  description,
  roadmapCode,
}: {
  title: string;
  description: string;
  roadmapCode: string;
}) {
  return (
    <div className="space-y-portal-6 p-portal-6">
      <div className="space-y-portal-2">
        <p className="text-portal-caption text-portal-muted">
          <Link
            href="/settings"
            className="text-portal-primary hover:underline"
          >
            Настройки
          </Link>
          {" · "}
          Платформа
        </p>
        <h1 className="text-portal-title font-semibold text-portal-text">
          {title}
        </h1>
        <p className="max-w-2xl text-portal-body text-portal-muted">
          {description}
        </p>
      </div>
      <div className="rounded-portal-md border border-portal-border bg-portal-surface px-portal-4 py-portal-3 text-portal-body text-portal-muted">
        Раздел зарезервирован под Stage {roadmapCode}. Контент появится в
        следующих микрозадачах; навигационный контур уже доступен.
      </div>
    </div>
  );
}
