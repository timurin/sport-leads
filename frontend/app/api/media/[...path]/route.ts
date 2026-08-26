import { isAllowlistedApiMediaPath } from "@/lib/api-media";
import { sessionAuthHeaders } from "@/lib/auth/api-headers";

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

type RouteParams = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { path } = await params;
  const apiPath = `/${path.join("/")}`;
  if (!isAllowlistedApiMediaPath(apiPath)) {
    return new Response("Not found", { status: 404 });
  }

  const auth = await sessionAuthHeaders();
  if (!auth.Cookie) {
    return new Response("Unauthorized", { status: 401 });
  }

  const response = await fetch(`${apiBaseUrl()}${apiPath}`, {
    headers: { ...auth },
    cache: "no-store",
  });

  if (!response.ok) {
    return new Response(await response.text(), { status: response.status });
  }

  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";
  const disposition = response.headers.get("content-disposition");
  const bytes = await response.arrayBuffer();
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=60",
  });
  if (disposition) {
    headers.set("Content-Disposition", disposition);
  }
  return new Response(bytes, { status: 200, headers });
}
