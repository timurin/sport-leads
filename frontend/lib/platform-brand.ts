/**
 * Server-only platform brand loader for AppShell (18.1.2).
 * Do not import from Client Components — uses next/headers via sessionAuthHeaders.
 */

import "server-only";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import {
  DEFAULT_PLATFORM_BRAND,
  type PlatformBrand,
} from "@/lib/platform-system-settings";

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export async function loadPlatformBrand(): Promise<PlatformBrand> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/platform-system-settings/brand`, {
    headers: { ...auth },
    cache: "no-store",
  });
  if (!response.ok) {
    return DEFAULT_PLATFORM_BRAND;
  }
  const body = (await response.json()) as PlatformBrand;
  const name = body.organization_display_name?.trim();
  return {
    organization_display_name:
      name || DEFAULT_PLATFORM_BRAND.organization_display_name,
    logo_url: body.logo_url ?? null,
  };
}
