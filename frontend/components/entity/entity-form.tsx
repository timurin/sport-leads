"use client";

import {
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import type {
  EntityField,
  EntityRecord,
} from "@/types/entity/entity";
import type {
  EntityDefinition,
} from "@/types/entity/entity-config";

type EntityFormProps = {
  definition: EntityDefinition;
  record?: EntityRecord | null;
  onSave: (
    record: EntityRecord,
  ) => void;
  onCancel: () => void;
};

type FormValues = Record<
  string,
  string | number
>;

function getInitialValues(
  definition: EntityDefinition,
  record?: EntityRecord | null,
): FormValues {
  const values: FormValues = {
    title: record?.title ?? "",
    subtitle: record?.subtitle ?? "",
  };

  for (const field of definition.fields) {
    const recordField = record?.fields?.find(
      (item) => item.id === field.id,
    );

    values[field.id] =
      recordField?.value ?? "";
  }

  return values;
}

function getInputType(
  field: EntityField,
): string {
  switch (field.type) {
    case "email":
      return "email";

    case "phone":
      return "tel";

    case "number":
      return "number";

    case "date":
      return "date";

    default:
      return "text";
  }
}

export function EntityForm({
  definition,
  record,
  onSave,
  onCancel,
}: EntityFormProps) {
  const [values, setValues] =
    useState<FormValues>(() =>
      getInitialValues(
        definition,
        record,
      ),
    );

  const [error, setError] =
    useState<string | null>(null);

  function updateValue(
    fieldId: string,
    value: string,
  ) {
    setValues((current) => ({
      ...current,
      [fieldId]: value,
    }));
  }

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const title = String(
      values.title ?? "",
    ).trim();

    if (!title) {
      setError(
        `Заполните поле «${definition.title}»`,
      );

      return;
    }

    const fields: EntityField[] =
      definition.fields.map(
        (field) => {
          const rawValue =
            values[field.id] ?? "";

          let value:
            | string
            | number
            | null = rawValue;

          if (
            field.type === "number" &&
            rawValue !== ""
          ) {
            value = Number(rawValue);
          }

          if (rawValue === "") {
            value = null;
          }

          return {
            ...field,
            value,
          };
        },
      );

    const now = new Intl.DateTimeFormat(
      "ru-RU",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(new Date());

    onSave({
      id:
        record?.id ??
        `${definition.id}-${Date.now()}`,
      title,
      subtitle: String(
        values.subtitle ?? "",
      ).trim(),
      responsible:
        record?.responsible,
      status:
        record?.status ?? {
          id: "active",
          title: "Активен",
          colorClass:
            "bg-emerald-50 text-emerald-700",
        },
      createdAt:
        record?.createdAt ?? now,
      updatedAt: now,
      fields,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
        <div>
          <label
            htmlFor="entity-title"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Наименование
            <span className="text-red-500">
              {" "}*
            </span>
          </label>

          <input
            id="entity-title"
            type="text"
            value={String(
              values.title ?? "",
            )}
            onChange={(event) => {
              updateValue(
                "title",
                event.target.value,
              );
            }}
            className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            autoFocus
          />
        </div>

        <div>
          <label
            htmlFor="entity-subtitle"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Краткое описание
          </label>

          <input
            id="entity-subtitle"
            type="text"
            value={String(
              values.subtitle ?? "",
            )}
            onChange={(event) => {
              updateValue(
                "subtitle",
                event.target.value,
              );
            }}
            className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="border-t border-slate-200 pt-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">
            Основные данные
          </h3>

          <div className="space-y-4">
            {definition.fields.map(
              (field) => (
                <div key={field.id}>
                  <label
                    htmlFor={`field-${field.id}`}
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    {field.label}
                  </label>

                  <input
                    id={`field-${field.id}`}
                    type={getInputType(field)}
                    value={String(
                      values[field.id] ?? "",
                    )}
                    onChange={(event) => {
                      updateValue(
                        field.id,
                        event.target.value,
                      );
                    }}
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              ),
            )}
          </div>
        </div>

        {error ? (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
        <Button
          type="button"
          onClick={onCancel}
        >
          Отмена
        </Button>

        <Button
          type="submit"
          variant="primary"
        >
          Сохранить
        </Button>
      </footer>
    </form>
  );
}