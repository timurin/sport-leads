import Link from "next/link";

export function LeadPageState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 p-4 sm:p-6">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {action}
          <Link
            href="/sales/leads"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Вернуться к списку лидов
          </Link>
        </div>
      </section>
    </div>
  );
}
