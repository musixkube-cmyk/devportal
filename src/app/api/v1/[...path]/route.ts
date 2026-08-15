import { NextResponse, type NextRequest } from "next/server";
import {
  authenticateRequest,
  recordApiEvent,
  touchKeyUsage,
  getRequestId,
  gatewayError,
  type GatewayRequest,
} from "@/lib/api-gateway";

/**
 * /api/v1/[...path] — MusicOSY consumer API gateway.
 *
 * This is the "door to the vault". Every consumer API call flows through
 * here. The gateway:
 *
 *   1. Authenticates the bearer token (sk_live_...)
 *   2. Looks up the endpoint in the API reference catalogue
 *   3. Routes to a real handler if one is registered for that path+method
 *   4. Returns a clean 501 NotImplemented otherwise — so users can at least
 *      confirm their key authenticates and the endpoint is recognised
 *
 * RESPONSE CODES:
 *   200 / 201 / 204 — handler succeeded
 *   401 — missing or invalid API key
 *   404 — endpoint not in the catalogue (typo in path)
 *   405 — endpoint exists but method not allowed
 *   501 — endpoint is documented but not yet implemented
 *
 * RESPONSE HEADERS:
 *   X-Request-Id — correlation id (echoed for support tickets)
 *   X-Musicosy-Version — gateway version (for changelog tracking)
 *
 * USAGE TRACKING:
 *   Every authenticated request (success OR failure past auth) is recorded
 *   to `api_key_events`. The audit row includes method, path, status,
 *   duration, and the request id. `api_keys.lastUsedAt` is also touched.
 */

// Map of implemented handlers. Each key is `${METHOD} ${path}` where path
// may contain `{param}` placeholders. When this map is empty, every
// authenticated request returns 501 — which is the expected state until
// we wire up real handlers in later phases.
//
// Handlers receive the validated request (with musicosyApiKey attached)
// and return a NextResponse. The gateway wraps them with timing + audit.
type Handler = (req: GatewayRequest, ctx: HandlerContext) => Promise<NextResponse> | NextResponse;

type HandlerContext = {
  params: Record<string, string>;
  key: NonNullable<GatewayRequest["musicosyApiKey"]>;
  requestId: string;
};

// Empty by design — handlers will be registered here as endpoints are
// implemented. The gateway is fully functional today: it authenticates
// and returns clean 501s for every documented endpoint.
const HANDLERS: Record<string, Handler> = {};

/**
 * Looks up the endpoint in the api-reference catalogue. Returns the
 * matching endpoint spec (so we can echo its docs in a 501 response) or
 * null if the path isn't documented at all.
 *
 * We import the catalogue lazily so the gateway route bundle stays small.
 */
async function lookupEndpoint(method: string, path: string) {
  const { api } = await import("@/lib/api-reference");
  // Normalize: catalogue paths look like `/v1/profiles/{id}`. We need to
  // match `/v1/profiles/abc-123` against that pattern.
  for (const domain of api.domains) {
    for (const resource of domain.resources) {
      for (const endpoint of resource.endpoints) {
        if (endpoint.method !== method) continue;
        const params = matchPath(endpoint.path, path);
        if (params) {
          return { endpoint, domain, resource, params };
        }
      }
    }
  }
  return null;
}

/**
 * Matches a concrete path against a pattern with `{param}` placeholders.
 * Returns the extracted params, or null if no match.
 *
 *   matchPath("/v1/profiles/{id}", "/v1/profiles/abc")  → { id: "abc" }
 *   matchPath("/v1/profiles/{id}", "/v1/tracks")        → null
 */
function matchPath(pattern: string, concrete: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const concreteParts = concrete.split("/").filter(Boolean);
  if (patternParts.length !== concreteParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    const c = concreteParts[i];
    if (p.startsWith("{") && p.endsWith("}")) {
      params[p.slice(1, -1)] = decodeURIComponent(c);
    } else if (p !== c) {
      return null;
    }
  }
  return params;
}

/**
 * Builds the canonical path string from a request URL.
 * Strips the leading `/api/v1` prefix so the catalogue match works
 * against documented paths like `/v1/profiles/{id}`.
 */
function canonicalPath(req: NextRequest): string {
  const url = new URL(req.url);
  // /api/v1/profiles/abc → /v1/profiles/abc
  return url.pathname.replace(/^\/api\/v1/, "/v1");
}

/** All HTTP methods the gateway accepts. */
const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type AllowedMethod = (typeof ALLOWED_METHODS)[number];

function isAllowedMethod(m: string): m is AllowedMethod {
  return (ALLOWED_METHODS as readonly string[]).includes(m);
}

/**
 * Main gateway entry. Next.js calls this for ANY method on /api/v1/* — we
 * dispatch based on `req.method` ourselves so we can return 405 cleanly
 * for methods we don't support.
 */
