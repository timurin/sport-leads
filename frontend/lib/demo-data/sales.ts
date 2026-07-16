import type { KanbanColumnData } from "@/components/kanban/kanban-types";
import type {
  Client,
  Deal,
  Lead,
  Order,
  Priority,
  SalesTask,
  UserSummary,
} from "@/types/sales";

const alexey: UserSummary = { id: "user-1", name: "Алексей Смирнов", initials: "АС" };
const maria: UserSummary = { id: "user-2", name: "Мария Иванова", initials: "МИ" };
const dmitry: UserSummary = { id: "user-3", name: "Дмитрий Петров", initials: "ДП" };
const elena: UserSummary = { id: "user-4", name: "Елена Орлова", initials: "ЕО" };

export const salesManagers = [alexey, maria, dmitry, elena];

export const leads: Lead[] = [
  { id: "lead-1", status: "new", clientName: "Футбольная академия «Олимп»", contact: "Сергей Волков", city: "Казань", sport: "Футбол", estimatedAmount: 480000, source: "Сайт", responsible: alexey, nextContact: "Сегодня, 16:00", priority: "high" },
  { id: "lead-2", status: "new", clientName: "БК «Север»", contact: "Олег Баринов", city: "Архангельск", sport: "Баскетбол", estimatedAmount: 290000, source: "VK", responsible: maria, nextContact: "Завтра, 10:30", priority: "medium" },
  { id: "lead-3", status: "contact", clientName: "Школа № 27", contact: "Наталья Романова", city: "Тула", sport: "Лёгкая атлетика", estimatedAmount: 215000, source: "Рекомендация", responsible: elena, nextContact: "17 июля", priority: "medium" },
  { id: "lead-4", status: "contact", clientName: "ХК «Метеор»", contact: "Андрей Климов", city: "Ярославль", sport: "Хоккей", estimatedAmount: 760000, source: "Холодный контакт", responsible: dmitry, nextContact: "Сегодня, 18:00", priority: "high" },
  { id: "lead-5", status: "qualification", clientName: "ВК «Вектор»", contact: "Анна Соколова", city: "Самара", sport: "Волейбол", estimatedAmount: 320000, source: "Telegram", responsible: maria, nextContact: "18 июля", priority: "high" },
  { id: "lead-6", status: "qualification", clientName: "Академия бега «Темп»", contact: "Игорь Зотов", city: "Москва", sport: "Бег", estimatedAmount: 185000, source: "Спортивное мероприятие", responsible: alexey, nextContact: "19 июля", priority: "low" },
  { id: "lead-7", status: "proposal", clientName: "Корпоративная лига «Импульс»", contact: "Вера Белова", city: "Москва", sport: "Мультиспорт", estimatedAmount: 940000, source: "Сайт", responsible: elena, nextContact: "Сегодня, 15:00", priority: "high" },
  { id: "lead-8", status: "proposal", clientName: "СШОР «Юность»", contact: "Павел Егоров", city: "Пермь", sport: "Футбол", estimatedAmount: 410000, source: "Рекомендация", responsible: dmitry, nextContact: "20 июля", priority: "medium" },
  { id: "lead-9", status: "won", clientName: "РК «Стрела»", contact: "Кирилл Титов", city: "Казань", sport: "Регби", estimatedAmount: 530000, source: "Telegram", responsible: alexey, nextContact: "Сделка создана", priority: "medium" },
  { id: "lead-10", status: "won", clientName: "Фитнес-клуб «Высота»", contact: "Дарья Громова", city: "Уфа", sport: "Фитнес", estimatedAmount: 170000, source: "VK", responsible: maria, nextContact: "Сделка создана", priority: "low" },
  { id: "lead-11", status: "unqualified", clientName: "Команда «Форсаж»", contact: "Максим Фролов", city: "Омск", sport: "Футбол", estimatedAmount: 80000, source: "Холодный контакт", responsible: elena, nextContact: "Бюджет не подтверждён", priority: "low" },
  { id: "lead-12", status: "unqualified", clientName: "Турнир «Кубок Волги»", contact: "Роман Зуев", city: "Саратов", sport: "Мини-футбол", estimatedAmount: 260000, source: "Спортивное мероприятие", responsible: dmitry, nextContact: "Перенос на 2027 год", priority: "medium" },
];

