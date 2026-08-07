"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { WorkTaskCreateDrawer } from "@/components/sales/work-task-create-drawer";
import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/form-controls";
import { PageToolbar } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import {
  buildWorkTasksListHref,
  workTaskAnchorTypeLabels,
  workTaskStatusLabels,
  type WorkTaskListFilters,
  type WorkTaskListItem,
} from "@/lib/work-tasks";

type FilterOption = { id: number; label: string };

type Props = {
  tasks: WorkTaskListItem[];
  filters: WorkTaskListFilters;
  stages: FilterOption[];
  users: FilterOption[];
  leads: FilterOption[];
  orders: FilterOption[];
  productionOrders: FilterOption[];
  loadError?: string | null;
};

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-[9rem] flex-col gap-1 text-xs text-portal-muted">
      <span>{label}</span>
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        size="compact"
        aria-label={label}
      >
        {children}
      </Select>
    </label>
  );
}

export function WorkTasksWorkspace({
  tasks,
  filters,
  stages,
  users,
  leads,
  orders,
  productionOrders,
  loadError = null,
}: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  const pushFilters = (patch: Partial<WorkTaskListFilters>) => {
    const next: WorkTaskListFilters = { ...filters, ...patch };
    for (const key of Object.keys(patch) as Array<keyof WorkTaskListFilters>) {
      const value = patch[key];
      if (value === "" || value == null) {
        delete next[key];
      }
    }
    router.push(buildWorkTasksListHref(next));
  };

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <WorkTaskCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        stages={stages}
        users={users}
        leads={leads}
        orders={orders}
        productionOrders={productionOrders}
      />
      <PageToolbar
        start={
          <div className="flex min-w-0 flex-col gap-portal-3">
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-portal-text">Задачи</h1>
              <p className="text-sm text-portal-muted">
                Постановка в цех: статус, ответственный, исполнитель
              </p>
            </div>
            <div className="flex flex-wrap gap-portal-2">
              <FilterSelect
                label="Статус"
                value={filters.status ?? ""}
                onChange={(value) =>
                  pushFilters({ status: value || undefined })
                }
              >
                <option value="">Все</option>
                {Object.entries(workTaskStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                label="Объект"
                value={filters.anchor_type ?? ""}
                onChange={(value) =>
                  pushFilters({ anchor_type: value || undefined })
                }
              >
                <option value="">Все</option>
                {Object.entries(workTaskAnchorTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                label="Цех"
                value={
                  filters.production_stage_id != null
                    ? String(filters.production_stage_id)
                    : ""
                }
                onChange={(value) =>
                  pushFilters({
                    production_stage_id: value ? Number(value) : undefined,
                  })
                }
              >
                <option value="">Все</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                label="Ответственный"
                value={
                  filters.responsible_platform_user_id != null
                    ? String(filters.responsible_platform_user_id)
                    : ""
                }
                onChange={(value) =>
                  pushFilters({
                    responsible_platform_user_id: value
                      ? Number(value)
                      : undefined,
                  })
                }
              >
                <option value="">Все</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.label}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                label="Исполнитель"
                value={
                  filters.executor_platform_user_id != null
                    ? String(filters.executor_platform_user_id)
                    : ""
                }
                onChange={(value) =>
                  pushFilters({
                    executor_platform_user_id: value ? Number(value) : undefined,
                  })
                }
              >
                <option value="">Все</option>
                {users.map((user) => (
                  <option key={`ex-${user.id}`} value={user.id}>
                    {user.label}
                  </option>
                ))}
              </FilterSelect>
            </div>
          </div>
        }
        end={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Новая задача
          </Button>
        }
      />
      <PageContent className="space-y-portal-4 p-portal-4 sm:p-portal-6">
        {loadError ? (
          <EmptyState title="Не удалось загрузить задачи" description={loadError} />
        ) : tasks.length === 0 ? (
          <EmptyState
            title="Задач не найдено"
            description="Измените фильтры или создайте задачу кнопкой «Новая задача»."
            action={
              <Button type="button" onClick={() => setCreateOpen(true)}>
                Новая задача
              </Button>
            }
          />
        ) : (
          <SectionCard title="Список задач" description={`${tasks.length} записей`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-portal-border text-portal-muted">
                  <tr>
                    <th className="px-2 py-2 font-medium">Задача</th>
                    <th className="px-2 py-2 font-medium">Статус</th>
                    <th className="px-2 py-2 font-medium">Цех</th>
                    <th className="px-2 py-2 font-medium">Ответственный</th>
                    <th className="px-2 py-2 font-medium">Исполнитель</th>
                    <th className="px-2 py-2 font-medium">Объект</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr
                      key={task.id}
                      className="border-b border-portal-border/70 last:border-0"
                    >
                      <td className="px-2 py-2.5">
                        <Link
                          href={task.href}
                          className="font-medium text-portal-text underline-offset-2 hover:underline"
                        >
                          {task.title}
                        </Link>
                      </td>
                      <td className="px-2 py-2.5 text-portal-text">{task.statusLabel}</td>
                      <td className="px-2 py-2.5 text-portal-muted">{task.workshopLabel}</td>
                      <td className="px-2 py-2.5 text-portal-muted">
                        {task.responsibleLabel}
                      </td>
                      <td className="px-2 py-2.5 text-portal-muted">{task.executorLabel}</td>
                      <td className="px-2 py-2.5">
                        {task.objectHref ? (
                          <Link
                            href={task.objectHref}
                            className="text-portal-text underline-offset-2 hover:underline"
                          >
                            {task.objectLabel}
                          </Link>
                        ) : (
                          <span className="text-portal-muted">{task.objectLabel}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </PageContent>
    </PageLayout>
  );
}
