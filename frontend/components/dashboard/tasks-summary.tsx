import type { DashboardSnapshot } from "@/lib/dashboard/sales-dashboard-types";
import { SectionCard } from "./section-card";

export function TasksSummary({ tasks }: { tasks: DashboardSnapshot["tasks"] }) {
  return <SectionCard title="Задачи"><div className="grid grid-cols-2 gap-3 text-center"><div className="rounded-xl bg-blue-50 p-3"><b className="text-xl text-blue-700">{tasks.today}</b><p className="text-xs text-blue-700">Сегодня</p></div><div className="rounded-xl bg-red-50 p-3"><b className="text-xl text-red-700">{tasks.overdue}</b><p className="text-xs text-red-700">Просрочено</p></div><div className="rounded-xl bg-amber-50 p-3"><b className="text-xl text-amber-700">{tasks.upcoming}</b><p className="text-xs text-amber-700">Ближайшие</p></div><div className="rounded-xl bg-emerald-50 p-3"><b className="text-xl text-emerald-700">{tasks.completed}</b><p className="text-xs text-emerald-700">Выполнено</p></div></div><div className="mt-5 space-y-2">{tasks.byResponsible.map((item) => <div key={item.name} className="flex justify-between text-sm"><span className="text-slate-600">{item.name}</span><b className="text-slate-800">{item.count}</b></div>)}</div></SectionCard>;
}
