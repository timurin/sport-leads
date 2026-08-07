import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

const ALLOWED_FILE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.html$/;

function statusDocsRoot(): string {
  // frontend/ cwd → repo docs/erp/status
  return path.resolve(process.cwd(), "..", "docs", "erp", "status");
}

type RouteParams = { params: Promise<{ file: string }> };

/**
 * Serve HTML twins from repo `docs/erp/status/` for local/LAN viewing
 * (e.g. http://192.168.2.98:3001/docs/erp/status/roadmap-v1.00.html).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { file } = await params;
  if (!ALLOWED_FILE.test(file)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const root = statusDocsRoot();
  const target = path.resolve(root, file);
  if (!target.startsWith(root + path.sep) && target !== root) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const html = await readFile(target, "utf8");
    return new NextResponse(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
