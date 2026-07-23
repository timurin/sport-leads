import type { NomenclatureCategory } from "@/lib/nomenclature";

export type CategoryTreeRow = {
  category: NomenclatureCategory;
  depth: number;
  outline: string;
  hasChildren: boolean;
};

function compareSiblings(
  left: NomenclatureCategory,
  right: NomenclatureCategory,
): number {
  if (left.sort_order !== right.sort_order) {
    return left.sort_order - right.sort_order;
  }
  const byName = left.name.localeCompare(right.name, "ru");
  if (byName !== 0) {
    return byName;
  }
  return left.id - right.id;
}

/**
 * Flatten categories into depth-first tree rows with outline numbers
 * (`1`, `1.1`, `1.1.2`, `2`, …) from sibling `sort_order`.
 */
export function buildCategoryTreeRows(
  categories: NomenclatureCategory[],
): CategoryTreeRow[] {
  const byParent = new Map<number | null, NomenclatureCategory[]>();

  for (const category of categories) {
    const key = category.parent_id;
    const bucket = byParent.get(key);
    if (bucket) {
      bucket.push(category);
    } else {
      byParent.set(key, [category]);
    }
  }

  for (const siblings of byParent.values()) {
    siblings.sort(compareSiblings);
  }

  const rows: CategoryTreeRow[] = [];

  const walk = (
    parentId: number | null,
    prefix: number[],
  ): void => {
    const siblings = byParent.get(parentId) ?? [];
    siblings.forEach((category, index) => {
      const outlineParts = [...prefix, index + 1];
      const children = byParent.get(category.id) ?? [];
      rows.push({
        category,
        depth: prefix.length,
        outline: outlineParts.join("."),
        hasChildren: children.length > 0,
      });
      walk(category.id, outlineParts);
    });
  };

  walk(null, []);
  return rows;
}

export function categoryPathFromMap(
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

/** Keep ancestors of matching nodes so the filtered tree stays readable. */
export function filterCategoryTreeRows(
  rows: CategoryTreeRow[],
  query: string,
): CategoryTreeRow[] {
  const normalized = query.trim().toLocaleLowerCase("ru");
  if (!normalized) {
    return rows;
  }

  const byId = new Map(
    rows.map((row) => [row.category.id, row.category] as const),
  );
  const matchIds = new Set<number>();

  for (const row of rows) {
    const path = categoryPathFromMap(row.category, byId).toLocaleLowerCase(
      "ru",
    );
    const haystack = [
      path,
      row.category.code,
      row.outline,
      row.category.name,
    ]
      .join(" ")
      .toLocaleLowerCase("ru");
    if (haystack.includes(normalized)) {
      matchIds.add(row.category.id);
      let parentId = row.category.parent_id;
      while (parentId != null) {
        matchIds.add(parentId);
        parentId = byId.get(parentId)?.parent_id ?? null;
      }
    }
  }

  return rows.filter((row) => matchIds.has(row.category.id));
}
