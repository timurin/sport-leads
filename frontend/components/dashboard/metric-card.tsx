import type { LucideIcon } from "lucide-react";

type MetricCardProps = {
  title: string;
  value: string;
  description: string;
  trend?: string;
  icon: LucideIcon;
};

export function MetricCard({
  title,
  value,
  description,
  trend,
  icon: Icon,
}: MetricCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-slate-500">
            {title}
          </div>

          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {value}
          </div>
        </div>

        <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
          <Icon size={20} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm">
        {trend ? (
          <span className="font-medium text-emerald-600">
            {trend}
          </span>
        ) : null}

        <span className="text-slate-500">
          {description}
        </span>
      </div>
    </article>
  );
}