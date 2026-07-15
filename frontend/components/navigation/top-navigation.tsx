"use client";

import {
  ChevronDown,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getSectionByPathname,
  isNavigationPathActive,
} from "@/lib/navigation";

export function TopNavigation() {
  const pathname = usePathname();
  const section = getSectionByPathname(pathname);

  const [openMenuId, setOpenMenuId] =
    useState<string | null>(null);

  const navigationRef =
    useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    function handlePointerDown(
      event: PointerEvent,
    ) {
      if (
        navigationRef.current &&
        !navigationRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpenMenuId(null);
      }
    }

    window.addEventListener(
      "pointerdown",
      handlePointerDown,
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );
    };
  }, []);

  return (
    <header className="relative z-40 overflow-visible border-b border-slate-200 bg-white">
      <div className="flex h-[72px] items-center gap-5 px-6">
        <div className="min-w-[150px]">
          <div className="text-xl font-semibold tracking-tight text-slate-950">
            {section.title}
          </div>
        </div>

        <div
          ref={navigationRef}
          className="flex h-full min-w-0 flex-1 items-center"
        >
          <nav className="flex h-full items-center gap-1 overflow-visible">
            {section.topNavigation.map((item) => {
              if (item.children?.length) {
                const childActive =
                  item.children.some((child) =>
                    isNavigationPathActive(
                      pathname,
                      child.href,
                    ),
                  );

                const menuOpen =
                  openMenuId === item.id;

                return (
                  <div
                    key={item.id}
                    className="relative flex h-full items-center"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuId(
                          menuOpen
                            ? null
                            : item.id,
                        );
                      }}
                      className={[
                        "flex h-full items-center gap-1.5 border-b-2 px-4 text-sm font-medium transition",
                        childActive || menuOpen
                          ? "border-blue-600 text-blue-700"
                          : "border-transparent text-slate-600 hover:text-slate-950",
                      ].join(" ")}
                      aria-expanded={menuOpen}
                    >
                      {item.title}

                      <ChevronDown
                        size={15}
                        className={[
                          "transition-transform",
                          menuOpen
                            ? "rotate-180"
                            : "",
                        ].join(" ")}
                      />
                    </button>

                    {menuOpen ? (
                      <div className="absolute left-0 top-[calc(100%-1px)] z-[100] w-[300px] rounded-xl border border-slate-200 bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
                        {item.children.map(
                          (child) => {
                            const active =
                              isNavigationPathActive(
                                pathname,
                                child.href,
                              );

                            return (
                             <Link
                                key={child.id}
                                href={child.href}
                                onClick={() => {
                                  setOpenMenuId(null);
                                }}
                                className={[
                                  "block rounded-lg px-4 py-3 transition",
                                  active
                                    ? "bg-blue-50 text-blue-700"
                                    : "text-slate-700 hover:bg-slate-50",
                                ].join(" ")}
                              >
                                <div className="text-sm font-medium">
                                  {child.title}
                                </div>

                                {child.description ? (
                                  <div className="mt-1 text-xs leading-4 text-slate-500">
                                    {
                                      child.description
                                    }
                                  </div>
                                ) : null}
                              </Link>
                            );
                          },
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (!item.href) {
                return null;
              }

              const active =
                isNavigationPathActive(
                  pathname,
                  item.href,
                );

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={[
                    "flex h-full items-center whitespace-nowrap border-b-2 px-4 text-sm font-medium transition",
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
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="hidden h-10 min-w-[230px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-400 hover:border-slate-300 xl:flex"
          >
            <Search size={17} />
            <span>Поиск...</span>

            <span className="ml-auto rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
              Ctrl K
            </span>
          </button>

          <button
            type="button"
            className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus size={17} />
            Создать
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}