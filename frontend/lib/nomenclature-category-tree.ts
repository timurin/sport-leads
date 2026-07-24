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

/** Self + all descendants — invalid parents when editing `categoryId`. */
export function collectCategoryDescendantIds(
  categories: NomenclatureCategory[],
  categoryId: number,
): Set<number> {
  const childrenByParent = new Map<number, number[]>();
  for (const category of categories) {
    if (category.parent_id == null) continue;
    const bucket = childrenByParent.get(category.parent_id);
    if (bucket) {
      bucket.push(category.id);
    } else {
      childrenByParent.set(category.parent_id, [category.id]);
    }
  }

  const blocked = new Set<number>([categoryId]);
  const stack = [categoryId];
  while (stack.length) {
    const current = stack.pop()!;
    for (const childId of childrenByParent.get(current) ?? []) {
      if (blocked.has(childId)) continue;
      blocked.add(childId);
      stack.push(childId);
    }
  }
  return blocked;
}

export function parentCategoryOptions(
  rows: CategoryTreeRow[],
  excludeCategoryId?: number | null,
  categories?: NomenclatureCategory[],
): CategoryTreeRow[] {
  if (excludeCategoryId == null) {
    return rows;
  }
  const source = categories ?? rows.map((row) => row.category);
  const blocked = collectCategoryDescendantIds(source, excludeCategoryId);
  return rows.filter((row) => !blocked.has(row.category.id));
}

export function nextChildSortOrder(
  categories: NomenclatureCategory[],
  parentId: number | null,
): number {
  const siblings = categories.filter(
    (category) => category.parent_id === parentId,
  );
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((category) => category.sort_order)) + 1;
}

/**
 * After swapping `categoryId` with neighbor in `direction`, return dense
 * `sort_order` 0..n-1 for all siblings under the same parent.
 */
export function planSiblingReorder(
  siblings: NomenclatureCategory[],
  categoryId: number,
  direction: -1 | 1,
): { id: number; sort_order: number }[] | null {
  const sorted = [...siblings].sort(compareSiblings);
  const index = sorted.findIndex((item) => item.id === categoryId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= sorted.length) {
    return null;
  }
  const reordered = [...sorted];
  const swap = reordered[index]!;
  reordered[index] = reordered[nextIndex]!;
  reordered[nextIndex] = swap;
  return reordered.map((item, order) => ({
    id: item.id,
    sort_order: order,
  }));
}

export function canMoveCategorySibling(
  categories: NomenclatureCategory[],
  categoryId: number,
  direction: -1 | 1,
): boolean {
  const target = categories.find((item) => item.id === categoryId);
  if (!target) return false;
  const siblings = categories.filter(
    (item) => item.parent_id === target.parent_id,
  );
  return planSiblingReorder(siblings, categoryId, direction) != null;
}
