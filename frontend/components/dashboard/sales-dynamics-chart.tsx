"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  dynamicsSeriesTotals,
  niceAxisMax,
} from "@/lib/dashboard/sales-dynamics-scale";
import type { DynamicsPoint } from "@/lib/dashboard/sales-dashboard-types";

const SERIES = [
  { key: "leads", label: "Лиды", color: "#8A56E2" },
  { key: "deals", label: "Сделки", color: "#D84080" },
  { key: "orders", label: "Заказы", color: "#36B3A4" },
] as const;

const countFormat = new Intl.NumberFormat("ru-RU");
const moneyFormat = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function lastDot(color: string, lastIndex: number) {
  return function LastDot({
    cx,
    cy,
    index,
  }: {
    cx?: number;
    cy?: number;
    index?: number;
  }) {
    if (index !== lastIndex || cx == null || cy == null) return null;
    return <circle cx={cx} cy={cy} r={3.5} fill={color} />;
  };
}

export function SalesDynamicsChart({ points }: { points: DynamicsPoint[] }) {
  const totals = dynamicsSeriesTotals(points);
  const axisMax = niceAxisMax(
    Math.max(0, ...points.flatMap((point) => [point.leads, point.deals, point.orders])),
  );
  const lastIndex = Math.max(0, points.length - 1);
  const data = points.map((point, index) => ({ ...point, x: index }));
  const labelStep = Math.max(1, Math.ceil(points.length / 8));
  const xTicks = data.filter((_, index) => index % labelStep === 0).map((point) => point.x);
  const bandStep = Math.max(7, Math.ceil(points.length / 4));
  const bands = Array.from({ length: Math.ceil(points.length / bandStep) }, (_, band) => ({
    x1: band * bandStep,
    x2: Math.min(lastIndex, (band + 1) * bandStep),
    odd: band % 2 === 1,
  })).filter((band) => band.odd && band.x2 > band.x1);

  return (
    <SectionCard title="Динамика" size="compact">
      {points.length ? (
        <div className="min-w-0">
          <div className="h-[168px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={168}>
              <LineChart
                data={data}
                margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
                aria-label="График динамики продаж"
              >
                {bands.map((band) => (
                  <ReferenceArea
                    key={`band-${band.x1}`}
                    x1={band.x1}
                    x2={band.x2}
                    y1={0}
                    y2={axisMax}
                    fill="rgba(15, 23, 42, 0.035)"
                    ifOverflow="hidden"
                  />
                ))}
                <CartesianGrid
                  vertical={false}
                  stroke="rgba(15, 23, 42, 0.08)"
                  strokeDasharray="0"
                />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={[0, lastIndex]}
                  ticks={xTicks}
                  tickFormatter={(value) => data[Number(value)]?.label ?? ""}
                  tick={{ fill: "var(--portal-text-muted)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <YAxis
                  domain={[0, axisMax]}
                  ticks={[axisMax, axisMax / 2, 0]}
                  tickFormatter={(value) => countFormat.format(Number(value))}
                  tick={{ fill: "var(--portal-text-muted)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(15, 23, 42, 0.12)" }}
                  formatter={(value, name) => [
                    countFormat.format(Number(value ?? 0)),
                    String(name),
                  ]}
                  labelFormatter={(value) => data[Number(value)]?.label ?? ""}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--portal-border)",
                    background: "var(--portal-surface)",
                    fontSize: 12,
                  }}
                />
                {SERIES.map((item) => (
                  <Line
                    key={item.key}
                    type="linear"
                    dataKey={item.key}
                    name={item.label}
                    stroke={item.color}
                    strokeWidth={2}
                    dot={lastDot(item.color, lastIndex)}
                    activeDot={{ r: 4, fill: item.color, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-portal-caption">
            {SERIES.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-2 text-portal-text">
                <i
                  className="size-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-portal-muted">{item.label}</span>
                <span className="font-medium tabular-nums">
                  {countFormat.format(totals[item.key])}
                </span>
              </span>
            ))}
            <span className="text-portal-muted">
              Сумма заказов:{" "}
              <span className="font-medium text-portal-text tabular-nums">
                {moneyFormat.format(totals.orderAmount)}
              </span>
            </span>
          </div>
        </div>
      ) : (
        <EmptyState title="Нет данных для построения динамики" size="compact" />
      )}
    </SectionCard>
  );
}