export const deals: Deal[] = [
  { id: "deal-1", status: "preparing", title: "Форма для академии — 60 комплектов", clientName: "ФА «Олимп»", amount: 480000, probability: 30, expectedClose: "25 июля", responsible: alexey, sport: "Футбол", nextTask: "Подготовить расчёт размеров" },
  { id: "deal-2", status: "preparing", title: "Беговые комплекты для тренеров", clientName: "Академия «Темп»", amount: 185000, probability: 25, expectedClose: "29 июля", responsible: maria, sport: "Бег", nextTask: "Запросить логотипы" },
  { id: "deal-3", status: "sent", title: "Экипировка волейбольной команды", clientName: "ВК «Вектор»", amount: 320000, probability: 45, expectedClose: "22 июля", responsible: maria, sport: "Волейбол", nextTask: "Получить обратную связь по КП" },
  { id: "deal-4", status: "negotiation", title: "Хоккейные свитеры — 90 штук", clientName: "ХК «Метеор»", amount: 760000, probability: 60, expectedClose: "31 июля", responsible: dmitry, sport: "Хоккей", nextTask: "Согласовать скидку" },
  { id: "deal-5", status: "negotiation", title: "Форма для школьной сборной", clientName: "Школа № 27", amount: 215000, probability: 55, expectedClose: "28 июля", responsible: elena, sport: "Лёгкая атлетика", nextTask: "Уточнить ростовку" },
  { id: "deal-6", status: "approval", title: "Комплекты для корпоративной лиги", clientName: "Лига «Импульс»", amount: 940000, probability: 75, expectedClose: "24 июля", responsible: elena, sport: "Мультиспорт", nextTask: "Согласовать макеты" },
  { id: "deal-7", status: "contract", title: "Регбийная форма — 44 комплекта", clientName: "РК «Стрела»", amount: 530000, probability: 90, expectedClose: "19 июля", responsible: alexey, sport: "Регби", nextTask: "Получить подписанный договор" },
  { id: "deal-8", status: "paid", title: "Корпоративная одежда — 140 комплектов", clientName: "ООО «ПромТех»", amount: 1240000, probability: 100, expectedClose: "12 июля", responsible: maria, sport: "Корпоративный спорт", nextTask: "Передать заказ в производство" },
  { id: "deal-9", status: "paid", title: "Баскетбольная форма — 36 комплектов", clientName: "БК «Север»", amount: 290000, probability: 100, expectedClose: "10 июля", responsible: dmitry, sport: "Баскетбол", nextTask: "Проверить поступление тканей" },
  { id: "deal-10", status: "lost", title: "Форма для мини-футбольного турнира", clientName: "Кубок Волги", amount: 260000, probability: 0, expectedClose: "8 июля", responsible: elena, sport: "Мини-футбол", nextTask: "Вернуться к контакту в январе" },
];

