"use client";

import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  Factory,
  Home,
  PackageSearch,
  Settings,
  ShoppingCart,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  appSections,
  isNavigationPathActive,
} from "@/lib/navigation";

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

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[92px] shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-white">
      <Link
        href="/dashboard"
        className="flex h-[72px] items-center justify-center border-b border-slate-800"
        aria-label="MOSMADE ERP"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-950">
          <Boxes size={23} />
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-4">
        {appSections.map((section) => {
          const active = isNavigationPathActive(
            pathname,
            section.href,
          );

          const Icon =
            sectionIcons[
              section.id as keyof typeof sectionIcons
            ] ?? Boxes;

          return (
            <Link
              key={section.id}
              href={section.href}
              title={section.title}
              className={[
                "group flex min-h-[66px] flex-col items-center justify-center rounded-xl px-1 py-2 text-center transition",
                active
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-950/40"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white",
              ].join(" ")}
            >
              <Icon size={20} />

              <span className="mt-1.5 max-w-full truncate text-[10px] leading-3">
                {section.title}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-2">
        <button
          type="button"
          className="flex h-14 w-full flex-col items-center justify-center rounded-xl bg-slate-900 text-slate-300 hover:bg-slate-800"
          title="Профиль пользователя"
        >
          <span className="text-xs font-semibold">
            ТИ
          </span>
          <span className="mt-1 text-[9px] text-slate-500">
            Профиль
          </span>
        </button>
      </div>
    </aside>
  );
}