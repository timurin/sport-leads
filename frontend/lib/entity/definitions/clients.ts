import type {
  EntityDefinition,
} from "@/types/entity/entity-config";

export const clientsDefinition: EntityDefinition = {
  id: "clients",
  title: "Клиент",
  titlePlural: "Клиенты",
  description:
    "Компании, спортивные команды, организации и физические лица",

  defaultView: "table",
  availableViews: [
    "table",
  ],

  columns: [
    {
      id: "title",
      title: "Клиент",
      field: "title",
      sortable: true,
    },
    {
      id: "type",
      title: "Тип",
      field: "type",
    },
    {
      id: "contact",
      title: "Контакт",
      field: "contact",
    },
    {
      id: "city",
      title: "Город",
      field: "city",
    },
    {
      id: "manager",
      title: "Менеджер",
      field: "manager",
    },
    {
      id: "orders",
      title: "Заказы",
      field: "orders",
    },
    {
      id: "amount",
      title: "Сумма",
      field: "amount",
    },
  ],

  fields: [
    {
      id: "type",
      label: "Тип клиента",
      value: null,
      type: "text",
    },
    {
      id: "contact",
      label: "Контактное лицо",
      value: null,
      type: "text",
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
      id: "city",
      label: "Город",
      value: null,
      type: "text",
    },
    {
      id: "manager",
      label: "Ответственный менеджер",
      value: null,
      type: "text",
    },
  ],

  inspectorTabs: [
    {
      id: "main",
      title: "Основное",
    },
    {
      id: "activity",
      title: "Активность",
    },
    {
      id: "deals",
      title: "Сделки",
    },
    {
      id: "orders",
      title: "Заказы",
    },
    {
      id: "tasks",
      title: "Задачи",
    },
    {
      id: "files",
      title: "Файлы",
    },
    {
      id: "history",
      title: "История",
    },
  ],

  actions: [
    {
      id: "edit",
      title: "Редактировать",
    },
    {
      id: "archive",
      title: "Архивировать",
    },
    {
      id: "delete",
      title: "Удалить",
      variant: "danger",
    },
  ],
};