async function gateway(req: NextRequest): Promise<NextResponse> {
  const startedAt = performance.now();
  const requestId = getRequestId(req);

  // HEAD/OPTIONS: short-circuit without auth (so clients can probe)
  if (req.method === "OPTIONS") {
    const res = NextResponse.json({}, { status: 204 });
    res.headers.set("Allow", ALLOWED_METHODS.join(", "));
    res.headers.set("X-Request-Id", requestId);
    return res;
  }

  // 1. Authenticate
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    const res = auth.response;
    res.headers.set("X-Request-Id", requestId);
    res.headers.set("X-Musicosy-Version", "2026-08-15");
    return res;
  }

  const key = auth.key;
  const path = canonicalPath(req);
  const method = req.method;

  // Special-case /v1/_meta — discovery endpoint. Returns gateway metadata
  // without going through the catalogue lookup. Authenticated like any
  // other endpoint so a user can use it to verify their key works.
  if (path === "/v1/_meta" && method === "GET") {
    const { api } = await import("@/lib/api-reference");
    const documentedEndpoints = api.stats.endpoints;
    const liveEndpoints = Object.keys(HANDLERS).length;
    const res = NextResponse.json({
      gateway: {
        name: "musicosy-api",
        version: "2026-08-15",
        status: "alpha",
      },
      auth: {
        schemes: ["Bearer"],
        tokenPrefixes: ["sk_live_", "sk_test_"],
        header: "Authorization",
        format: "Bearer sk_live_...",
      },
      rateLimits: {
        // TODO(P3): wire up when Redis token-bucket is in place
        default: { perMinute: 600, perDay: 100_000 },
        burst: { perSecond: 60 },
      },
      endpoints: {
        documented: documentedEndpoints,
        live: liveEndpoints,
        notImplemented: documentedEndpoints - liveEndpoints,
      },
      key: {
        id: key.id,
        label: key.label,
        scopes: key.scopes,
      },
      links: {
        self: "/v1/_meta",
        docs: "/docs/api-reference",
        dashboard: "/dashboard/keys",
      },
      request: {
        id: requestId,
      },
    });
    res.headers.set("X-Request-Id", requestId);
    res.headers.set("X-Musicosy-Version", "2026-08-15");

    // Audit log + usage touch — same as any other endpoint.
    touchKeyUsage({
      apiKeyId: key.id,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    const durationMs = Math.round(performance.now() - startedAt);
    recordApiEvent({
      apiKeyId: key.id,
      userId: key.userId,
      method,
      path,
      status: 200,
      durationMs,
      requestId,
    });

    return res;
  }

  // Attach the key to the request object so handlers can read it.
  const gwReq = req as GatewayRequest;
  gwReq.musicosyApiKey = key;

  // 2. Touch usage (fire-and-forget)
  touchKeyUsage({
    apiKeyId: key.id,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  // 3. Method check
  let response: NextResponse;
  if (!isAllowedMethod(method)) {
    response = gatewayError(
      "method_not_allowed",
      `Method ${method} is not supported by the Musicosy API gateway.`,
      405,
      { allowed: ALLOWED_METHODS },
    );
  } else {
    // 4. Look up endpoint in the catalogue
    const match = await lookupEndpoint(method, path);

    if (!match) {
      // Check if any OTHER method matches this path (for a proper 405)
      const anyMethodMatch = await lookupEndpoint("GET", path).then((r) =>
        r ? true : lookupEndpoint("POST", path).then((r) => !!r),
      );
      if (anyMethodMatch) {
        response = gatewayError(
          "method_not_allowed",
          `${method} ${path} is not supported. See the API reference for allowed methods.`,
          405,
        );
      } else {
        response = gatewayError(
          "not_found",
          `No such endpoint: ${method} ${path}. Check the API reference at /docs/api-reference.`,
          404,
          { method, path },
        );
      }
    } else {
      // 5. Dispatch to a registered handler, or return 501
      const handlerKey = `${method} ${match.endpoint.path}`;
      const handler = HANDLERS[handlerKey];
      if (handler) {
        try {
          response = await handler(gwReq, {
            params: match.params,
            key,
            requestId,
          });
        } catch (err) {
          response = gatewayError(
            "internal_error",
            "An unexpected error occurred while handling the request.",
            500,
            process.env.NODE_ENV !== "production"
              ? { message: err instanceof Error ? err.message : String(err) }
              : undefined,
          );
        }
      } else {
        // Documented but not implemented — return a clean 501 with metadata
        // so the user knows the endpoint exists, just isn't live yet.
        response = NextResponse.json(
          {
            error: {
              code: "not_implemented",
              message: `Endpoint ${method} ${path} is documented but not yet implemented.`,
              details: {
                endpoint: match.endpoint.path,
                method: match.endpoint.method,
                title: match.endpoint.title,
                description: match.endpoint.description,
                auth: match.endpoint.auth,
                docs: `/docs/api-reference/${match.domain.slug}/${match.resource.slug}`,
                implemented: false,
              },
            },
          },
          { status: 501 },
        );
      }
    }
  }

  // 6. Add standard gateway headers
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Musicosy-Version", "2026-08-15");

  // 7. Audit log (fire-and-forget)
  const durationMs = Math.round(performance.now() - startedAt);
  const status = response.status;
  recordApiEvent({
    apiKeyId: key.id,
    userId: key.userId,
    method,
    path,
    status,
    durationMs,
    requestId,
  });

  return response;
}

// Wire up each HTTP method to the gateway function. Next.js requires
// named exports for each method we want to support.
export {
  gateway as GET,
  gateway as POST,
  gateway as PUT,
  gateway as PATCH,
  gateway as DELETE,
};
