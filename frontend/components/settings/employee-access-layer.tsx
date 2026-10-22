"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { EmployeeCardModal } from "@/components/settings/employee-card";
import { EmployeeNavDialog } from "@/components/settings/employee-nav-dialog";
import { LayerDirtyProvider } from "@/components/settings/employee-nav-context";
import type { EmployeeView } from "@/lib/settings/employees";
import type { EmployeeListFilters } from "@/lib/settings/employee-access-routes";
import type { OrganizationView } from "@/lib/settings/organizations";

export function EmployeeAccessLayer({
  title,
  employee = null,
  organizations = [],
  filters = {},
  children,
}: {
  title: string;
  employee?: EmployeeView | null;
  organizations?: OrganizationView[];
  filters?: EmployeeListFilters;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const level = employee ? 2 : 1;
  return (
    <>
      {employee ? (
        <EmployeeCardModal
          inert
          employee={employee}
          organizations={organizations}
          tab="access"
          filters={filters}
        />
      ) : null}
      <EmployeeNavDialog title={title} level={level} dirty={dirty} onClose={() => router.back()}>
        <LayerDirtyProvider onDirty={setDirty}>{children}</LayerDirtyProvider>
      </EmployeeNavDialog>
    </>
  );
}
