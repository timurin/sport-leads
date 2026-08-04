"use client";

import Link from "next/link";
import { FilterX, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { createPlatformCity } from "@/app/(workspace)/settings/platform-directories/platform-directory-actions";
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
import { Checkbox, Field, Input } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  emptyPlatformCityDraft,
  filterPlatformCities,
  validatePlatformCityDraft,
  type PlatformCity,
  type PlatformCityDraft,
} from "@/lib/platform-directories";

export function PlatformCitiesWorkspace({
  cities: initialCities,
  canWrite,
}: {
  cities: PlatformCity[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [rows, setRows] = useState(initialCities);
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [draft, setDraft] = useState<PlatformCityDraft>(emptyPlatformCityDraft);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterPlatformCities(rows, query, activeOnly),
    [rows, query, activeOnly],
  );

  const create = async () => {
    if (!canWrite) return;
    setError(null);
    const validation = validatePlatformCityDraft(draft);
    if (validation) {
      setError(validation);
      return;
    }
    setCreating(true);
    const result = await createPlatformCity(draft);
    setCreating(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setRows((current) =>
      [...current, result.city].sort((a, b) =>
        a.sort_order === b.sort_order
          ? a.name.localeCompare(b.name, "ru")
          : a.sort_order - b.sort_order,
      ),
    );
    setDraft(emptyPlatformCityDraft());
    pushToast("Город создан", "success");
    router.refresh();
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageToolbar
        start={
          <>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по городу или региону"
              className="min-w-0 w-full flex-1"
              aria-label="Поиск городов"
            />
            <label className="flex items-center gap-portal-2 text-portal-caption text-portal-muted">
              <Checkbox
                checked={activeOnly}
                onChange={(event) => setActiveOnly(event.target.checked)}
                aria-label="Только активные"
              />
              Только активные
            </label>
          </>
        }
        end={
          <div className="flex flex-wrap items-center gap-1">
            <IconButton
              label="Сбросить фильтры"
              variant="secondary"
              className="flex-none"
              onClick={() => {
                setQuery("");
                setActiveOnly(false);
              }}
            >
              <FilterX className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto bg-portal-surface">
        <div className="border-b border-portal-border px-portal-4 py-portal-3 sm:px-portal-6">
          <p className="mb-portal-2 text-portal-caption text-portal-muted">
            <Link href="/settings/platform-directories" className="text-portal-primary hover:underline">
              Справочники платформы
            </Link>
            {" · "}
            Города
          </p>
          {canWrite ? (
            <div className="grid gap-portal-3 md:grid-cols-[1fr_1fr_auto]">
              <Field label="Название" htmlFor="city-create-name">
                <Input
                  id="city-create-name"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  disabled={creating}
                />
              </Field>
              <Field label="Регион" htmlFor="city-create-region">
                <Input
                  id="city-create-region"
                  value={draft.region}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      region: event.target.value,
                    }))
                  }
                  disabled={creating}
                />
              </Field>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="primary"
                  disabled={creating}
                  onClick={() => void create()}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {creating ? "Создание…" : "Добавить"}
                </Button>
              </div>
            </div>
          ) : null}
          {error ? (
            <p className="mt-portal-2 text-portal-caption text-portal-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Нет городов"
            description={
              rows.length === 0
                ? "Добавьте первый город или примените миграцию seed."
                : "Измените поиск или снимите фильтр «Только активные»."
            }
          />
        ) : (
          <>
            <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
              <DataTable minWidthClassName="min-w-[640px]">
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell>Город</DataTableHeaderCell>
                    <DataTableHeaderCell>Регион</DataTableHeaderCell>
                    <DataTableHeaderCell className="w-28">Статус</DataTableHeaderCell>
                    <DataTableHeaderCell className="w-24">Порядок</DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {filtered.map((city) => (
                    <DataTableRow key={city.id}>
                      <DataTableCell>
                        <Link
                          href={`/settings/platform-directories/cities/${city.id}`}
                          className="font-medium text-portal-primary hover:underline"
                        >
                          {city.name}
                        </Link>
                      </DataTableCell>
                      <DataTableCell className="text-portal-muted">
                        {city.region || "—"}
                      </DataTableCell>
                      <DataTableCell>
                        <StatusBadge
                          size="compact"
                          tone={city.is_active ? "success" : "neutral"}
                        >
                          {city.is_active ? "Активен" : "Выкл."}
                        </StatusBadge>
                      </DataTableCell>
                      <DataTableCell>{city.sort_order}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTableFrame>
            <ListTotals
              className="border-t border-portal-border px-portal-4 py-portal-3 sm:px-portal-6"
              primary={`${filtered.length} из ${rows.length}`}
            />
          </>
        )}
      </div>
    </div>
  );
}
