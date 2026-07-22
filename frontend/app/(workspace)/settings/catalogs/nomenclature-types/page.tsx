"use client";

import { useState } from "react";

import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { EditDrawer, EditForm } from "@/components/ui/edit-drawer";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import type { NomenclatureType } from "@/lib/nomenclature";

const NOMENCLATURE_TYPES: Array<{
  code: NomenclatureType;
  title: string;
  description: string;
}> = [
  {
    code: "PRODUCT",
    title: "Продукция",
    description: "Готовые изделия собственного производства",
  },
  {
    code: "GOODS",
    title: "Товары",
    description: "Покупные товары для перепродажи",
  },
  {
    code: "MATERIAL",
    title: "Материалы",
    description: "Сырьё и комплектующие",
  },
  {
    code: "SERVICE",
    title: "Услуги",
    description: "Работы и услуги без физического остатка",
  },
];

/** PT-02 read-only reference list + left info drawer (`DS-PT-02`). */
export default function NomenclatureTypesPage() {
  const [selectedCode, setSelectedCode] = useState<NomenclatureType | null>(
    null,
  );
  const selected =
    NOMENCLATURE_TYPES.find((type) => type.code === selectedCode) ?? null;

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PageToolbar
        start={
          <p className="text-portal-body text-portal-muted">
            Справочник типов номенклатуры (read-only)
          </p>
        }
      />
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <EditDrawer
          open={selected != null}
          title={selected ? selected.title : ""}
          description="Системный тип — редактирование недоступно"
          onClose={() => setSelectedCode(null)}
        >
          {selected ? (
            <EditForm
              action={async () => undefined}
              onCancel={() => setSelectedCode(null)}
              readOnly
            >
              <Field label="Код">
                <Input value={selected.code} readOnly />
              </Field>
              <Field label="Название">
                <Input value={selected.title} readOnly />
              </Field>
              <Field label="Описание">
                <Textarea value={selected.description} readOnly rows={4} />
              </Field>
            </EditForm>
          ) : null}
        </EditDrawer>

        <div className="min-w-0 flex-1">
          <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
            <DataTable minWidthClassName="min-w-[560px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Код</DataTableHeaderCell>
                  <DataTableHeaderCell>Название</DataTableHeaderCell>
                  <DataTableHeaderCell>Описание</DataTableHeaderCell>
                  <DataTableHeaderCell>Действие</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {NOMENCLATURE_TYPES.map((type) => (
                  <DataTableRow
                    key={type.code}
                    className={
                      selectedCode === type.code
                        ? "bg-portal-primary-soft/50"
                        : undefined
                    }
                  >
                    <DataTableCell className="font-medium">
                      {type.code}
                    </DataTableCell>
                    <DataTableCell>
                      <button
                        type="button"
                        className="font-medium text-portal-text hover:text-portal-primary"
                        onClick={() => setSelectedCode(type.code)}
                      >
                        {type.title}
                      </button>
                    </DataTableCell>
                    <DataTableCell className="text-portal-muted">
                      {type.description}
                    </DataTableCell>
                    <DataTableCell>
                      <Button
                        type="button"
                        size="compact"
                        onClick={() => setSelectedCode(type.code)}
                      >
                        Открыть
                      </Button>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
          <ListTotals
            primary={`Всего: ${NOMENCLATURE_TYPES.length} типов`}
          />
        </div>
      </div>
    </PageLayout>
  );
}
