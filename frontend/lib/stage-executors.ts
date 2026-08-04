export type StageExecutor = {
  id: number;
  login: string;
  display_name: string;
  is_active: boolean;
};

export type StageExecutorList = {
  production_stage_id: number;
  stage_code: string;
  source: "directory" | "role_fallback" | string;
  items: StageExecutor[];
};

export type StageExecutorOption = {
  value: string;
  label: string;
};

/** Map API executors to shop-floor Select options (value = display_name for fact field). */
export function stageExecutorsToOptions(
  items: StageExecutor[],
): StageExecutorOption[] {
  return items.map((item) => ({
    value: item.display_name,
    label: `${item.display_name} (${item.login})`,
  }));
}

/** Hardcoded demo list — last-resort UI fallback when API is unavailable. */
export const DEMO_STAGE_EXECUTOR_OPTIONS: StageExecutorOption[] = [
  { value: "Иванов", label: "Иванов (demo)" },
  { value: "Петров", label: "Петров (demo)" },
  { value: "Сидоров", label: "Сидоров (demo)" },
  { value: "Анна", label: "Анна (demo)" },
  { value: "Мария", label: "Мария (demo)" },
];

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export async function fetchShopStageExecutors(
  stageCode: string,
  init?: { headers?: Record<string, string> },
): Promise<StageExecutorList | null> {
  const code = stageCode.trim();
  if (!code) return null;
  const response = await fetch(
    `${apiBaseUrl()}/shop-stage-executors?stage_code=${encodeURIComponent(code)}`,
    {
      headers: { ...(init?.headers ?? {}) },
      cache: "no-store",
    },
  );
  if (response.status === 401 || response.status === 403) return null;
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Не удалось загрузить исполнителей (${response.status})`);
  }
  return (await response.json()) as StageExecutorList;
}
