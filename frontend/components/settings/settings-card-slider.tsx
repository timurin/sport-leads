"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "@/components/ui/button";

/**
 * Bitrix-style overlay (same chrome as the lead card): previous page stays dimmed.
 * Soft nav to `/settings` intercepts; hard refresh of `/settings` stays a full page.
 */
export function SettingsCardSlider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const close = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/dashboard");
  }, [router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (document.querySelector("[data-lead-event-modal]")) return;
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-portal-modal-2">
      <button
        type="button"
        className="absolute inset-0 bg-[#101828]/45"
        aria-label="Закрыть настройки"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Настройки платформы"
        data-settings-card-slider
        className="absolute inset-y-0 right-0 flex w-[min(100%,calc(100vw-3.25rem))] flex-col bg-portal-page shadow-portal-overlay lg:w-[92%]"
      >
        <div className="absolute left-0 top-3 z-10 -translate-x-1/2">
          <IconButton
            label="Закрыть"
            onClick={close}
            className="border border-portal-border bg-portal-surface shadow-portal-sm"
          >
            <X size={18} aria-hidden="true" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
