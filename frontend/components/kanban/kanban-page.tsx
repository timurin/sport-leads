import {
  Filter,
  LayoutGrid,
  List,
  Search,
} from "lucide-react";

import {
  KanbanBoard,
  type KanbanColumnData,
} from "@/components/kanban/kanban-board";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

type KanbanPageProps = {
  title: string;
  description: string;
  createLabel: string;
  columns: KanbanColumnData[];
};

export function KanbanPage({
  title,
  description,
  createLabel,
  columns,
}: KanbanPageProps) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button variant="primary">
            + {createLabel}
          </Button>
        }
      />

      <div className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 min-w-64 items-center gap-2 rounded-lg border border-slate-200 px-3">
            <Search size={17} className="text-slate-400" />

            <input
              type="search"
              placeholder="Поиск..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>

          <Button>
            <Filter size={16} />
            Фильтры
          </Button>

          <div className="ml-auto flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              className="rounded-md bg-slate-100 p-2 text-slate-800"
              title="Канбан"
            >
              <LayoutGrid size={17} />
            </button>

            <button
              type="button"
              className="rounded-md p-2 text-slate-400 hover:bg-slate-50"
              title="Список"
            >
              <List size={17} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <KanbanBoard columns={columns} />
      </div>
    </div>
  );
}