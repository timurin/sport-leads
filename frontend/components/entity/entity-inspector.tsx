"use client";

import {
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  History,
  Mail,
  MoreHorizontal,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import {
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import type {
  EntityRecord,
} from "@/types/entity/entity";
import type {
  EntityDefinition,
} from "@/types/entity/entity-config";

type EntityInspectorProps = {
  definition: EntityDefinition;
  record: EntityRecord | null;
  onClose?: () => void;
};

function FieldValue({
  value,
}: {
  value: string | number | null;
}) {
  if (
    value === null ||
    value === ""
  ) {
    return (
      <span className="text-slate-400">
        Не заполнено
      </span>
    );
  }

  return <>{value}</>;
}

export function EntityInspector({
  definition,
  record,
  onClose,
}: EntityInspectorProps) {
  const [activeTab, setActiveTab] =
    useState(
      definition.inspectorTabs[0]?.id ??
        "main",
    );

  if (!record) {
    return (
      <aside className="flex h-full min-h-[600px] w-full items-center justify-center border-l border-slate-200 bg-white px-8 text-center">
        <div>
          <UserRound
            size={38}
            className="mx-auto text-slate-300"
          />

          <h2 className="mt-4 text-lg font-semibold text-slate-800">
            Объект не выбран
          </h2>

          <p className="mt-2 max-w-xs text-sm leading-5 text-slate-500">
            Выберите запись в списке, чтобы открыть
            карточку и связанную информацию.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-[600px] w-full flex-col border-l border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {record.status ? (
              <div
                className={[
                  "mb-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                  record.status.colorClass,
                ].join(" ")}
              >
                {record.status.title}
              </div>
            ) : null}

            <h2 className="truncate text-xl font-semibold text-slate-950">
              {record.title}
            </h2>

            {record.subtitle ? (
              <p className="mt-1 text-sm text-slate-500">
                {record.subtitle}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <MoreHorizontal size={19} />
            </button>

            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={19} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="primary">
            Редактировать
          </Button>

          <Button>
            <Phone size={16} />
            Позвонить
          </Button>

          <Button>
            <Mail size={16} />
            Написать
          </Button>
        </div>
      </header>

      <nav className="flex overflow-x-auto border-b border-slate-200 px-4">
        {definition.inspectorTabs.map(
          (tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
              }}
              className={[
                "shrink-0 border-b-2 px-4 py-3 text-sm font-medium",
                activeTab === tab.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-900",
              ].join(" ")}
            >
              {tab.title}
            </button>
          ),
        )}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "main" ? (
          <div className="space-y-6 p-6">
            <section>
              <h3 className="text-sm font-semibold text-slate-900">
                Основная информация
              </h3>

              <dl className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {record.fields?.map(
                  (field) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[150px_1fr] gap-4 px-4 py-3 text-sm"
                    >
                      <dt className="text-slate-500">
                        {field.label}
                      </dt>

                      <dd className="font-medium text-slate-800">
                        <FieldValue
                          value={field.value}
                        />
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <BriefcaseBusiness size={17} />
                  Активные сделки
                </div>

                <div className="mt-3 text-2xl font-semibold text-slate-950">
                  2
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <FileText size={17} />
                  Заказы
                </div>

                <div className="mt-3 text-2xl font-semibold text-slate-950">
                  7
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="flex min-h-[420px] items-center justify-center p-8 text-center">
            <div>
              {activeTab === "history" ? (
                <History
                  size={36}
                  className="mx-auto text-slate-300"
                />
              ) : (
                <CalendarDays
                  size={36}
                  className="mx-auto text-slate-300"
                />
              )}

              <h3 className="mt-4 font-semibold text-slate-800">
                {definition.inspectorTabs.find(
                  (tab) =>
                    tab.id === activeTab,
                )?.title}
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Содержимое вкладки будет подключено
                на следующем этапе.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}