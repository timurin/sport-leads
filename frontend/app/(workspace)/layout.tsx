import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getMe } from "@/lib/auth/session";

type WorkspaceLayoutProps = {
  children: ReactNode;
};

export default async function WorkspaceLayout({
  children,
}: WorkspaceLayoutProps) {
  let me = null;
  try {
    me = await getMe();
  } catch {
    me = null;
  }
  if (!me) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
