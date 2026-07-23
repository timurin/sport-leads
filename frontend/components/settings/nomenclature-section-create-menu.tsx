"use client";

import { useMemo } from "react";

import {
  CreateMenu,
  type CreateMenuItem,
} from "@/components/ui/create-menu";

export type NomenclatureCreateKind =
  | "nomenclature"
  | "unit"
  | "category"
  | "characteristic";

export const NOMENCLATURE_CREATE_KINDS: NomenclatureCreateKind[] = [
  "nomenclature",
  "unit",
  "category",
  "characteristic",
];

export function parseNomenclatureCreateKind(
  value: string | null | undefined,
): NomenclatureCreateKind | null {
  if (
    value === "nomenclature" ||
    value === "unit" ||
    value === "category" ||
    value === "characteristic"
  ) {
    return value;
  }
  return null;
}

const SECTION_LABELS: Record<NomenclatureCreateKind, string> = {
  nomenclature: "Номенклатуру",
  unit: "Единицу измерения",
  category: "Категорию",
  characteristic: "Характеристику",
};

const SECTION_DESCRIPTIONS: Record<NomenclatureCreateKind, string> = {
  nomenclature: "Карточка товара, материала, услуги",
  unit: "Базовая единица хранения",
  category: "Группа в дереве номенклатуры",
  characteristic: "Свойство, реквизит или измерение варианта",
};

type NomenclatureSectionCreateMenuProps = {
  /** Opens CreateDrawer on the current page (ADR-013). Required for consistent UX. */
  onSelect: (kind: NomenclatureCreateKind) => void;
  label?: string;
};

/**
 * Shared create menu for Settings → Номенклатура.
 * Always opens local CreateDrawer handlers — no route navigation for create.
 */
export function NomenclatureSectionCreateMenu({
  onSelect,
  label = "Создать",
}: NomenclatureSectionCreateMenuProps) {
  const items: CreateMenuItem[] = useMemo(
    () =>
      NOMENCLATURE_CREATE_KINDS.map((kind) => ({
        id: kind,
        label: SECTION_LABELS[kind],
        description: SECTION_DESCRIPTIONS[kind],
        onSelect: () => onSelect(kind),
      })),
    [onSelect],
  );

  return <CreateMenu label={label} items={items} />;
}
