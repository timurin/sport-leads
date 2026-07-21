"use client";

import {
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { labelClassName } from "@/lib/design-system/control-styles";
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
      <div className="min-h-0 flex-1 space-y-portal-5 overflow-y-auto p-portal-6">
        <div>
          <label
            htmlFor="entity-title"
            className={labelClassName()}
          >
            Наименование
            <span className="text-portal-danger">
              {" "}*
            </span>
          </label>

          <Input
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
            autoFocus
          />
        </div>

        <div>
          <label
            htmlFor="entity-subtitle"
            className={labelClassName()}
          >
            Краткое описание
          </label>

          <Input
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
          />
        </div>

        <div className="border-t border-portal-border pt-portal-5">
          <h3 className="mb-portal-4 text-portal-body font-semibold text-portal-text">
            Основные данные
          </h3>

          <div className="space-y-portal-4">
            {definition.fields.map(
              (field) => (
                <div key={field.id}>
                  <label
                    htmlFor={`field-${field.id}`}
                    className={labelClassName()}
                  >
                    {field.label}
                  </label>

                  <Input
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
                  />
                </div>
              ),
            )}
          </div>
        </div>

        {error ? (
          <div className="rounded-portal-md border border-portal-danger bg-portal-danger-soft px-portal-4 py-portal-3 text-portal-body text-portal-danger">
            {error}
          </div>
        ) : null}
      </div>

      <footer className="flex items-center justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
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