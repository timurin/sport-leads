import type { RecentActivity as Activity } from "@/lib/dashboard/sales-dashboard-types";
import { SectionCard } from "./section-card";

const dots = { blue: "bg-blue-500", emerald: "bg-emerald-500", amber: "bg-amber-500", slate: "bg-slate-400" };

export function RecentActivity({ activity }: { activity: Activity[] }) {
  const formatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return <SectionCard title="Последние события" description="Единая лента CRM-активности" className="xl:col-span-2">{activity.length ? <div className="grid gap-x-8 md:grid-cols-2">{activity.map((item) => <article key={item.id} className="flex gap-3 border-b border-slate-100 py-3"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dots[item.tone]}`} /><div className="min-w-0"><div className="text-sm font-medium text-slate-800">{item.title}</div><div className="truncate text-sm text-slate-500">{item.description}</div><time className="text-xs text-slate-400">{formatter.format(new Date(item.occurredAt))}</time></div></article>)}</div> : <div className="py-10 text-center text-sm text-slate-500">Событий за период нет</div>}</SectionCard>;
}
