"use client";

import {
ChevronDown,
Menu,
Plus,
Search,
X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  appSections,
  getSectionByPathname,
  isNavigationPathActive,
  type NavigationGroup,
} from "@/lib/navigation";

function getNavigationItemActive(
pathname: string,
item: NavigationGroup,
): boolean {
if (
item.href &&
isNavigationPathActive(pathname, item.href)
) {
return true;
}

return Boolean(
item.children?.some((child) =>
isNavigationPathActive(pathname, child.href),
),
);
}

export function TopNavigation() {
const pathname = usePathname();
const section = getSectionByPathname(pathname);

const [openMenuId, setOpenMenuId] =
useState<string | null>(null);
const [mobileMenuOpen, setMobileMenuOpen] =
useState(false);

const [searchOpen, setSearchOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState("");

const searchInputRef =
  useRef<HTMLInputElement | null>(null);

const searchItems = useMemo(() => {
  return appSections.flatMap((appSection) => {
    const sectionItem = {
      id: `section-${appSection.id}`,
      title: appSection.title,
      description: "Раздел платформы",
      href: appSection.href,
      sectionTitle: appSection.title,
    };

    const navigationItems =
      appSection.topNavigation.flatMap((item) => {
        if (item.children?.length) {
          return item.children.map((child) => ({
            id: `${appSection.id}-${item.id}-${child.id}`,
            title: child.title,
            description:
              child.description ?? item.title,
            href: child.href,
            sectionTitle: appSection.title,
          }));
        }

        if (!item.href) {
          return [];
        }

        return [
          {
            id: `${appSection.id}-${item.id}`,
            title: item.title,
            description: appSection.title,
            href: item.href,
            sectionTitle: appSection.title,
          },
        ];
      });

    return [sectionItem, ...navigationItems];
  });
}, []);

const normalizedSearchQuery =
  searchQuery.trim().toLocaleLowerCase("ru");

const searchSuggestions = useMemo(() => {
  if (!normalizedSearchQuery) {
    return searchItems.slice(0, 8);
  }

  return searchItems
    .filter((item) => {
      const searchableText = [
        item.title,
        item.description,
        item.sectionTitle,
      ]
        .join(" ")
        .toLocaleLowerCase("ru");

      return searchableText.includes(
        normalizedSearchQuery,
      );
    })
    .slice(0, 10);
}, [
  normalizedSearchQuery,
  searchItems,
]);

const navigationRef =
useRef<HTMLDivElement | null>(null);
const mobileNavigationRef =
useRef<HTMLDivElement | null>(null);

useEffect(() => {
  const frame = window.requestAnimationFrame(() => {
    setOpenMenuId(null);
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
  });

  return () => {
    window.cancelAnimationFrame(frame);
  };
}, [pathname]);

useEffect(() => {
  if (!searchOpen) {
    return;
  }

  const frame = window.requestAnimationFrame(() => {
    searchInputRef.current?.focus();
  });

  return () => {
    window.cancelAnimationFrame(frame);
  };
}, [searchOpen]);

useEffect(() => {
function handlePointerDown(event: PointerEvent) {
const target = event.target as Node;

  const outsideDesktopNavigation =
    navigationRef.current &&
    !navigationRef.current.contains(target);

  const outsideMobileNavigation =
    mobileNavigationRef.current &&
    !mobileNavigationRef.current.contains(target);

  if (
    outsideDesktopNavigation &&
    outsideMobileNavigation
  ) {
    setOpenMenuId(null);
    setMobileMenuOpen(false);
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    setOpenMenuId(null);
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
  }
}

window.addEventListener(
  "pointerdown",
  handlePointerDown,
);
window.addEventListener("keydown", handleKeyDown);

return () => {
  window.removeEventListener(
    "pointerdown",
    handlePointerDown,
  );
  window.removeEventListener(
    "keydown",
    handleKeyDown,
  );
};

}, []);

return ( <header className="relative z-40 border-b border-slate-200 bg-white">
  {searchOpen ? (
    <div className="relative flex h-16 items-center px-3 sm:px-4 md:h-[72px] lg:px-6">
      <div className="relative w-full">
        <Search
          size={19}
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
          }}
          placeholder="Поиск по разделам и страницам..."
          className="h-11 w-full rounded-xl border border-blue-300 bg-white pl-11 pr-12 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          aria-label="Глобальный поиск"
          aria-autocomplete="list"
          aria-controls="platform-search-suggestions"
        />

        <button
          type="button"
          onClick={() => {
            setSearchOpen(false);
            setSearchQuery("");
          }}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Закрыть поиск"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div
          id="platform-search-suggestions"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-[120] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]"
          role="listbox"
        >
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-medium uppercase tracking-[0.08em] text-slate-400">
            {normalizedSearchQuery
              ? "Результаты поиска"
              : "Быстрый переход"}
          </div>

          <div className="max-h-[min(65vh,480px)] overflow-y-auto p-2">
            {searchSuggestions.length ? (
              searchSuggestions.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5 outline-none transition-colors hover:bg-slate-50 focus-visible:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500"
                  role="option"
                >
                  <Search
                    size={16}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-slate-400"
                  />

                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {item.title}
                    </span>

                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {item.sectionTitle}
                      {item.description
                        ? ` · ${item.description}`
                        : ""}
                    </span>
                  </span>
                </Link>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <div className="text-sm font-medium text-slate-700">
                  Ничего не найдено
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Попробуйте изменить поисковый запрос
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex h-16 min-w-0 items-center gap-2 px-3 sm:px-4 md:h-[72px] lg:gap-4 lg:px-6">
      <div className="min-w-0 shrink">
        <h1 className="truncate text-base font-semibold tracking-tight text-slate-950 sm:text-lg lg:min-w-[130px] lg:text-xl">
          {section.title}
        </h1>
      </div>

      <div
        ref={navigationRef}
        className="hidden h-full min-w-0 flex-1 items-center lg:flex"
      >
        <nav
          className="flex h-full min-w-0 items-center gap-0.5"
          aria-label={`Навигация раздела ${section.title}`}
        >
          {section.topNavigation.map((item) => {
            const active = getNavigationItemActive(
              pathname,
              item,
            );

            if (item.children?.length) {
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
                        menuOpen ? null : item.id,
                      );
                    }}
                    className={[
                      "flex h-full items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 xl:px-4",
                      active || menuOpen
                        ? "border-blue-600 text-blue-700"
                        : "border-transparent text-slate-600 hover:text-slate-950",
                    ].join(" ")}
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                  >
                    <span>{item.title}</span>

                    <ChevronDown
                      size={15}
                      aria-hidden="true"
                      className={[
                        "shrink-0 transition-transform",
                        menuOpen
                          ? "rotate-180"
                          : "",
                      ].join(" ")}
                    />
                  </button>

                  {menuOpen ? (
                    <div
                      className="absolute left-0 top-[calc(100%-1px)] z-[100] w-[300px] max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,0.16)]"
                      role="menu"
                    >
                      {item.children.map((child) => {
                        const childActive =
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
                              "block rounded-lg px-4 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500",
                              childActive
                                ? "bg-blue-50 text-blue-700"
                                : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                            ].join(" ")}
                            role="menuitem"
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
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }

            if (!item.href) {
              return null;
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                className={[
                  "flex h-full items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 xl:px-4",
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
          onClick={() => {
            setSearchOpen(true);
            setOpenMenuId(null);
            setMobileMenuOpen(false);
          }}
          className="hidden h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500 outline-none transition-colors hover:border-slate-300 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 xl:flex xl:w-[230px]"
          aria-label="Открыть глобальный поиск"
        >
          <Search
            size={17}
            className="shrink-0"
            aria-hidden="true"
          />

          <span className="truncate">Поиск...</span>

          <span className="ml-auto shrink-0 rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
            Ctrl K
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSearchOpen(true);
            setOpenMenuId(null);
            setMobileMenuOpen(false);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 outline-none transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-blue-500 xl:hidden"
          aria-label="Открыть глобальный поиск"
        >
          <Search size={18} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white outline-none transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:px-4"
          aria-label="Создать"
        >
          <Plus size={17} aria-hidden="true" />

          <span className="hidden sm:inline">
            Создать
          </span>

          <ChevronDown
            size={14}
            className="hidden sm:block"
            aria-hidden="true"
          />
        </button>

        <div
          ref={mobileNavigationRef}
          className="relative lg:hidden"
        >
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen((current) => !current);
              setOpenMenuId(null);
            }}
            className={[
              "flex h-10 w-10 items-center justify-center rounded-lg border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500",
              mobileMenuOpen
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950",
            ].join(" ")}
            aria-label={
              mobileMenuOpen
                ? "Закрыть навигацию раздела"
                : "Открыть навигацию раздела"
            }
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X size={19} aria-hidden="true" />
            ) : (
              <Menu size={19} aria-hidden="true" />
            )}
          </button>

          {mobileMenuOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-[100] w-[320px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-400">
                  Раздел
                </div>

                <div className="mt-1 truncate text-sm font-semibold text-slate-950">
                  {section.title}
                </div>
              </div>

              <nav
                className="max-h-[min(70vh,520px)] overflow-y-auto p-2"
                aria-label={`Мобильная навигация раздела ${section.title}`}
              >
                {section.topNavigation.map((item) => {
                  const active =
                    getNavigationItemActive(
                      pathname,
                      item,
                    );

                  if (item.children?.length) {
                    const expanded =
                      openMenuId === item.id;

                    return (
                      <div
                        key={item.id}
                        className="mb-1 last:mb-0"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(
                              expanded
                                ? null
                                : item.id,
                            );
                          }}
                          className={[
                            "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500",
                            active || expanded
                              ? "bg-blue-50 text-blue-700"
                              : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                          ].join(" ")}
                          aria-expanded={expanded}
                        >
                          <span className="min-w-0 truncate">
                            {item.title}
                          </span>

                          <ChevronDown
                            size={16}
                            className={[
                              "shrink-0 transition-transform",
                              expanded
                                ? "rotate-180"
                                : "",
                            ].join(" ")}
                            aria-hidden="true"
                          />
                        </button>

                        {expanded ? (
                          <div className="mt-1 space-y-1 border-l border-slate-200 pl-3">
                            {item.children.map(
                              (child) => {
                                const childActive =
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
                                      setMobileMenuOpen(
                                        false,
                                      );
                                    }}
                                    className={[
                                      "block rounded-lg px-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500",
                                      childActive
                                        ? "bg-blue-50 font-medium text-blue-700"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                                    ].join(" ")}
                                  >
                                    <span className="block">
                                      {child.title}
                                    </span>

                                    {child.description ? (
                                      <span className="mt-1 block text-xs leading-4 text-slate-500">
                                        {
                                          child.description
                                        }
                                      </span>
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

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => {
                        setMobileMenuOpen(false);
                      }}
                      className={[
                        "mb-1 block rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors last:mb-0 focus-visible:ring-2 focus-visible:ring-blue-500",
                        active
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                      ].join(" ")}
                    >
                      {item.title}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )}
</header>
);
}