export const orders: Order[] = [
  { id: "order-1052", number: "№1052", status: "new", clientName: "РК «Стрела»", productType: "Футбольная форма", quantity: 44, amount: 530000, readyDate: "12 августа", manager: alexey, paymentStatus: "partial" },
  { id: "order-1051", number: "№1051", status: "confirmed", clientName: "Лига «Импульс»", productType: "Корпоративная одежда", quantity: 120, amount: 940000, readyDate: "18 августа", manager: elena, paymentStatus: "partial" },
  { id: "order-1050", number: "№1050", status: "production", clientName: "ХК «Метеор»", productType: "Хоккейные свитеры", quantity: 90, amount: 760000, readyDate: "8 августа", manager: dmitry, paymentStatus: "paid" },
  { id: "order-1049", number: "№1049", status: "production", clientName: "ООО «ПромТех»", productType: "Корпоративная одежда", quantity: 140, amount: 1240000, readyDate: "30 июля", manager: maria, paymentStatus: "paid" },
  { id: "order-1048", number: "№1048", status: "ready", clientName: "ВК «Вектор»", productType: "Волейбольная форма", quantity: 32, amount: 320000, readyDate: "Сегодня", manager: maria, paymentStatus: "paid" },
  { id: "order-1047", number: "№1047", status: "shipped", clientName: "ФА «Олимп»", productType: "Футбольная форма", quantity: 60, amount: 480000, readyDate: "Отгружен 14 июля", manager: alexey, paymentStatus: "paid" },
  { id: "order-1046", number: "№1046", status: "shipped", clientName: "Академия «Темп»", productType: "Беговая форма", quantity: 24, amount: 185000, readyDate: "Отгружен 13 июля", manager: elena, paymentStatus: "partial" },
  { id: "order-1045", number: "№1045", status: "completed", clientName: "Школа № 27", productType: "Беговая форма", quantity: 38, amount: 215000, readyDate: "Завершён 9 июля", manager: elena, paymentStatus: "paid" },
  { id: "order-1044", number: "№1044", status: "completed", clientName: "БК «Север»", productType: "Баскетбольная форма", quantity: 36, amount: 290000, readyDate: "Завершён 5 июля", manager: dmitry, paymentStatus: "paid" },
  { id: "order-1043", number: "№1043", status: "cancelled", clientName: "ФК «Форсаж»", productType: "Футбольная форма", quantity: 18, amount: 80000, readyDate: "Отменён 2 июля", manager: maria, paymentStatus: "refunded" },
];

export const salesTasks: SalesTask[] = [
  { id: "task-1", status: "planned", title: "Запросить логотипы в векторе", clientName: "Академия «Темп»", relatedEntity: "Сделка #2", dueAt: "18 июля, 11:00", assignee: maria, priority: "medium", type: "Письмо" },
  { id: "task-2", status: "planned", title: "Подготовить размерную сетку", clientName: "ФА «Олимп»", relatedEntity: "Сделка #1", dueAt: "19 июля", assignee: alexey, priority: "low", type: "Подготовка предложения" },
  { id: "task-3", status: "today", title: "Обсудить условия оплаты", clientName: "ХК «Метеор»", relatedEntity: "Сделка #4", dueAt: "Сегодня, 14:30", assignee: dmitry, priority: "high", type: "Звонок" },
  { id: "task-4", status: "today", title: "Получить обратную связь по КП", clientName: "ВК «Вектор»", relatedEntity: "Сделка #3", dueAt: "Сегодня, 17:00", assignee: maria, priority: "high", type: "Звонок" },
  { id: "task-5", status: "progress", title: "Согласовать финальные макеты", clientName: "Лига «Импульс»", relatedEntity: "Сделка #6", dueAt: "Сегодня, 18:00", assignee: elena, priority: "high", type: "Встреча" },
  { id: "task-6", status: "progress", title: "Проверить поступление ткани", clientName: "БК «Север»", relatedEntity: "Заказ №1044", dueAt: "17 июля", assignee: dmitry, priority: "medium", type: "Контроль производства" },
  { id: "task-7", status: "waiting", title: "Получить подписанный договор", clientName: "РК «Стрела»", relatedEntity: "Сделка #7", dueAt: "19 июля", assignee: alexey, priority: "high", type: "Письмо" },
  { id: "task-8", status: "waiting", title: "Проверить второй платёж", clientName: "Академия «Темп»", relatedEntity: "Заказ №1046", dueAt: "22 июля", assignee: maria, priority: "medium", type: "Проверка оплаты" },
  { id: "task-9", status: "done", title: "Передать заказ в производство", clientName: "ООО «ПромТех»", relatedEntity: "Заказ №1049", dueAt: "Выполнено 14 июля", assignee: maria, priority: "medium", type: "Контроль производства" },
  { id: "task-10", status: "done", title: "Провести установочную встречу", clientName: "Школа № 27", relatedEntity: "Лид #3", dueAt: "Выполнено 13 июля", assignee: elena, priority: "low", type: "Встреча" },
  { id: "task-11", status: "overdue", title: "Уточнить ростовку команды", clientName: "ХК «Метеор»", relatedEntity: "Заказ №1050", dueAt: "Просрочено на 2 дня", assignee: dmitry, priority: "high", type: "Звонок" },
  { id: "task-12", status: "overdue", title: "Отправить закрывающие документы", clientName: "БК «Север»", relatedEntity: "Заказ №1044", dueAt: "Просрочено на 1 день", assignee: alexey, priority: "medium", type: "Письмо" },
];

