"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { EmployeeDraft } from "@/lib/settings/employees";

type EmployeeNavStore = {
  drafts: Record<number, EmployeeDraft>;
  setDraft: (employeeId: number, draft: EmployeeDraft) => void;
  clearDraft: (employeeId: number) => void;
  scrollTop: number;
  setScrollTop: (value: number) => void;
};

const EmployeeNavContext = createContext<EmployeeNavStore | null>(null);

export function EmployeeNavProvider({ children }: { children: React.ReactNode }) {
  const [drafts, setDrafts] = useState<Record<number, EmployeeDraft>>({});
  const [scrollTop, setScrollTop] = useState(0);
  const value = useMemo<EmployeeNavStore>(
    () => ({
      drafts,
      setDraft: (employeeId, draft) => {
        setDrafts((current) => ({ ...current, [employeeId]: draft }));
      },
      clearDraft: (employeeId) => {
        setDrafts((current) => {
          const next = { ...current };
          delete next[employeeId];
          return next;
        });
      },
      scrollTop,
      setScrollTop,
    }),
    [drafts, scrollTop],
  );
  return <EmployeeNavContext.Provider value={value}>{children}</EmployeeNavContext.Provider>;
}

export function useEmployeeNav(): EmployeeNavStore | null {
  return useContext(EmployeeNavContext);
}

const LayerDirtyContext = createContext<((dirty: boolean) => void) | null>(null);

export function LayerDirtyProvider({
  onDirty,
  children,
}: {
  onDirty: (dirty: boolean) => void;
  children: React.ReactNode;
}) {
  return <LayerDirtyContext.Provider value={onDirty}>{children}</LayerDirtyContext.Provider>;
}

export function useReportDirty(dirty: boolean): void {
  const report = useContext(LayerDirtyContext);
  useEffect(() => {
    report?.(dirty);
  }, [dirty, report]);
}
