"use client";

import { useEffect, useState } from "react";

import {
  loadAccessCatalog,
  loadEffectiveAccess,
  type AccessRead,
  type AccessRole,
  type EffectiveAccess,
} from "@/app/(workspace)/settings/employees/access-actions";
import { InlineAlert } from "@/components/ui/inline-alert";
import { permissionLabel } from "@/lib/settings/access-group-commands";

export function EffectiveAccessSummary({ platformUserId }: { platformUserId: number }) {
  const [access, setAccess] = useState<AccessRead<EffectiveAccess> | null>(null);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [descriptions, setDescriptions] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [nextAccess, catalog] = await Promise.all([
        loadEffectiveAccess(platformUserId),
        loadAccessCatalog(),
      ]);
      if (cancelled) return;
      setAccess(nextAccess);
      if (catalog.ok) {
        setRoles(catalog.data.roles);
        setDescriptions(
          Object.fromEntries(catalog.data.permissions.map((item) => [item.code, item.description])),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformUserId]);

  if (access == null) {
    return <p className="text-portal-caption text-portal-muted">Загрузка групп и прав…</p>;
  }
  if (!access.ok) {
    return (
      <InlineAlert tone="danger" size="compact">
        {access.message}
      </InlineAlert>
    );
  }
  const names = new Map(roles.map((role) => [role.code, role.name]));
  return (
    <div className="space-y-portal-2" data-effective-access={platformUserId}>
      <p className="text-portal-caption text-portal-muted">
        Группы складываются. Должность сотрудника эти права не заменяет.
      </p>
      <p className="text-portal-body text-portal-text">
        Группы:{" "}
        {access.data.role_codes.length === 0
          ? "нет"
          : access.data.role_codes
              .map((code) => (names.get(code) ? `${names.get(code)} (${code})` : code))
              .join(", ")}
      </p>
      <ul className="max-h-48 space-y-1 overflow-auto text-portal-caption text-portal-text">
        {access.data.permissions.length === 0 ? (
          <li>Эффективных прав нет.</li>
        ) : (
          access.data.permissions.map((code) => (
            <li key={code}>{permissionLabel(code, descriptions[code])}</li>
          ))
        )}
      </ul>
    </div>
  );
}