const clientSeeds: Omit<Client, "id">[] = [
  { name: "ООО «ПромТех»", type: "Корпоративный клиент", contact: "Иван Петров", phone: "+7 900 000-01-01", email: "demo.promtech@example.test", city: "Москва", sport: "Корпоративный спорт", ordersCount: 7, salesAmount: 3840000, lastContact: "Сегодня, 14:30", lastContactOrder: 202607151430, responsible: maria, status: "active" },
  { name: "ФА «Олимп»", type: "Академия", contact: "Сергей Волков", phone: "+7 900 000-01-02", email: "demo.olimp@example.test", city: "Казань", sport: "Футбол", ordersCount: 3, salesAmount: 1120000, lastContact: "Сегодня, 11:20", lastContactOrder: 202607151120, responsible: alexey, status: "active" },
  { name: "ВК «Вектор»", type: "Спортивный клуб", contact: "Анна Соколова", phone: "+7 900 000-01-03", email: "demo.vector@example.test", city: "Самара", sport: "Волейбол", ordersCount: 2, salesAmount: 620000, lastContact: "Вчера, 17:45", lastContactOrder: 202607141745, responsible: maria, status: "active" },
  { name: "Школа № 27", type: "Школа", contact: "Наталья Романова", phone: "+7 900 000-01-04", email: "demo.school27@example.test", city: "Тула", sport: "Лёгкая атлетика", ordersCount: 4, salesAmount: 745000, lastContact: "14 июля", lastContactOrder: 202607140900, responsible: elena, status: "active" },
  { name: "ХК «Метеор»", type: "Спортивный клуб", contact: "Андрей Климов", phone: "+7 900 000-01-05", email: "demo.meteor@example.test", city: "Ярославль", sport: "Хоккей", ordersCount: 5, salesAmount: 2460000, lastContact: "13 июля", lastContactOrder: 202607131200, responsible: dmitry, status: "active" },
  { name: "Лига «Импульс»", type: "Организатор мероприятия", contact: "Вера Белова", phone: "+7 900 000-01-06", email: "demo.impulse@example.test", city: "Москва", sport: "Мультиспорт", ordersCount: 1, salesAmount: 940000, lastContact: "12 июля", lastContactOrder: 202607121000, responsible: elena, status: "new" },
  { name: "Академия «Темп»", type: "Академия", contact: "Игорь Зотов", phone: "+7 900 000-01-07", email: "demo.temp@example.test", city: "Москва", sport: "Бег", ordersCount: 2, salesAmount: 355000, lastContact: "10 июля", lastContactOrder: 202607101400, responsible: alexey, status: "active" },
  { name: "РК «Стрела»", type: "Спортивный клуб", contact: "Кирилл Титов", phone: "+7 900 000-01-08", email: "demo.strela@example.test", city: "Казань", sport: "Регби", ordersCount: 1, salesAmount: 530000, lastContact: "9 июля", lastContactOrder: 202607091100, responsible: alexey, status: "new" },
  { name: "БК «Север»", type: "Спортивный клуб", contact: "Олег Баринов", phone: "+7 900 000-01-09", email: "demo.sever@example.test", city: "Архангельск", sport: "Баскетбол", ordersCount: 6, salesAmount: 1810000, lastContact: "8 июля", lastContactOrder: 202607081500, responsible: dmitry, status: "active" },
  { name: "СШОР «Юность»", type: "Школа", contact: "Павел Егоров", phone: "+7 900 000-01-10", email: "demo.yunost@example.test", city: "Пермь", sport: "Футбол", ordersCount: 8, salesAmount: 2920000, lastContact: "5 июля", lastContactOrder: 202607051100, responsible: dmitry, status: "active" },
  { name: "Фитнес-клуб «Высота»", type: "Корпоративный клиент", contact: "Дарья Громова", phone: "+7 900 000-01-11", email: "demo.vysota@example.test", city: "Уфа", sport: "Фитнес", ordersCount: 2, salesAmount: 310000, lastContact: "2 июля", lastContactOrder: 202607021700, responsible: maria, status: "paused" },
  { name: "Кубок Волги", type: "Организатор мероприятия", contact: "Роман Зуев", phone: "+7 900 000-01-12", email: "demo.volgacup@example.test", city: "Саратов", sport: "Мини-футбол", ordersCount: 3, salesAmount: 870000, lastContact: "30 июня", lastContactOrder: 202606301000, responsible: elena, status: "paused" },
  { name: "ИП Крылова М. А.", type: "Розничный клиент", contact: "Марина Крылова", phone: "+7 900 000-01-13", email: "demo.krylova@example.test", city: "Москва", sport: "Теннис", ordersCount: 1, salesAmount: 46000, lastContact: "28 июня", lastContactOrder: 202606281300, responsible: alexey, status: "new" },
  { name: "Академия «Первый лёд»", type: "Академия", contact: "Вадим Лебедев", phone: "+7 900 000-01-14", email: "demo.ice@example.test", city: "Тверь", sport: "Хоккей", ordersCount: 4, salesAmount: 1380000, lastContact: "25 июня", lastContactOrder: 202606251600, responsible: dmitry, status: "active" },
  { name: "ООО «СпортСобытие»", type: "Организатор мероприятия", contact: "Алина Миронова", phone: "+7 900 000-01-15", email: "demo.event@example.test", city: "Сочи", sport: "Триатлон", ordersCount: 5, salesAmount: 2210000, lastContact: "20 июня", lastContactOrder: 202606201000, responsible: elena, status: "active" },
];

