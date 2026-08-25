import "server-only";

import {
  fromApiEmployee,
  type ApiEmployee,
  type EmployeeView,
} from "@/lib/settings/employees";

export type EmployeesLoadResult =
  | { ok: true; items: EmployeeView[] }
  | { ok: false; items: []; message: string };

export type EmployeeDetailLoadResult =
  | { ok: true; employee: EmployeeView }
  | { ok: false; employee: null; message: string; notFound?: boolean };

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export async function getEmployeesList(
  activeOnly = false,
): Promise<EmployeesLoadResult> {
  try {
    const response = await fetch(
      `${apiBaseUrl()}/employees?active_only=${activeOnly ? "true" : "false"}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return {
        ok: false,
        items: [],
        message: `Не удалось загрузить сотрудников (${response.status}).`,
      };
    }
    const body = (await response.json()) as ApiEmployee[];
    return { ok: true, items: body.map(fromApiEmployee) };
  } catch {
    return {
      ok: false,
      items: [],
      message: "Не удалось загрузить сотрудников. Demo-данные не подставлены.",
    };
  }
}

export async function getEmployeeDetail(
  employeeId: string,
): Promise<EmployeeDetailLoadResult> {
  if (!/^\d+$/.test(employeeId)) {
    return {
      ok: false,
      employee: null,
      message: "Некорректный сотрудник.",
      notFound: true,
    };
  }
  try {
    const response = await fetch(`${apiBaseUrl()}/employees/${employeeId}`, {
      cache: "no-store",
    });
    if (response.status === 404) {
      return {
        ok: false,
        employee: null,
        message: "Сотрудник не найден.",
        notFound: true,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        employee: null,
        message: `Не удалось загрузить сотрудника (${response.status}).`,
      };
    }
    const body = (await response.json()) as ApiEmployee;
    return { ok: true, employee: fromApiEmployee(body) };
  } catch {
    return {
      ok: false,
      employee: null,
      message: "Не удалось загрузить сотрудника. Demo-данные не подставлены.",
    };
  }
}
