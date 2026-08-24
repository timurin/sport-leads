import "server-only";

import {
  fromApiClientFolder,
  type ApiClientFolder,
  type ClientFolderView,
} from "@/lib/sales/client-folders";

export type ClientFoldersLoadResult =
  | { ok: true; folders: ClientFolderView[] }
  | { ok: false; folders: []; message: string };

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export async function getClientFolders(): Promise<ClientFoldersLoadResult> {
  try {
    const response = await fetch(`${apiBaseUrl()}/client-folders`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        folders: [],
        message: `Не удалось загрузить папки клиентов (${response.status}).`,
      };
    }
    const body = (await response.json()) as ApiClientFolder[];
    return { ok: true, folders: (body ?? []).map(fromApiClientFolder) };
  } catch {
    return {
      ok: false,
      folders: [],
      message: "Не удалось загрузить папки клиентов. Demo-данные не подставлены.",
    };
  }
}