export const clients: Client[] = clientSeeds.map((client, index) => ({
  ...client,
  id: `client-${index + 1}`,
}));

const currency = (value: number) => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
const priorityLabels: Record<Priority, string> = { low: "Низкий", medium: "Средний", high: "Высокий" };
const priorityTones: Record<Priority, "slate" | "amber" | "red"> = { low: "slate", medium: "amber", high: "red" };

const makeColumns = <TStatus extends string, T extends { status: TStatus }>(
  definitions: ReadonlyArray<{ id: TStatus; title: string; accentClass: string }>,
  records: T[],
  render: (record: T) => Omit<KanbanColumnData<TStatus>["cards"][number], "status">,
): KanbanColumnData<TStatus>[] => definitions.map((definition) => ({
  ...definition,
  cards: records
    .filter((record) => record.status === definition.id)
    .map((record) => ({
      ...render(record),
      status: record.status,
    })),
}));

export const leadColumns = makeColumns([
  { id: "new", title: "Новый", accentClass: "bg-blue-500" },
  { id: "contact", title: "Первичный контакт", accentClass: "bg-cyan-500" },
  { id: "qualification", title: "Квалификация", accentClass: "bg-violet-500" },
  { id: "proposal", title: "Предложение", accentClass: "bg-amber-500" },
  { id: "won", title: "Успешный", accentClass: "bg-emerald-500" },
  { id: "unqualified", title: "Нецелевой", accentClass: "bg-slate-400" },
] as const, leads, (lead) => ({
  id: lead.id, title: lead.clientName, subtitle: `${lead.contact} · ${lead.city}`, amount: currency(lead.estimatedAmount),
  badge: { label: priorityLabels[lead.priority], tone: priorityTones[lead.priority] }, responsible: lead.responsible.name, nextAction: lead.nextContact,
  details: [{ label: "Спорт", value: lead.sport }, { label: "Источник", value: lead.source }],
  filters: { responsible: lead.responsible.name, priority: priorityLabels[lead.priority], sport: lead.sport, source: lead.source },
  metricValues: { amount: lead.estimatedAmount },
}));

