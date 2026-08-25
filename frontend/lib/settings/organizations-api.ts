import "server-only";

import {
  fromApiOrganization,
  type ApiOrganization,
  type OrganizationView,
} from "@/lib/settings/organizations";

export type OrganizationsLoadResult =
  | { ok: true; items: OrganizationView[] }
  | { ok: false; items: []; message: string };

export type OrganizationDetailLoadResult =
  | { ok: true; organization: OrganizationView }
  | { ok: false; organization: null; message: string; notFound?: boolean };

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export async function getOrganizationsList(
  activeOnly = false,
): Promise<OrganizationsLoadResult> {
  try {
    const response = await fetch(
      `${apiBaseUrl()}/organizations?active_only=${activeOnly ? "true" : "false"}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return {
        ok: false,
        items: [],
        message: `Не удалось загрузить организации (${response.status}).`,
      };
    }
    const body = (await response.json()) as ApiOrganization[];
    return { ok: true, items: body.map(fromApiOrganization) };
  } catch {
    return {
      ok: false,
      items: [],
      message: "Не удалось загрузить организации. Demo-данные не подставлены.",
    };
  }
}

export async function getOrganizationDetail(
  organizationId: string,
): Promise<OrganizationDetailLoadResult> {
  if (!/^\d+$/.test(organizationId)) {
    return {
      ok: false,
      organization: null,
      message: "Некорректная организация.",
      notFound: true,
    };
  }
  try {
    const response = await fetch(
      `${apiBaseUrl()}/organizations/${organizationId}`,
      { cache: "no-store" },
    );
    if (response.status === 404) {
      return {
        ok: false,
        organization: null,
        message: "Организация не найдена.",
        notFound: true,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        organization: null,
        message: `Не удалось загрузить организацию (${response.status}).`,
      };
    }
    const body = (await response.json()) as ApiOrganization;
    return { ok: true, organization: fromApiOrganization(body) };
  } catch {
    return {
      ok: false,
      organization: null,
      message: "Не удалось загрузить организацию. Demo-данные не подставлены.",
    };
  }
}
