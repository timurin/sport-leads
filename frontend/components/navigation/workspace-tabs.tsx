"use client";

import { usePathname } from "next/navigation";

import { getSectionByPathname } from "@/lib/navigation";

export function WorkspaceTabs() {
  const pathname = usePathname();
  const section = getSectionByPathname(pathname);

  return (
    <div className="flex h-11 items-end gap-1 border-b border-slate-200 bg-slate-100 px-4">
      <div className="flex h-9 items-center gap-3 rounded-t-lg border border-b-0 border-slate-200 bg-white px-4 text-sm text-slate-700">
        <span>{section.title}</span>

        <button
          type="button"
          className="text-slate-400 hover:text-slate-700"
          aria-label="Закрыть вкладку"
        >
          ×
        </button>
      </div>

      <button
        type="button"
        className="mb-1 flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200"
        title="Открыть новую вкладку"
      >
        +
      </button>
    </div>
  );
}