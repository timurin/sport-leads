"use client";

import { updateUnitOfMeasure } from "@/app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions";
import { NomenclatureSectionCreateHost } from "@/components/settings/nomenclature-section-create-host";
import type { UnitCategory, UnitOfMeasure } from "@/lib/nomenclature";

const labels: Record<UnitCategory, string> = {
  QUANTITY: "Количество",
  LENGTH: "Длина",
  AREA: "Площадь",
  MASS: "Масса",
  TIME: "Время",
  SERVICE: "Услуга",
};

export function UnitsOfMeasureWorkspace({ units }: { units: UnitOfMeasure[] }) {
  return (
    <NomenclatureSectionCreateHost>
      <div className="space-y-6 p-6">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">Код</th>
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Обозначение</th>
                <th className="px-4 py-3">Категория</th>
                <th className="px-4 py-3">Точность</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Действие</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{unit.code}</td>
                  <td className="px-4 py-3">{unit.name}</td>
                  <td className="px-4 py-3">{unit.symbol}</td>
                  <td className="px-4 py-3">{labels[unit.unit_category]}</td>
                  <td className="px-4 py-3">{unit.precision}</td>
                  <td className="px-4 py-3">{unit.is_active ? "Активна" : "Отключена"}</td>
                  <td className="px-4 py-3">
                    <form action={updateUnitOfMeasure}>
                      <input type="hidden" name="id" value={unit.id} />
                      <input type="hidden" name="is_active" value={String(!unit.is_active)} />
                      <button
                        type="submit"
                        disabled={unit.is_system}
                        className="text-xs font-semibold text-blue-700 disabled:text-slate-400"
                      >
                        {unit.is_system ? "Системная" : unit.is_active ? "Отключить" : "Активировать"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </NomenclatureSectionCreateHost>
  );
}
