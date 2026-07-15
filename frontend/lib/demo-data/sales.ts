import type { KanbanColumnData } from "@/components/kanban/kanban-board";

export const leadColumns: KanbanColumnData[] = [
  {
    id: "new",
    title: "Новые",
    accentClass: "bg-blue-500",
    cards: [
      {
        id: "lead-1",
        title: "Форма для футбольной академии",
        subtitle: "Академия «Олимп»",
        responsible: "Алексей Смирнов",
        deadline: "Сегодня, 16:00",
        tag: "Сайт",
      },
      {
        id: "lead-2",
        title: "Корпоративная одежда",
        subtitle: "ООО «ПромТех»",
        responsible: "Мария Иванова",
        deadline: "Завтра",
        tag: "VK",
      },
    ],
  },
  {
    id: "qualification",
    title: "Квалификация",
    accentClass: "bg-violet-500",
    cards: [
      {
        id: "lead-3",
        title: "Волейбольная форма",
        subtitle: "Команда «Вектор»",
        responsible: "Мария Иванова",
        deadline: "18 июля",
        tag: "Рекомендация",
      },
    ],
  },
  {
    id: "contacted",
    title: "Связались",
    accentClass: "bg-amber-500",
    cards: [
      {
        id: "lead-4",
        title: "Форма для турнира",
        subtitle: "Организатор «СпортЛига»",
        responsible: "Алексей Смирнов",
        deadline: "19 июля",
      },
    ],
  },
  {
    id: "converted",
    title: "Переведён в сделку",
    accentClass: "bg-emerald-500",
    cards: [],
  },
];

export const dealColumns: KanbanColumnData[] = [
  {
    id: "calculation",
    title: "Расчёт",
    accentClass: "bg-blue-500",
    cards: [
      {
        id: "deal-1",
        title: "140 комплектов корпоративной формы",
        subtitle: "ООО «ПромТех»",
        amount: "1 240 000 ₽",
        responsible: "Мария Иванова",
        deadline: "20 июля",
      },
    ],
  },
  {
    id: "offer",
    title: "Коммерческое предложение",
    accentClass: "bg-violet-500",
    cards: [
      {
        id: "deal-2",
        title: "Футбольная форма — 60 комплектов",
        subtitle: "ФК «Олимп»",
        amount: "480 000 ₽",
        responsible: "Алексей Смирнов",
        deadline: "22 июля",
      },
    ],
  },
  {
    id: "negotiation",
    title: "Переговоры",
    accentClass: "bg-amber-500",
    cards: [
      {
        id: "deal-3",
        title: "Экипировка волейбольной команды",
        subtitle: "Клуб «Вектор»",
        amount: "320 000 ₽",
        responsible: "Мария Иванова",
        deadline: "25 июля",
      },
    ],
  },
  {
    id: "won",
    title: "Успешно",
    accentClass: "bg-emerald-500",
    cards: [],
  },
];

export const orderColumns: KanbanColumnData[] = [
  {
    id: "new",
    title: "Новый",
    accentClass: "bg-blue-500",
    cards: [
      {
        id: "order-1048",
        title: "Заказ №1048",
        subtitle: "Волейбольная команда «Вектор»",
        amount: "320 000 ₽",
        responsible: "Мария Иванова",
        deadline: "Готовность: 5 августа",
      },
    ],
  },
  {
    id: "design",
    title: "Ожидает дизайна",
    accentClass: "bg-violet-500",
    cards: [
      {
        id: "order-1047",
        title: "Заказ №1047",
        subtitle: "ФК «Олимп»",
        amount: "480 000 ₽",
        responsible: "Алексей Смирнов",
        deadline: "Готовность: 2 августа",
      },
    ],
  },
  {
    id: "payment",
    title: "Ожидает оплаты",
    accentClass: "bg-amber-500",
    cards: [],
  },
  {
    id: "production",
    title: "В производстве",
    accentClass: "bg-cyan-500",
    cards: [
      {
        id: "order-1045",
        title: "Заказ №1045",
        subtitle: "ООО «ПромТех»",
        amount: "1 240 000 ₽",
        responsible: "Мария Иванова",
        deadline: "Готовность: 30 июля",
      },
    ],
  },
  {
    id: "ready",
    title: "Готов",
    accentClass: "bg-emerald-500",
    cards: [],
  },
];

export const taskColumns: KanbanColumnData[] = [
  {
    id: "new",
    title: "Новые",
    accentClass: "bg-blue-500",
    cards: [
      {
        id: "task-1",
        title: "Позвонить клиенту",
        subtitle: "Связь: Лид «Академия Олимп»",
        responsible: "Алексей Смирнов",
        deadline: "Сегодня, 16:00",
        tag: "Высокий приоритет",
      },
    ],
  },
  {
    id: "planned",
    title: "Запланированы",
    accentClass: "bg-violet-500",
    cards: [
      {
        id: "task-2",
        title: "Подготовить расчёт",
        subtitle: "Связь: Сделка «ПромТех»",
        responsible: "Мария Иванова",
        deadline: "Завтра, 12:00",
      },
    ],
  },
  {
    id: "progress",
    title: "В работе",
    accentClass: "bg-amber-500",
    cards: [
      {
        id: "task-3",
        title: "Согласовать дизайн",
        subtitle: "Связь: Заказ №1047",
        responsible: "Дмитрий Петров",
        deadline: "18 июля",
      },
    ],
  },
  {
    id: "review",
    title: "На проверке",
    accentClass: "bg-cyan-500",
    cards: [],
  },
  {
    id: "done",
    title: "Выполнены",
    accentClass: "bg-emerald-500",
    cards: [],
  },
];