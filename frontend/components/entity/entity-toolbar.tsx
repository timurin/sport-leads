import {
  Filter,
  LayoutGrid,
  List,
  Plus,
  Search,
  Settings2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type EntityToolbarProps = {
  searchPlaceholder?: string;
  createLabel?: string;
  view?: "table" | "kanban";
  onViewChange?: (
    view: "table" | "kanban",
  ) => void;
};

export function EntityToolbar({
  searchPlaceholder = "Поиск...",
  createLabel = "Добавить",
  view = "table",
  onViewChange,
}: EntityToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex h-10 min-w-[280px] items-center gap-2 rounded-lg border border-slate-200 px-3">
        <Search
          size={17}
          className="text-slate-400"
        />

        <input
          type="search"
          placeholder={searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <Button>
        <Filter size={16} />
        Фильтры
      </Button>

      <Button>
        <Settings2 size={16} />
        Настроить
      </Button>

      <div className="ml-auto flex rounded-lg border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => onViewChange?.("kanban")}
          className={[
            "rounded-md p-2 transition",
            view === "kanban"
              ? "bg-slate-100 text-slate-900"
              : "text-slate-400 hover:bg-slate-50",
          ].join(" ")}
          title="Канбан"
        >
          <LayoutGrid size={17} />
        </button>

        <button
          type="button"
          onClick={() => onViewChange?.("table")}
          className={[
            "rounded-md p-2 transition",
            view === "table"
              ? "bg-slate-100 text-slate-900"
              : "text-slate-400 hover:bg-slate-50",
          ].join(" ")}
          title="Список"
        >
          <List size={17} />
        </button>
      </div>

      <Button variant="primary">
        <Plus size={17} />
        {createLabel}
      </Button>
    </div>
  );
}