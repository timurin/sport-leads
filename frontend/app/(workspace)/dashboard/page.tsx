export default function DashboardPage() {
  return (
    <div className="p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-sm font-medium text-blue-600">
          MOSMADE ERP
        </div>

        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          Главная
        </h1>

        <p className="mt-3 max-w-2xl text-slate-600">
          Рабочая область ERP. Здесь будет отображаться
          общая статистика компании, задачи и последние
          события.
        </p>
      </div>
    </div>
  );
}