export const dealColumns = makeColumns([
  { id: "preparing", title: "Подготовка предложения", accentClass: "bg-blue-500" },
  { id: "sent", title: "Предложение отправлено", accentClass: "bg-cyan-500" },
  { id: "negotiation", title: "Переговоры", accentClass: "bg-violet-500" },
  { id: "approval", title: "Согласование", accentClass: "bg-amber-500" },
  { id: "contract", title: "Договор", accentClass: "bg-orange-500" },
  { id: "paid", title: "Оплачено", accentClass: "bg-emerald-500" },
  { id: "lost", title: "Проиграно", accentClass: "bg-slate-400" },
] as const, deals, (deal) => ({
  id: deal.id, title: deal.title, subtitle: deal.clientName, amount: currency(deal.amount), badge: { label: `${deal.probability}%`, tone: deal.probability >= 75 ? "emerald" : deal.probability >= 45 ? "amber" : "slate" },
  responsible: deal.responsible.name, nextAction: `${deal.expectedClose} · ${deal.nextTask}`, details: [{ label: "Спорт", value: deal.sport }], filters: { responsible: deal.responsible.name, sport: deal.sport },
  metricValues: { amount: deal.amount, weightedAmount: deal.amount * deal.probability / 100 },
}));

const paymentLabels = { unpaid: "Не оплачен", partial: "Частично", paid: "Оплачен", refunded: "Возврат" } as const;
export const orderColumns = makeColumns([
  { id: "new", title: "Новый", accentClass: "bg-blue-500" },
  { id: "confirmed", title: "Подтверждён", accentClass: "bg-cyan-500" },
  { id: "production", title: "В производстве", accentClass: "bg-violet-500" },
  { id: "ready", title: "Готов", accentClass: "bg-amber-500" },
  { id: "shipped", title: "Отгружен", accentClass: "bg-orange-500" },
  { id: "completed", title: "Завершён", accentClass: "bg-emerald-500" },
  { id: "cancelled", title: "Отменён", accentClass: "bg-slate-400" },
] as const, orders, (order) => ({
  id: order.id, title: `Заказ ${order.number}`, subtitle: order.clientName, amount: currency(order.amount), badge: { label: paymentLabels[order.paymentStatus], tone: order.paymentStatus === "paid" ? "emerald" : order.paymentStatus === "partial" ? "amber" : "slate" },
  responsible: order.manager.name, nextAction: order.readyDate, details: [{ label: order.productType, value: `${order.quantity} изделий` }], filters: { responsible: order.manager.name, product: order.productType, payment: paymentLabels[order.paymentStatus] },
  metricValues: { amount: order.amount },
}));

export const taskColumns = makeColumns([
  { id: "planned", title: "Запланировано", accentClass: "bg-blue-500" },
  { id: "today", title: "Сегодня", accentClass: "bg-cyan-500" },
  { id: "progress", title: "В работе", accentClass: "bg-violet-500" },
  { id: "waiting", title: "Ожидает", accentClass: "bg-amber-500" },
  { id: "done", title: "Выполнено", accentClass: "bg-emerald-500" },
  { id: "overdue", title: "Просрочено", accentClass: "bg-red-500" },
] as const, salesTasks, (task) => ({
  id: task.id, title: task.title, subtitle: `${task.clientName} · ${task.relatedEntity}`, badge: { label: priorityLabels[task.priority], tone: task.status === "overdue" ? "red" : priorityTones[task.priority] },
  responsible: task.assignee.name, nextAction: task.dueAt, details: [{ label: "Тип", value: task.type }], filters: { responsible: task.assignee.name, priority: priorityLabels[task.priority], type: task.type },
}));

export const salesCurrency = currency;
