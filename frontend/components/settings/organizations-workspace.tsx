"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { OrganizationCreateDrawer } from "@/components/settings/organization-create-drawer";
import { PageLayout } from "@/components/layout/page-layout";
import { Button, IconButton } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  organizationMatchesQuery,
  type OrganizationView,
} from "@/lib/settings/organizations";

type Props = {
  organizations: OrganizationView[];
  loadError?: string;
};

/** PT-02 catalog list (`DS-PT-02`) for our legal entities. */
export function OrganizationsWorkspace({ organizations, loadError }: Props) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(
    () => organizations.filter((item) => organizationMatchesQuery(item, query)),
    [organizations, query],
  );

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PageToolbar
        start={(
          <label className="relative flex h-portal-control-default w-full min-w-0 items-center md:min-w-56 md:flex-1 lg:max-w-sm">
            <span className="sr-only">Поиск организаций</span>
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск: название, ИНН"
              aria-label="Поиск организаций"
            />
          </label>
        )}
        end={(
          <IconButton
            label="Создать организацию"
            variant="primary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-3.5" />
          </IconButton>
        )}
      />

      {loadError ? (
        <InlineAlert
          className="rounded-none border-x-0 border-t-0 border-b"
          tone="danger"
          size="compact"
        >
          {loadError}
        </InlineAlert>
      ) : null}

      <div className="min-w-0 flex-1 p-portal-4 lg:p-portal-6">
        {filtered.length === 0 ? (
          <EmptyState
            title={organizations.length === 0 ? "Организаций пока нет" : "Ничего не найдено"}
            description={
              organizations.length === 0
                ? "Создайте юридическое лицо — demo-записи не подставляются."
                : "Измените поисковый запрос."
            }
            size="compact"
            action={
              organizations.length === 0 ? (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  Создать организацию
                </Button>
              ) : null
            }
          />
        ) : (
          <DataTableFrame>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                  <DataTableHeaderCell>Форма</DataTableHeaderCell>
                  <DataTableHeaderCell>ИНН</DataTableHeaderCell>
                  <DataTableHeaderCell>Руководитель</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((org) => (
                  <DataTableRow key={org.id}>
                    <DataTableCell className="font-medium text-portal-text">
                      <Link
                        href={`/settings/organizations/${org.id}`}
                        className="text-portal-primary hover:underline"
                      >
                        {org.name}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>{org.legalForm || "—"}</DataTableCell>
                    <DataTableCell className="tabular-nums">{org.taxId || "—"}</DataTableCell>
                    <DataTableCell>{org.director || "—"}</DataTableCell>
                    <DataTableCell>
                      <StatusBadge tone={org.isActive ? "success" : "neutral"} size="compact">
                        {org.isActive ? "Активна" : "Архив"}
                      </StatusBadge>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            <ListTotals
              primary={`${filtered.length} из ${organizations.length}`}
              secondary="Юридические лица компании"
            />
          </DataTableFrame>
        )}
      </div>

      <OrganizationCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </PageLayout>
  );
}
