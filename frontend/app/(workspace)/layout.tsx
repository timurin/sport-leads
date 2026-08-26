import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { SewingCabinetRouteGuard } from "@/components/production/sewing-cabinet-route-guard";
import { getMe } from "@/lib/auth/session";
import {
  isSewingCabinetOwnPath,
  isSewingCabinetRestricted,
} from "@/lib/auth/session-mapping";

type WorkspaceLayoutProps = {
  children: ReactNode;
  leadSlider: ReactNode;
};

export default async function WorkspaceLayout({
  children,
  leadSlider,
}: WorkspaceLayoutProps) {
  let me = null;
  try {
    me = await getMe();
  } catch {
    me = null;
  }
  if (!me) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    const next =
      pathname.startsWith("/") && !pathname.startsWith("//")
        ? `?next=${encodeURIComponent(pathname)}`
        : "";
    redirect(`/login${next}`);
  }

  const restricted = isSewingCabinetRestricted(me);
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (restricted && pathname && !isSewingCabinetOwnPath(pathname)) {
    redirect("/production/sewing-cabinet");
  }

  return (
    <>
      <SewingCabinetRouteGuard restricted={restricted} />
      <AppShell me={me} overlay={leadSlider}>{children}</AppShell>
    </>
  );
}
