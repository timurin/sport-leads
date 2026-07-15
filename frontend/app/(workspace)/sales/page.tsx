import {
  CircleDollarSign,
  ClipboardList,
  Handshake,
  UserPlus,
} from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

const recentEvents = [
  {
    title: "Создан новый лид",
    description: "Футбольный клуб «Олимп»",
    time: "10 минут назад",
  },
  {
    title: "Сделка перешла на этап расчёта",
    description: "Корпоративная форма — 140 комплектов",
    time: "35 минут назад",
  },
  {
    title: "Создан заказ №1048",
    description: "Волейбольная команда «Вектор»",
    time: "1 час назад",
  },
];

const funnel = [
  ["Новые лиды", 48, "100%"],
  ["Квалификация", 31, "65%"],
  ["Расчёт стоимости", 19, "40%"],
  ["Переговоры", 12, "25%"],
  ["Успешные сделки", 8, "17%"],
];

export default function SalesPage() {
  return (
    <div>
      <PageHeader
        title="Продажи"
        description="Общая статистика по лидам, сделкам, заказам и активности менеджеров"
        actions={
          <>
            <Button>Этот месяц</Button>
            <Button variant="primary">
              + Создать
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Новые лиды"
            value="48"
            trend="+12%"
            description="к прошлому месяцу"
            icon={UserPlus}
          />

          <MetricCard
            title="Активные сделки"
            value="21"
            trend="4,8 млн ₽"
            description="общая сумма"
            icon={Handshake}
          />

          <MetricCard
            title="Заказы"
            value="17"
            trend="2,6 млн ₽"
            description="за текущий период"
            icon={ClipboardList}
          />

          <MetricCard
            title="Конверсия"
            value="16,7%"
            trend="+2,4%"
            description="за период"
            icon={CircleDollarSign}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Воронка продаж
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Переход лидов по этапам
                </p>
              </div>

              <Button>Открыть отчёт</Button>
            </div>

            <div className="mt-6 space-y-5">
              {funnel.map(([title, value, percent]) => (
                <div key={title}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      {title}
                    </span>

                    <span className="text-slate-500">
                      {value} · {percent}
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{
                        width: percent,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Последние события
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Изменения в работе отдела
              </p>
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              {recentEvents.map((event) => (
                <div
                  key={`${event.title}-${event.time}`}
                  className="py-4 first:pt-0"
                >
                  <div className="text-sm font-medium text-slate-800">
                    {event.title}
                  </div>

                  <div className="mt-1 text-sm text-slate-500">
                    {event.description}
                  </div>

                  <div className="mt-2 text-xs text-slate-400">
                    {event.time}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}