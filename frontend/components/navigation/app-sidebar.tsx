"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  appSections,
  isNavigationPathActive,
} from "@/lib/navigation";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-20 shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-white">
      <Link
        href="/dashboard"
        className="flex h-16 items-center justify-center border-b border-slate-800"
        aria-label="MOSMADE ERP"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold">
          M
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 py-4">
        {appSections.map((section) => {
          const active = isNavigationPathActive(
            pathname,
            section.href,
          );

          return (
            <Link
              key={section.id}
              href={section.href}
              title={section.title}
              className={[
                "group flex min-h-14 flex-col items-center justify-center rounded-xl px-1 py-2 text-center transition",
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white",
              ].join(" ")}
            >
              <span className="text-sm font-semibold">
                {section.shortTitle}
              </span>

              <span className="mt-1 max-w-full truncate text-[10px] leading-3">
                {section.title}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-2">
        <button
          type="button"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-xs font-semibold text-slate-300"
          title="Профиль пользователя"
        >
          ТИ
        </button>
      </div>
    </aside>
  );
}