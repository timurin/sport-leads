import Link from "next/link";

import { PageContent } from "@/components/layout/page-layout";
import { PageHeader } from "@/components/ui/page-header";
import {
  getNomenclatureCategories,
  type NomenclatureCategory,
} from "@/lib/nomenclature";

function categoryPath(
  category: NomenclatureCategory,
  byId: Map<number, NomenclatureCategory>,
): string {
  const parts: string[] = [category.name];
  let parentId = category.parent_id;

  while (parentId != null) {
    const parent = byId.get(parentId);
    if (!parent) {
      break;
    }
    parts.unshift(parent.name);
    parentId = parent.parent_id;
  }

  return parts.join(" / ");
}

export default async function NomenclatureCategoriesPage() {
  const categories = await getNomenclatureCategories();
  const byId = new Map(categories.map((category) => [category.id, category]));
  const rows = [...categories].sort((left, right) => {
    const pathCompare = categoryPath(left, byId).localeCompare(
      categoryPath(right, byId),
      "ru",
    );
    if (pathCompare !== 0) {
      return pathCompare;
    }
    return left.sort_order - right.sort_order;
  });

  return (
    <div>
      <PageHeader
        title="Категории номенклатуры"
        description="Иерархия категорий для классификации номенклатуры"
      />
      <PageContent>
        <div className="overflow-x-auto rounded-xl border border-portal-border bg-portal-surface shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-portal-surface-secondary text-portal-muted">
              <tr>
                <th className="px-4 py-3">Код</th>
                <th className="px-4 py-3">Путь</th>
                <th className="px-4 py-3">Тип</th>
                <th className="px-4 py-3">Порядок</th>
                <th className="px-4 py-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-portal-muted"
                  >
                    Категории пока не созданы. Создайте их в рабочем месте
                    номенклатуры.
                  </td>
                </tr>
              ) : (
                rows.map((category) => (
                  <tr key={category.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{category.code}</td>
                    <td className="px-4 py-3">
                      {categoryPath(category, byId)}
                    </td>
                    <td className="px-4 py-3">{category.nomenclature_type}</td>
                    <td className="px-4 py-3">{category.sort_order}</td>
                    <td className="px-4 py-3">
                      {category.is_active ? "Активна" : "Отключена"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-portal-muted">
          Редактирование дерева категорий выполняется в{" "}
          <Link
            href="/settings/catalogs/nomenclature"
            className="font-semibold text-blue-700 hover:underline"
          >
            рабочем месте номенклатуры
          </Link>
          .
        </p>
      </PageContent>
    </div>
  );
}
