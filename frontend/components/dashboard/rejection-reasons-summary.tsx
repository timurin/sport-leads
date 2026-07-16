import { SectionCard } from "./section-card";

export function RejectionReasonsSummary({ reasons }: { reasons: Array<{ reason: string; count: number }> }) {
  const maximum = Math.max(1, ...reasons.map((item) => item.count));
  return (
    <SectionCard title="Причины отказов" description="Реальные результаты завершённых лидов">
      {reasons.length ? <div className="space-y-3">{reasons.map((item) => <div key={item.reason}><div className="flex justify-between text-sm"><span className="text-slate-600">{item.reason}</span><strong>{item.count}</strong></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-red-400" style={{ width: `${item.count / maximum * 100}%` }} /></div></div>)}</div> : <p className="text-sm text-slate-500">За выбранный период отказов нет.</p>}
    </SectionCard>
  );
}
