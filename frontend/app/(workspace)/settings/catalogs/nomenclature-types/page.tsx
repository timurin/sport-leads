import { PageContent } from "@/components/layout/page-layout";
import type { NomenclatureType } from "@/lib/nomenclature";

const NOMENCLATURE_TYPES: Array<{
  code: NomenclatureType;
  title: string;
  description: string;
}> = [
  {
    code: "PRODUCT",
    title: "Продукция",
    description: "Готовые изделия собственного производства",
  },
  {
    code: "GOODS",
    title: "Товары",
    description: "Покупные товары для перепродажи",
  },
  {
    code: "MATERIAL",
    title: "Материалы",
    description: "Сырьё и комплектующие",
  },
  {
    code: "SERVICE",
    title: "Услуги",
    description: "Работы и услуги без физического остатка",
  },
];

export default function NomenclatureTypesPage() {
  return (
    <div>
      <PageContent>
        <div className="overflow-x-auto rounded-xl border border-portal-border bg-portal-surface shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-portal-surface-secondary text-portal-muted">
              <tr>
                <th className="px-4 py-3">Код</th>
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Описание</th>
              </tr>
            </thead>
            <tbody>
              {NOMENCLATURE_TYPES.map((type) => (
                <tr key={type.code} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{type.code}</td>
                  <td className="px-4 py-3">{type.title}</td>
                  <td className="px-4 py-3 text-portal-muted">
                    {type.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageContent>
    </div>
  );
}
