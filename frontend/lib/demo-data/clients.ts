import type {
  EntityRecord,
} from "@/types/entity/entity";

export const clientRecords: EntityRecord[] = [
  {
    id: "client-1",
    title: "ООО «ПромТех»",
    subtitle:
      "Производственная компания · Москва",
    responsible: "Мария Иванова",
    updatedAt: "Сегодня, 14:30",
    status: {
      id: "active",
      title: "Активный",
      colorClass:
        "bg-emerald-50 text-emerald-700",
    },
    fields: [
      {
        id: "type",
        label: "Тип клиента",
        value: "Компания",
        type: "text",
      },
      {
        id: "contact",
        label: "Контактное лицо",
        value: "Иван Петров",
        type: "text",
      },
      {
        id: "phone",
        label: "Телефон",
        value: "+7 999 123-45-67",
        type: "phone",
      },
      {
        id: "email",
        label: "Email",
        value: "info@promtech.ru",
        type: "email",
      },
      {
        id: "city",
        label: "Город",
        value: "Москва",
        type: "text",
      },
      {
        id: "manager",
        label: "Менеджер",
        value: "Мария Иванова",
        type: "text",
      },
      {
        id: "orders",
        label: "Количество заказов",
        value: 7,
        type: "number",
      },
      {
        id: "amount",
        label: "Сумма заказов",
        value: "3 840 000 ₽",
        type: "money",
      },
    ],
  },
  {
    id: "client-2",
    title: "ФК «Олимп»",
    subtitle:
      "Спортивный клуб · Казань",
    responsible: "Алексей Смирнов",
    updatedAt: "Сегодня, 11:20",
    status: {
      id: "active",
      title: "Активный",
      colorClass:
        "bg-emerald-50 text-emerald-700",
    },
    fields: [
      {
        id: "type",
        label: "Тип клиента",
        value: "Спортивный клуб",
      },
      {
        id: "contact",
        label: "Контактное лицо",
        value: "Сергей Волков",
      },
      {
        id: "phone",
        label: "Телефон",
        value: "+7 999 777-12-10",
        type: "phone",
      },
      {
        id: "email",
        label: "Email",
        value: "office@olimp-fc.ru",
        type: "email",
      },
      {
        id: "city",
        label: "Город",
        value: "Казань",
      },
      {
        id: "manager",
        label: "Менеджер",
        value: "Алексей Смирнов",
      },
      {
        id: "orders",
        label: "Количество заказов",
        value: 3,
        type: "number",
      },
      {
        id: "amount",
        label: "Сумма заказов",
        value: "1 120 000 ₽",
        type: "money",
      },
    ],
  },
  {
    id: "client-3",
    title: "Команда «Вектор»",
    subtitle:
      "Волейбольная команда · Самара",
    responsible: "Мария Иванова",
    updatedAt: "Вчера, 17:45",
    status: {
      id: "new",
      title: "Новый",
      colorClass:
        "bg-blue-50 text-blue-700",
    },
    fields: [
      {
        id: "type",
        label: "Тип клиента",
        value: "Спортивная команда",
      },
      {
        id: "contact",
        label: "Контактное лицо",
        value: "Анна Соколова",
      },
      {
        id: "phone",
        label: "Телефон",
        value: "+7 999 308-40-50",
        type: "phone",
      },
      {
        id: "email",
        label: "Email",
        value: "team@vector.ru",
        type: "email",
      },
      {
        id: "city",
        label: "Город",
        value: "Самара",
      },
      {
        id: "manager",
        label: "Менеджер",
        value: "Мария Иванова",
      },
      {
        id: "orders",
        label: "Количество заказов",
        value: 2,
        type: "number",
      },
      {
        id: "amount",
        label: "Сумма заказов",
        value: "620 000 ₽",
        type: "money",
      },
    ],
  },
];