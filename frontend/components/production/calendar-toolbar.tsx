import Link from "next/link";

import { CALENDAR_TOOLBAR } from "@/lib/production/calendar";

export function CalendarToolbar({ current }: { current: string }) {
  return (
    <nav aria-label="Разделы производственного календаря" className="flex flex-wrap gap-1">
      {CALENDAR_TOOLBAR.map((item) => {
        const active = item.href === current;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-[#edf3ff] text-[#1f5eff]" : "text-[#475467] hover:bg-[#f8fafc]"}`}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
