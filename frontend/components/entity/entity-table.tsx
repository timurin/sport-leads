"use client";

import {
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";

import type {
  EntityId,
  EntityRecord,
} from "@/types/entity/entity";
import type {
  EntityDefinition,
} from "@/types/entity/entity-config";

type EntityTableProps = {
  definition: EntityDefinition;
  records: EntityRecord[];
  selectedId?: EntityId | null;
  onSelect: (
    record: EntityRecord,
  ) => void;
};

function getFieldValue(
  record: EntityRecord,
  fieldId: string,
) {
  if (fieldId === "title") {
    return record.title;
  }

  if (fieldId === "status") {
    return record.status?.title ?? "";
  }

  if (fieldId === "responsible") {
    return record.responsible ?? "";
  }

  return (
    record.fields?.find(
      (field) => field.id === fieldId,
    )?.value ?? ""
  );
}

export function EntityTable({
  definition,
  records,
  selectedId,
  onSelect,
}: EntityTableProps) {
  return (
    <div className="min-w-0 overflow-auto">
      <table className="w-full min-w-[850px]">
        <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                aria-label="Выбрать все записи"
              />
            </th>

            {definition.columns.map(
              (column) => (
                <th
                  key={column.id}
                  className="px-4 py-3"
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-slate-800"
                  >
                    {column.title}

                    {column.sortable ? (
                      <ChevronDown size={13} />
                    ) : null}
                  </button>
                </th>
              ),
            )}

            <th className="w-12 px-3 py-3" />
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white text-sm">
          {records.map((record) => {
            const selected =
              record.id === selectedId;

            return (
              <tr
                key={record.id}
                onClick={() => {
                  onSelect(record);
                }}
                className={[
                  "cursor-pointer transition",
                  selected
                    ? "bg-blue-50"
                    : "hover:bg-slate-50",
                ].join(" ")}
              >
                <td
                  className="px-4 py-4"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <input
                    type="checkbox"
                    aria-label={`Выбрать ${record.title}`}
                  />
                </td>

                {definition.columns.map(
                  (column) => {
                    const value =
                      getFieldValue(
                        record,
                        column.field,
                      );

                    return (
                      <td
                        key={column.id}
                        className={[
                          "px-4 py-4 text-slate-600",
                          column.field === "title"
                            ? "font-semibold text-slate-900"
                            : "",
                        ].join(" ")}
                      >
                        {value}
                      </td>
                    );
                  },
                )}

                <td
                  className="px-3 py-4"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}