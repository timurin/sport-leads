"use client";

import {
  BarChart3,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Factory,
  Home,
  Menu,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingCart,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  appSections,
  isNavigationPathActive,
  type AppSection,
  type NavigationGroup,
} from "@/lib/navigation";

type SidebarMode = "expanded" | "compact" | "hidden";

const SIDEBAR_STORAGE_KEY = "sport-lead-sidebar-mode";

const sectionIcons = {
  dashboard: Home,
  sales: CircleDollarSign,
  production: Factory,
  warehouse: Warehouse,
  purchases: ShoppingCart,
  finance: PackageSearch,
  analytics: BarChart3,
  settings: Settings,
};

function getSectionLinks(section: AppSection) {
  return section.topNavigation.flatMap((group) => {
    if (group.href) {
      return [
        {
          id: group.id,
          title: group.title,
          href: group.href,
        },
      ];
    }

    return group.children ?? [];
  });
}

function isSectionContentActive(
  pathname: string,
  section: AppSection,
) {
  if (isNavigationPathActive(pathname, section.href)) {
    return true;
  }

  return getSectionLinks(section).some((link) =>
    isNavigationPathActive(pathname, link.href),
  );
}

function NavigationGroupContent({
  group,
  pathname,
}: {
  group: NavigationGroup;
  pathname: string;
}) {
  if (group.href) {
    const active = isNavigationPathActive(
      pathname,
      group.href,
    );

    return (
      <Link
        href={group.href}
        aria-current={active ? "page" : undefined}
        className={[
          "relative flex min-h-9 min-w-0 items-center rounded-lg px-3 pl-8",
          "text-[12px] transition-colors",
          active
            ? "bg-portal-primary-soft font-bold text-portal-primary-hover"
            : "text-[color:var(--portal-shell-nav)] hover:bg-portal-page hover:text-portal-text",
        ].join(" ")}
      >
        {active ? (
          <span
            aria-hidden="true"
            className="absolute bottom-2 left-3 top-2 w-0.5 rounded-r bg-portal-primary"
          />
        ) : null}

        <span className="min-w-0 flex-1 truncate">
  {group.title}
</span>
      </Link>
    );
  }

  if (!group.children?.length) {
    return null;
  }

  return (
    <div className="mt-2">
      <div
  className="
  mx-1 mb-1.5 mt-2
  min-w-0 rounded-md
  border border-[color:var(--portal-shell-group-line)]
  bg-portal-surface-secondary
  px-3 py-2
  text-[11px] font-bold
  leading-4 text-[color:var(--portal-shell-group-title)]
  "
>
  {group.title}
</div>

      <div className="grid gap-0.5">
        {group.children.map((child) => {
          const active = isNavigationPathActive(
            pathname,
            child.href,
          );

          return (
            <Link
              key={child.id}
              href={child.href}
              aria-current={active ? "page" : undefined}
              className={[
                "relative flex min-h-9 items-center rounded-lg px-3 pl-10",
                "text-[12px] transition-colors",
                active
                  ? "bg-portal-primary-soft font-bold text-portal-primary-hover"
                  : "text-[color:var(--portal-shell-nav)] hover:bg-portal-page hover:text-portal-text",
              ].join(" ")}
            >
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute bottom-2 left-3 top-2 w-0.5 rounded-r bg-portal-primary"
                />
              ) : null}

              <span className="min-w-0 flex-1 truncate">
  {child.title}
</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  const activeSectionId = useMemo(() => {
    return (
      appSections.find((section) =>
        isSectionContentActive(pathname, section),
      )?.id ?? "dashboard"
    );
  }, [pathname]);

  const [mode, setMode] =
    useState<SidebarMode>("expanded");

  const [openSections, setOpenSections] = useState<
    Set<string>
  >(() => new Set([activeSectionId]));

useEffect(() => {
  const storedMode = window.localStorage.getItem(
    SIDEBAR_STORAGE_KEY,
  );

  if (
    storedMode !== "expanded" &&
    storedMode !== "compact" &&
    storedMode !== "hidden"
  ) {
    return;
  }

  const frame = window.requestAnimationFrame(() => {
    setMode(storedMode);
  });

  return () => {
    window.cancelAnimationFrame(frame);
  };
}, []);

useEffect(() => {
  const frame = window.requestAnimationFrame(() => {
    setOpenSections((current) => {
      if (current.has(activeSectionId)) {
        return current;
      }

      return new Set([
        ...current,
        activeSectionId,
      ]);
    });
  });

  return () => {
    window.cancelAnimationFrame(frame);
  };
}, [activeSectionId]);

function updateMode(nextMode: SidebarMode) {
  setMode(nextMode);

  window.localStorage.setItem(
    SIDEBAR_STORAGE_KEY,
    nextMode,
  );
}

  function toggleSection(sectionId: string) {
    setOpenSections((current) => {
      const next = new Set(current);

      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }

      return next;
    });
  }

  if (mode === "hidden") {
    return (
      <button
        type="button"
        onClick={() => updateMode("expanded")}
        className="
          fixed left-3 top-3 z-portal-shell-float
          hidden size-10 items-center justify-center md:flex
          rounded-[var(--portal-shell-radius)] border border-portal-border
          bg-portal-surface text-[color:var(--portal-shell-nav)]
          shadow-md transition-colors
          hover:bg-portal-page hover:text-portal-primary-hover
        "
        title="Показать меню"
        aria-label="Показать меню"
      >
        <Menu size={20} />
      </button>
    );
  }

  const expanded = mode === "expanded";

  return (
    <aside
      data-platform-sidebar
      data-sidebar-mode={mode}
      className={[
        // Mobile (≤767): sidebar hidden — navigation via topbar menu (DS-SHELL-02).
        "hidden h-full shrink-0 flex-col md:flex",
        "border-r border-portal-border bg-portal-surface text-[color:var(--portal-shell-ink)]",
        "transition-[width] duration-200 ease-out",
        expanded
          ? "w-[var(--portal-shell-sidebar-expanded)]"
          : "w-[var(--portal-shell-sidebar-compact)]",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-[var(--portal-shell-topbar)] shrink-0 items-center border-b border-portal-border",
          expanded
            ? "justify-between px-3"
            : "justify-center px-2",
        ].join(" ")}
      >
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center"
          aria-label="SPORT-LEAD"
        >
          <span
            className="
              flex size-10 shrink-0 items-center justify-center
              rounded-lg bg-gradient-to-br
              from-[var(--portal-primary-gradient-from)] to-[var(--portal-primary-gradient-to)]
              text-sm font-extrabold text-portal-primary-on shadow-sm
            "
          >
            SL
          </span>

          {expanded ? (
            <span className="ml-3 min-w-0">
              <span className="block truncate text-[15px] font-extrabold tracking-[0.01em] text-portal-text">
                SPORT-LEAD
              </span>

              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-portal-subtle">
                ERP Platform
              </span>
            </span>
          ) : null}
        </Link>

        {expanded ? (
          <button
            type="button"
            onClick={() => updateMode("compact")}
            className="
              ml-2 flex size-8 shrink-0 items-center
              justify-center rounded-lg text-portal-subtle
              transition-colors
              hover:bg-portal-page hover:text-portal-primary-hover
            "
            title="Свернуть меню"
            aria-label="Свернуть меню"
          >
            <PanelLeftClose size={18} />
          </button>
        ) : null}
      </div>

      <nav
  className={[
    "min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-4",
    expanded ? "px-3" : "px-2",
  ].join(" ")}
>
        {expanded ? (
          <div className="mb-2 px-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-portal-subtle">
            Разделы
          </div>
        ) : null}

        <div className="grid gap-1">
          {appSections.map((section) => {
            const active = isSectionContentActive(
              pathname,
              section,
            );

            const open =
              openSections.has(section.id);

            const Icon =
              sectionIcons[
                section.id as keyof typeof sectionIcons
              ] ?? Boxes;

            if (!expanded) {
              return (
                <Link
                  key={section.id}
                  href={section.href}
                  title={section.title}
                  aria-current={
                    active ? "page" : undefined
                  }
                  className={[
                    "relative flex min-h-10 items-center justify-center rounded-[var(--portal-shell-radius)] px-2",
                    "transition-colors",
                    active
                      ? "bg-portal-primary-soft font-bold text-portal-primary-hover"
                      : "text-[color:var(--portal-shell-nav)] hover:bg-portal-page hover:text-portal-text",
                  ].join(" ")}
                >
                  <Icon
                    size={19}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                </Link>
              );
            }

            return (
              <div key={section.id}>
                {section.topNavigation.length > 0 ? (
  <button
    type="button"
    onClick={() => toggleSection(section.id)}
    aria-expanded={open}
    className={[
      "group flex min-h-10 w-full items-center rounded-[var(--portal-shell-radius)]",
      "px-3 py-2 text-left transition-colors",
      active
        ? "bg-portal-primary-soft text-portal-primary-hover"
        : "text-[color:var(--portal-shell-nav)] hover:bg-portal-page hover:text-portal-text",
    ].join(" ")}
  >
    <Icon
      size={19}
      strokeWidth={active ? 2.2 : 1.8}
      className="shrink-0"
    />

    <span
      className={[
        "ml-3 min-w-0 flex-1 truncate text-[13px]",
        active ? "font-bold" : "font-medium",
      ].join(" ")}
    >
      {section.title}
    </span>

    <span
      className="
        ml-2 flex size-7 shrink-0 items-center
        justify-center rounded-lg text-portal-subtle
        transition-colors
        group-hover:bg-portal-surface/80
        group-hover:text-portal-primary-hover
      "
    >
      {open ? (
        <ChevronDown size={16} />
      ) : (
        <ChevronRight size={16} />
      )}
    </span>
  </button>
) : (
  <Link
    href={section.href}
    aria-current={active ? "page" : undefined}
    className={[
      "group flex min-h-10 items-center rounded-[var(--portal-shell-radius)]",
      "px-3 py-2 transition-colors",
      active
        ? "bg-portal-primary-soft font-bold text-portal-primary-hover"
        : "text-[color:var(--portal-shell-nav)] hover:bg-portal-page hover:text-portal-text",
    ].join(" ")}
  >
    <Icon
      size={19}
      strokeWidth={active ? 2.2 : 1.8}
      className="shrink-0"
    />

    <span className="ml-3 min-w-0 flex-1 truncate text-[13px]">
      {section.title}
    </span>
  </Link>
)}

                {open &&
                section.topNavigation.length > 0 ? (
                  <div className="mt-1 pb-1">
                    {section.topNavigation.map(
                      (group) => (
                        <NavigationGroupContent
                          key={group.id}
                          group={group}
                          pathname={pathname}
                        />
                      ),
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-portal-border p-2">
        {!expanded ? (
          <button
            type="button"
            onClick={() => updateMode("expanded")}
            className="
              mb-1 flex min-h-10 w-full items-center
              justify-center rounded-[var(--portal-shell-radius)]
              text-[color:var(--portal-shell-nav)] transition-colors
              hover:bg-portal-page hover:text-portal-primary-hover
            "
            title="Развернуть меню"
            aria-label="Развернуть меню"
          >
            <PanelLeftOpen size={18} />
          </button>
        ) : null}

{expanded ? (
  <button
    type="button"
    onClick={() => updateMode("compact")}
    className="
      flex min-h-10 w-full items-center
      justify-start rounded-[var(--portal-shell-radius)] px-3
      text-[color:var(--portal-shell-nav)] transition-colors
      hover:bg-portal-page hover:text-portal-primary-hover
    "
    title="Свернуть меню"
    aria-label="Свернуть меню"
  >
    <PanelLeftClose size={18} />

    <span className="ml-3 text-[12px] font-semibold">
      Свернуть меню
    </span>
  </button>
) : null}

        <button
          type="button"
          className={[
            "mt-1 flex min-h-11 w-full items-center rounded-[var(--portal-shell-radius)]",
            "text-[color:var(--portal-shell-nav)] transition-colors",
            "hover:bg-portal-page hover:text-portal-text",
            expanded
              ? "justify-start px-3"
              : "justify-center px-2",
          ].join(" ")}
          title="Профиль пользователя"
        >
          <span
            className="
              flex size-8 shrink-0 items-center justify-center
              rounded-lg bg-[var(--portal-shell-avatar-bg)]
              text-[11px] font-extrabold text-[color:var(--portal-shell-avatar-fg)]
            "
          >
            ТИ
          </span>

          {expanded ? (
            <span className="ml-3 min-w-0 flex-1 text-left">
              <span className="block truncate text-[12px] font-bold text-portal-text">
                Тимур
              </span>

              <span className="block truncate text-[10px] text-portal-subtle">
                Администратор
              </span>
            </span>
          ) : null}
        </button>
      </div>
    </aside>
  );
}