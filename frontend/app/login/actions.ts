"use server";

import { redirect } from "next/navigation";

import {
  loginWithPassword,
  logoutSession,
} from "@/lib/auth/session";

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
