import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /api/auth/debug-cookies — temporary debug endpoint.
 *
 * Returns every cookie the server sees, plus the headers related to
 * cookie forwarding. Used to diagnose why middleware can't see the
 * Supabase session cookie after signInWithPassword succeeds in the
 * browser.
 *
 * DELETE THIS FILE BEFORE PRODUCTION.
 */
export async function GET(request: NextRequest) {
  const cookies = request.cookies.getAll();
  const headers: Record<string, string> = {};
  for (const [k, v] of request.headers.entries()) {
    if (
      k.toLowerCase().includes("cookie") ||
      k.toLowerCase().includes("origin") ||
      k.toLowerCase().includes("referer") ||
      k.toLowerCase().includes("host") ||
      k.toLowerCase().includes("x-forwarded") ||
      k.toLowerCase().includes("via")
    ) {
      headers[k] = v;
    }
  }

  // Also log to server stdout so it shows up in dev.log
  console.log(
    `[debug-cookies] cookieCount=${cookies.length} cookies=${cookies
      .map((c) => c.name)
      .join(",")} host=${headers.host} origin=${headers.origin ?? "(none)"} referer=${headers.referer ?? "(none)"} x-forwarded-for=${headers["x-forwarded-for"] ?? "(none"}`,
  );

  return NextResponse.json({
    cookieCount: cookies.length,
    cookies: cookies.map((c) => ({
      name: c.name,
      valuePreview:
        c.value.length > 80
          ? c.value.slice(0, 80) + `... (${c.value.length} chars total)`
          : c.value,
    })),
    headers,
    url: request.url,
  });
}
