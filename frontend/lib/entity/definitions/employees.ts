import type {
  EntityDefinition,
} from "@/types/entity/entity-config";

export const employeesDefinition: EntityDefinition = {
  id: "employees",
  title: "Сотрудник",
  titlePlural: "Сотрудники",
  description:
    "Сотрудники компании, должности и рабочие контакты",

  defaultView: "table",
  availableViews: ["table"],

  columns: [
    {
      id: "title",
      title: "Сотрудник",
      field: "title",
      sortable: true,
    },
    {
      id: "position",
      title: "Должность",
      field: "position",
    },
    {
      id: "department",
      title: "Подразделение",
      field: "department",
    },
    {
      id: "organization",
      title: "Организация",
      field: "organization",
    },
    {
      id: "phone",
      title: "Телефон",
      field: "phone",
    },
  ],

  fields: [
    {
      id: "position",
      label: "Должность",
      value: null,
    },
    {
      id: "department",
      label: "Подразделение",
      value: null,
    },
    {
      id: "organization",
      label: "Организация",
      value: null,
    },
    {
      id: "phone",
      label: "Телефон",
      value: null,
      type: "phone",
    },
    {
      id: "email",
      label: "Email",
      value: null,
      type: "email",
    },
    {
      id: "employmentDate",
      label: "Дата приёма",
      value: null,
      type: "date",
    },
  ],

  inspectorTabs: [
    {
      id: "main",
      title: "Основное",
    },
    {
      id: "tasks",
      title: "Задачи",
    },
    {
      id: "schedule",
      title: "График",
    },
    {
      id: "documents",
      title: "Документы",
    },
    {
      id: "history",
      title: "История",
    },
  ],
};