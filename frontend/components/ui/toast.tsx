"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { IconButton } from "@/components/ui/button";
import { X } from "lucide-react";

export type ToastTone = "neutral" | "success" | "warning" | "danger";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  push: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClasses: Record<ToastTone, string> = {
  neutral: "border-portal-border bg-portal-surface text-portal-text",
  success: "border-portal-success/30 bg-portal-success-soft text-portal-success",
  warning: "border-portal-warning/30 bg-portal-warning-soft text-portal-warning",
  danger: "border-portal-danger/30 bg-portal-danger-soft text-portal-danger",
};

const AUTO_DISMISS_MS = 4200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastTone = "neutral") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-portal-6 right-portal-6 z-portal-toast flex w-full max-w-sm flex-col gap-portal-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={[
              "pointer-events-auto flex items-start gap-portal-3 rounded-portal-lg border px-portal-4 py-portal-3 text-portal-body font-medium shadow-portal-overlay",
              toneClasses[item.tone],
            ].join(" ")}
          >
            <p className="min-w-0 flex-1">{item.message}</p>
            <IconButton
              label="Закрыть уведомление"
              className="shrink-0"
              onClick={() => {
                setItems((current) => current.filter((entry) => entry.id !== item.id));
              }}
            >
              <X size={16} aria-hidden="true" />
            </IconButton>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
