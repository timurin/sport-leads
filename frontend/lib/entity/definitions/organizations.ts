import type {
  EntityDefinition,
} from "@/types/entity/entity-config";

export const organizationsDefinition: EntityDefinition = {
  id: "organizations",
  title: "Организация",
  titlePlural: "Организации",
  description:
    "Юридические лица, используемые в учёте и документах",

  defaultView: "table",
  availableViews: ["table"],

  columns: [
    {
      id: "title",
      title: "Организация",
      field: "title",
      sortable: true,
    },
    {
      id: "legalForm",
      title: "Форма",
      field: "legalForm",
    },
    {
      id: "inn",
      title: "ИНН",
      field: "inn",
    },
    {
      id: "taxSystem",
      title: "Налогообложение",
      field: "taxSystem",
    },
    {
      id: "director",
      title: "Руководитель",
      field: "director",
    },
  ],

  fields: [
    {
      id: "legalForm",
      label: "Организационная форма",
      value: null,
    },
    {
      id: "inn",
      label: "ИНН",
      value: null,
    },
    {
      id: "kpp",
      label: "КПП",
      value: null,
    },
    {
      id: "taxSystem",
      label: "Система налогообложения",
      value: null,
    },
    {
      id: "director",
      label: "Руководитель",
      value: null,
    },
    {
      id: "legalAddress",
      label: "Юридический адрес",
      value: null,
    },
  ],

  inspectorTabs: [
    {
      id: "main",
      title: "Основное",
    },
    {
      id: "banking",
      title: "Банковские реквизиты",
    },
    {
      id: "employees",
      title: "Сотрудники",
    },
    {
      id: "warehouses",
      title: "Склады",
    },
    {
      id: "history",
      title: "История",
    },
  ],
};