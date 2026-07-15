"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  getSectionByPathname,
  isNavigationPathActive,
} from "@/lib/navigation";

export function TopNavigation() {
  const pathname = usePathname();
  const section = getSectionByPathname(pathname);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-6 px-6">
        <div className="min-w-40">
          <div className="text-lg font-semibold text-slate-950">
            {section.title}
          </div>
        </div>

        <nav className="flex h-full min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {section.topNavigation.map((item) => {
            if (item.children?.length) {
              const childActive = item.children.some(
                (child) =>
                  isNavigationPathActive(
                    pathname,
                    child.href,
                  ),
              );

              return (
                <details
                  key={item.id}
                  className="group relative h-full"
                >
                  <summary
                    className={[
                      "flex h-full cursor-pointer list-none items-center gap-2 border-b-2 px-4 text-sm font-medium transition",
                      childActive
                        ? "border-blue-600 text-blue-700"
                        : "border-transparent text-slate-600 hover:text-slate-950",
                    ].join(" ")}
                  >
                    {item.title}
                    <span className="text-xs">▾</span>
                  </summary>

                  <div className="absolute left-0 top-[calc(100%+1px)] z-50 min-w-72 rounded-b-xl border border-slate-200 bg-white p-2 shadow-xl">
                    {item.children.map((child) => (
                      <Link
                        key={child.id}
                        href={child.href}
                        className={[
                          "block rounded-lg px-4 py-3 transition",
                          isNavigationPathActive(
                            pathname,
                            child.href,
                          )
                            ? "bg-blue-50 text-blue-700"
                            : "text-slate-700 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <div className="text-sm font-medium">
                          {child.title}
                        </div>

                        {child.description ? (
                          <div className="mt-1 text-xs leading-4 text-slate-500">
                            {child.description}
                          </div>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                </details>
              );
            }

            if (!item.href) {
              return null;
            }

            const active = isNavigationPathActive(
              pathname,
              item.href,
            );

            return (
              <Link
                key={item.id}
                href={item.href}
                className={[
                  "flex h-full items-center border-b-2 px-4 text-sm font-medium transition",
                  active
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-600 hover:text-slate-950",
                ].join(" ")}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Поиск
          </button>

          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            + Создать
          </button>
        </div>
      </div>
    </header>
  );
}