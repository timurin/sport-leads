"use client";

import { Fragment, useMemo } from "react";

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import {
  buildAccessMatrix,
  roleLabel,
  type RoleCatalogItem,
} from "@/lib/platform-users";

/** Readable role → permission/module matrix (21.4.1). Assign stays via role codes. */
export function PlatformAccessMatrix({
  roles,
}: {
  roles: RoleCatalogItem[];
}) {
  const matrix = useMemo(() => buildAccessMatrix(roles), [roles]);

  if (matrix.roleCodes.length === 0) {
    return (
      <p className="text-portal-body text-portal-muted">
        Каталог ролей пуст — матрица недоступна.
      </p>
    );
  }

  if (matrix.rows.length === 0) {
    return (
      <p className="text-portal-body text-portal-muted">
        У ролей нет привязанных прав.
      </p>
    );
  }

  return (
    <div className="space-y-portal-3">
      <div>
        <h2 className="text-portal-body font-semibold text-portal-text">
          Матрица доступа
        </h2>
        <p className="mt-1 text-portal-caption text-portal-muted">
          Права выводятся из ролей (ADR-024). Назначение — только через роли в
          таблице пользователей; персональных overrides нет.
        </p>
      </div>

      <DataTableFrame>
        <DataTable minWidthClassName="min-w-[40rem]">
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Модуль / право</DataTableHeaderCell>
              {matrix.roleCodes.map((code) => (
                <DataTableHeaderCell key={code} className="text-center">
                  {roleLabel(code)}
                </DataTableHeaderCell>
              ))}
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {matrix.modules.map((module) => (
              <Fragment key={module.key}>
                <DataTableRow>
                  <DataTableCell
                    colSpan={matrix.roleCodes.length + 1}
                    className="bg-portal-surface-secondary font-semibold text-portal-muted"
                  >
                    {module.label}
                  </DataTableCell>
                </DataTableRow>
                {module.rows.map((row) => (
                  <DataTableRow key={row.code}>
                    <DataTableCell>
                      <div className="min-w-0">
                        <p className="text-portal-body text-portal-text">
                          {row.label}
                        </p>
                        <p className="font-mono text-portal-caption text-portal-muted">
                          {row.code}
                        </p>
                      </div>
                    </DataTableCell>
                    {matrix.roleCodes.map((roleCode) => {
                      const granted = row.grantedByRole[roleCode];
                      return (
                        <DataTableCell
                          key={`${row.code}:${roleCode}`}
                          className="text-center"
                          aria-label={`${roleLabel(roleCode)}: ${row.code} — ${granted ? "есть" : "нет"}`}
                        >
                          <span
                            className={
                              granted
                                ? "font-semibold text-portal-success"
                                : "text-portal-muted"
                            }
                          >
                            {granted ? "●" : "·"}
                          </span>
                        </DataTableCell>
                      );
                    })}
                  </DataTableRow>
                ))}
              </Fragment>
            ))}
          </DataTableBody>
        </DataTable>
      </DataTableFrame>
    </div>
  );
}
