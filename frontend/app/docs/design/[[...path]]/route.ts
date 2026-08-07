import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

/** Safe relative path under docs/design: segments + allowed extension */
const ALLOWED_REL =
  /^(?:[a-zA-Z0-9][a-zA-Z0-9._-]*)(?:\/[a-zA-Z0-9][a-zA-Z0-9._-]*)*\.(html|css|js)$/;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function designDocsRoot(): string {
  // frontend/ cwd → repo docs/design
  return path.resolve(process.cwd(), "..", "docs", "design");
}

type RouteParams = { params: Promise<{ path?: string[] }> };

/**
 * Serve Soft UI HTML etalons from repo `docs/design/` for local/LAN viewing
 * (e.g. http://127.0.0.1:3001/docs/design/index.html).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { path: parts } = await params;
  const rel =
    !parts || parts.length === 0
      ? "index.html"
      : parts.join("/");

  if (!ALLOWED_REL.test(rel)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const root = designDocsRoot();
  const target = path.resolve(root, rel);
  if (!target.startsWith(root + path.sep) && target !== root) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(target).toLowerCase();
  const contentType = MIME[ext];
  if (!contentType) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const body = await readFile(target);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
