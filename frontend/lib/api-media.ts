/**
 * Same-origin media URLs for the browser (`26.8.1`).
 * Caddy on sport-lead.ru proxies Next only; FastAPI is internal.
 */

export const API_MEDIA_PROXY_PREFIX = "/api/media";

const ALLOWLISTED_API_MEDIA_PATTERNS: readonly RegExp[] = [
  /^\/nomenclatures\/\d+\/media\/\d+\/content$/,
  /^\/product-models\/\d+\/media\/\d+\/content$/,
  /^\/product-models\/\d+\/cover\/content$/,
  /^\/technical-cards\/\d+\/media\/\d+\/content$/,
  /^\/design-projects\/\d+\/versions\/\d+\/assets\/\d+\/content$/,
  /^\/platform-system-settings\/logo\/content$/,
];

export function isAllowlistedApiMediaPath(pathname: string): boolean {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return ALLOWLISTED_API_MEDIA_PATTERNS.some((pattern) => pattern.test(path));
}

function pathnameFromMediaUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("blob:")) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      return url.pathname;
    } catch {
      return null;
    }
  }
  if (value.startsWith("/")) return value.split("?")[0] ?? value;
  return `/${value.replace(/^\.\//, "")}`;
}

/** Browser `img`/`href` for API file bytes. Does not call FastAPI from the client. */
export function sameOriginApiMediaUrl(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) return null;
  const value = url.trim();
  if (value.startsWith("blob:")) return value;
  const pathname = pathnameFromMediaUrl(value);
  if (!pathname) return value;
  if (pathname.startsWith(`${API_MEDIA_PROXY_PREFIX}/`)) {
    return pathname;
  }
  if (isAllowlistedApiMediaPath(pathname)) {
    return `${API_MEDIA_PROXY_PREFIX}${pathname}`;
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  if (value.startsWith("/")) return value;
  return `/${value.replace(/^\.\//, "")}`;
}

const RASTER_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Empty `file.type` (some phones) → jpeg/png/webp from extension. HEIC stays rejected. */
export function rasterImageMimeOrNull(
  file: Pick<File, "type" | "name">,
): string | null {
  const type = file.type.trim().toLowerCase();
  if (type === "image/jpg" || type === "image/jpeg") return "image/jpeg";
  if (RASTER_MIMES.has(type)) return type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}
