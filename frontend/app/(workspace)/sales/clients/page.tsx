import {
  Filter,
  MoreHorizontal,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

const clients = [
  {
    name: "ООО «ПромТех»",
    type: "Компания",
    contact: "Иван Петров",
    phone: "+7 999 123-45-67",
    city: "Москва",
    manager: "Мария Иванова",
    orders: 7,
    amount: "3 840 000 ₽",
  },
  {
    name: "ФК «Олимп»",
    type: "Спортивный клуб",
    contact: "Сергей Волков",
    phone: "+7 999 777-12-10",
    city: "Казань",
    manager: "Алексей Смирнов",
    orders: 3,
    amount: "1 120 000 ₽",
  },
  {
    name: "Команда «Вектор»",
    type: "Команда",
    contact: "Анна Соколова",
    phone: "+7 999 308-40-50",
    city: "Самара",
    manager: "Мария Иванова",
    orders: 2,
    amount: "620 000 ₽",
  },
];

export default function ClientsPage() {
  return (
    <div>
      <PageHeader
        title="Клиенты"
        description="Компании, команды, физические лица и организации"
        actions={
          <Button variant="primary">
            + Добавить клиента
          </Button>
        }
      />

      <div className="p-6">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
            <div className="flex h-10 min-w-72 items-center gap-2 rounded-lg border border-slate-200 px-3">
              <Search size={17} className="text-slate-400" />

              <input
                type="search"
                placeholder="Поиск клиентов..."
                className="min-w-0 flex-1 text-sm outline-none"
              />
            </div>

            <Button>
              <Filter size={16} />
              Фильтры
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Клиент</th>
                  <th className="px-5 py-3">Тип</th>
                  <th className="px-5 py-3">Контакт</th>
                  <th className="px-5 py-3">Телефон</th>
                  <th className="px-5 py-3">Город</th>
                  <th className="px-5 py-3">Менеджер</th>
                  <th className="px-5 py-3">Заказы</th>
                  <th className="px-5 py-3">Сумма</th>
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-sm">
                {clients.map((client) => (
                  <tr
                    key={client.name}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {client.name}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {client.type}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {client.contact}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {client.phone}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {client.city}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {client.manager}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {client.orders}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {client.amount}
                    </td>
                    <td className="px-3 py-4">
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-700"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}