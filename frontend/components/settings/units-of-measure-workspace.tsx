import { createUnitOfMeasure, updateUnitOfMeasure } from "@/app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions";
import type { UnitCategory, UnitOfMeasure } from "@/lib/nomenclature";

const labels: Record<UnitCategory, string> = { QUANTITY: "Количество", LENGTH: "Длина", AREA: "Площадь", MASS: "Масса", TIME: "Время", SERVICE: "Услуга" };

export function UnitsOfMeasureWorkspace({ units }: { units: UnitOfMeasure[] }) {
  return <div className="space-y-6 p-6">
    <form action={createUnitOfMeasure} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-5">
      <input name="code" required pattern="[A-Z0-9][A-Z0-9_-]*" placeholder="Код" className="rounded border px-3 py-2 text-sm" />
      <input name="name" required placeholder="Полное название" className="rounded border px-3 py-2 text-sm" />
      <input name="symbol" required placeholder="Обозначение" className="rounded border px-3 py-2 text-sm" />
      <select name="unit_category" defaultValue="QUANTITY" className="rounded border px-3 py-2 text-sm">{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <input name="precision" type="number" min="0" max="6" defaultValue="0" className="rounded border px-3 py-2 text-sm" />
      <button type="submit" className="rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white md:col-span-5">Добавить единицу</button>
    </form>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full text-left text-sm"><thead className="border-b bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Код</th><th className="px-4 py-3">Название</th><th className="px-4 py-3">Обозначение</th><th className="px-4 py-3">Категория</th><th className="px-4 py-3">Точность</th><th className="px-4 py-3">Статус</th><th className="px-4 py-3">Действие</th></tr></thead><tbody>{units.map((unit) => <tr key={unit.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{unit.code}</td><td className="px-4 py-3">{unit.name}</td><td className="px-4 py-3">{unit.symbol}</td><td className="px-4 py-3">{labels[unit.unit_category]}</td><td className="px-4 py-3">{unit.precision}</td><td className="px-4 py-3">{unit.is_active ? "Активна" : "Отключена"}</td><td className="px-4 py-3"><form action={updateUnitOfMeasure}><input type="hidden" name="id" value={unit.id} /><input type="hidden" name="is_active" value={String(!unit.is_active)} /><button type="submit" disabled={unit.is_system} className="text-xs font-semibold text-blue-700 disabled:text-slate-400">{unit.is_system ? "Системная" : unit.is_active ? "Отключить" : "Активировать"}</button></form></td></tr>)}</tbody></table></div>
  </div>;
}
