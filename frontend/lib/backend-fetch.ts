/**
 * RSC / server-action fetch to FastAPI.
 * Uvicorn + undici keep-alive can surface `TypeError: fetch failed` / ECONNRESET;
 * retry once and map the leftover network error to a Russian message.
 */

const RETRYABLE_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "ETIMEDOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
]);

export function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = (error as Error & { cause?: { code?: string } }).cause;
  const code = typeof cause?.code === "string" ? cause.code : "";
  if (RETRYABLE_CODES.has(code)) return true;
  return error.name === "TypeError" && error.message === "fetch failed";
}

export function backendUnreachableError(
  error: unknown,
  subject = "API",
): Error {
  const cause =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "сеть недоступна";
  return new Error(
    `Не удалось связаться с API (${subject}: ${cause}). Проверьте, что backend запущен на :8000.`,
  );
}

export async function retryBackendOnce<T>(loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    if (!isRetryableNetworkError(error)) {
      throw error instanceof Error && error.message !== "fetch failed"
        ? error
        : backendUnreachableError(error);
    }
    try {
      return await loader();
    } catch (retryError) {
      throw backendUnreachableError(retryError);
    }
  }
}

export async function fetchBackend(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("connection")) {
    headers.set("connection", "close");
  }
  const nextInit: RequestInit = {
    ...init,
    cache: init?.cache ?? "no-store",
    headers,
  };
  return retryBackendOnce(() => fetch(input, nextInit));
}
