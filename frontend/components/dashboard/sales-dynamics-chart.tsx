import { SectionCard } from "./section-card";
import type { DynamicsPoint } from "@/lib/dashboard/sales-dashboard-types";

const series = [
  { key: "leads", label: "Лиды", color: "#2563eb" },
  { key: "deals", label: "Сделки", color: "#7c3aed" },
  { key: "orders", label: "Заказы", color: "#059669" },
] as const;

export function SalesDynamicsChart({ points }: { points: DynamicsPoint[] }) {
  const maximum = Math.max(1, ...points.flatMap((point) => [point.leads, point.deals, point.orders]));
  const width = 720;
  const height = 240;
  const x = (index: number) => points.length <= 1 ? width / 2 : 24 + (index / (points.length - 1)) * (width - 48);
  const y = (value: number) => height - 30 - (value / maximum) * (height - 60);

  return (
    <SectionCard title="Динамика" description="Лиды, сделки и заказы по выбранному периоду" className="xl:col-span-2">
      {points.length ? (
        <>
          <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-600">
            {series.map((item) => <span key={item.key} className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>)}
          </div>
          <div className="w-full overflow-hidden">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto min-h-[220px] w-full" role="img" aria-label="График динамики продаж">
              {[0, 1, 2, 3].map((line) => <line key={line} x1="24" x2={width - 24} y1={30 + line * 50} y2={30 + line * 50} stroke="#e2e8f0" strokeWidth="1" />)}
              {series.map((item) => (
                <polyline key={item.key} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points.map((point, index) => `${x(index)},${y(point[item.key])}`).join(" ")} />
              ))}
              {points.map((point, index) => index % Math.max(1, Math.ceil(points.length / 8)) === 0 ? <text key={`${point.label}-${index}`} x={x(index)} y={height - 8} textAnchor="middle" fontSize="10" fill="#64748b">{point.label}</text> : null)}
            </svg>
          </div>
          <p className="mt-2 text-sm text-slate-500">Сумма заказов: {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(points.reduce((total, point) => total + point.orderAmount, 0))}</p>
        </>
      ) : <div className="py-16 text-center text-sm text-slate-500">Нет данных для построения динамики</div>}
    </SectionCard>
  );
}
