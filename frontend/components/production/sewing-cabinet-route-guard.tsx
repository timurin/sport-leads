"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { isSewingCabinetOwnPath } from "@/lib/auth/session-mapping";

type SewingCabinetRouteGuardProps = {
  restricted: boolean;
};

export function SewingCabinetRouteGuard({
  restricted,
}: SewingCabinetRouteGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!restricted) return;
    if (isSewingCabinetOwnPath(pathname)) return;
    router.replace("/production/sewing-cabinet");
  }, [restricted, pathname, router]);

  return null;
}
