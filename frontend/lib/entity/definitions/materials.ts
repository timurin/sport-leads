import type {
  EntityDefinition,
} from "@/types/entity/entity-config";

export const materialsDefinition: EntityDefinition = {
  id: "materials",
  title: "Материал",
  titlePlural: "Материалы",
  description:
    "Ткани, фурнитура, упаковка и расходные материалы",

  defaultView: "table",
  availableViews: ["table"],

  columns: [
    {
      id: "title",
      title: "Материал",
      field: "title",
      sortable: true,
    },
    {
      id: "article",
      title: "Артикул",
      field: "article",
    },
    {
      id: "category",
      title: "Категория",
      field: "category",
    },
    {
      id: "unit",
      title: "Ед. измерения",
      field: "unit",
    },
    {
      id: "balance",
      title: "Остаток",
      field: "balance",
      sortable: true,
    },
    {
      id: "warehouse",
      title: "Склад",
      field: "warehouse",
    },
  ],

  fields: [
    {
      id: "article",
      label: "Артикул",
      value: null,
    },
    {
      id: "category",
      label: "Категория",
      value: null,
    },
    {
      id: "unit",
      label: "Единица измерения",
      value: null,
    },
    {
      id: "balance",
      label: "Остаток",
      value: null,
      type: "number",
    },
    {
      id: "minimum",
      label: "Минимальный остаток",
      value: null,
      type: "number",
    },
    {
      id: "warehouse",
      label: "Основной склад",
      value: null,
    },
  ],

  inspectorTabs: [
    {
      id: "main",
      title: "Основное",
    },
    {
      id: "stock",
      title: "Остатки",
    },
    {
      id: "movements",
      title: "Движения",
    },
    {
      id: "suppliers",
      title: "Поставщики",
    },
    {
      id: "history",
      title: "История",
    },
  ],
};