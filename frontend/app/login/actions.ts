"use server";

import { redirect } from "next/navigation";

import {
  loginWithPassword,
  logoutSession,
} from "@/lib/auth/session";
import {
  isSewingCabinetOwnPath,
  isSewingCabinetRestricted,
} from "@/lib/auth/session-mapping";

export type LoginActionResult =
  | { ok: true }
  | { ok: false; message: string };

export async function loginAction(
  login: string,
  password: string,
  nextPath?: string | null,
): Promise<LoginActionResult> {
  const result = await loginWithPassword(login, password);
  if (!result.ok) return result;
  if (isSewingCabinetRestricted(result.user)) {
    const next =
      nextPath &&
      nextPath.startsWith("/") &&
      !nextPath.startsWith("//") &&
      isSewingCabinetOwnPath(nextPath)
        ? nextPath
        : "/production/sewing-cabinet";
    redirect(next);
  }
  const next =
    nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/sales/dashboard";
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  await logoutSession();
  redirect("/login");
}
