#!/usr/bin/env python3
"""
Fix the auth mismatch in src/data/api-reference.json.

The current docs say "Bearer JWT" but the dashboard actually issues
`sk_live_` API keys and the gateway authenticates them via sha-256 hash
lookup. This script rewrites the "quickstart" and "authentication"
getting-started pages to match reality.

Also adds a new "api-keys" getting-started page that documents the
key lifecycle (create → use → roll → revoke).
"""
import json
import sys
from pathlib import Path

DOCS_PATH = Path("/home/z/my-project/src/data/api-reference.json")


NEW_QUICKSTART = """The MusicOSY API provides programmatic access to the full MusicOSY platform including identity, content, commerce, distribution, analytics, and more.

**Base URL:** `https://api.musicosy.com/v1`

**Version:** 1.0.0

**Response Format:** JSON

All requests should include:
```
Accept: application/json
Authorization: Bearer sk_live_...
```

**Minimal Example:**
```bash
# Verify your key works (returns gateway metadata)
curl -X GET https://api.musicosy.com/v1/_meta \\
  -H "Authorization: Bearer sk_live_YOUR_KEY"
```

**Quick start in 3 steps:**

1. **Sign in** to the [dashboard](/dashboard) and create an API key on the [API Keys page](/dashboard/keys). The raw `sk_live_...` secret is shown **once** — store it in a secret manager.
2. **Make your first call** — every consumer endpoint accepts the key in the `Authorization: Bearer sk_live_...` header.
3. **Watch usage** — every authenticated request is audited and shows up on the [Usage page](/dashboard/usage) within a few seconds.

**What's live today:**

- Authentication + audit + correlation IDs (`X-Request-Id`) on every `/v1/*` call
- `/v1/_meta` discovery endpoint (gateway metadata, endpoint counts, key info)
- 401 / 404 / 405 / 501 responses with stable error codes for every documented endpoint

**What's not live yet:**

- The 399 documented endpoints return `501 not_implemented` until wired up to real handlers. The response body includes the endpoint's documentation so you can confirm the contract before it ships.

---"""


NEW_AUTHENTICATION = """MusicOSY uses **two** authentication schemes. The one you use depends on whether you're calling the consumer API from a server, or signing in to the dashboard as a human.

#### 1. API Keys (server-to-server, primary)

Use an `sk_live_...` API key for any backend, CI, or service-to-service call against `/v1/*`. Keys are long-lived, revocable, and per-environment.

**Header:**
```
Authorization: Bearer sk_live_...
```

**Key format:** `sk_live_` prefix + 43 chars of URL-safe base64 (51 chars total). Sandbox keys use the `sk_test_` prefix.

**Storage:** Only the SHA-256 hash of the key is stored. The raw secret is shown **once** at creation time. If lost, roll the key.

**Key lifecycle:**

| Action | Endpoint | Notes |
|--------|----------|-------|
| Create | Dashboard → [API Keys](/dashboard/keys) | Returns the raw secret once |
| List | `GET /api/dashboard/keys` | Shows prefix + last four only |
| Roll (rotate secret) | `POST /api/dashboard/keys/{id}/roll` | Old secret stops working immediately |
| Revoke (soft delete) | `POST /api/dashboard/keys/{id}/revoke` | Audited, cannot be undone |

**Auth flow:**

1. Sign in to the [dashboard](/dashboard)
2. Go to [API Keys](/dashboard/keys) → **Create key**
3. Store the returned `sk_live_...` value in a secret manager
4. Pass it as `Authorization: Bearer sk_live_...` on every `/v1/*` call

**Example:**
```bash
curl -X GET https://api.musicosy.com/v1/_meta \\
  -H "Authorization: Bearer sk_live_abc123..."
```

#### 2. Dashboard Session JWT (end-user, browser only)

The Musicosy dashboard itself authenticates end users via Supabase Auth, which issues a short-lived JWT stored in an HTTP-only cookie. This JWT is **only** valid for `/api/dashboard/*` and `/api/me` routes — it is **not** accepted by `/api/v1/*`.

You do not need to manage JWTs yourself unless you're building a custom dashboard integration. If you are, see the [Supabase Auth docs](https://supabase.com/docs/guides/auth).

#### Headers

| Header | Value | Required for |
|--------|-------|--------------|
| `Authorization` | `Bearer sk_live_...` | All `/v1/*` endpoints |
| `Idempotency-Key` | UUID v4 | POST, PUT, PATCH, DELETE (when implemented) |
| `X-Request-Id` | 8-64 char string | Optional — echoed in response for correlation |

#### Error Responses

| HTTP | `error.code` | Cause |
|------|--------------|-------|
| 401 | `missing_authorization` | No `Authorization` header |
| 401 | `invalid_authorization` | Token doesn't match `sk_(live\|test)_` format |
| 401 | `invalid_api_key` | Key not found, revoked, or expired |
| 404 | `not_found` | Path is not a documented endpoint |
| 405 | `method_not_allowed` | Path exists but method isn't supported |
| 501 | `not_implemented` | Documented endpoint, handler not wired up yet |

Example 401 body:
```json
{
  "error": {
    "code": "invalid_api_key",
    "message": "The API key was not recognized, has been revoked, or has expired."
  }
}
```

#### Discoverability

`GET /v1/_meta` returns the gateway's auth schemes, rate-limit policy, and endpoint counts (documented vs. live vs. not-implemented). Useful for sanity-checking a key in CI.

---"""


NEW_API_KEYS_PAGE = """API keys are the primary credential for the Musicosy consumer API. This page covers the format, lifecycle, and best practices.

#### Key format

```
sk_live_<43 chars of url-safe base64>
```

- **Prefix:** `sk_live_` (production) or `sk_test_` (sandbox)
- **Tail:** 43 chars of URL-safe base64 (32 bytes of entropy)
- **Total length:** 51 chars

The full secret (including prefix) is hashed with SHA-256 and stored in `api_keys.hashedKey`. The raw secret is **never** stored.

#### Key identification

Each key has two visible identifiers shown in the dashboard so you can recognize it without exposing the secret:

- **Prefix** — first 8 chars of the tail (e.g. `aB3xK9mZ`)
- **Last four** — last 4 chars of the tail (e.g. `pQ7n`)

Example dashboard label: `sk_live_aB3xK9mZ…pQ7n`

#### Lifecycle

```
[Create] → [Active] → [Roll] → [Active (new secret)]
                  ↓
              [Revoke] → [Gone]
```

| State | `revokedAt` | Behaviour |
|-------|-------------|-----------|
| Active | `null` | Auth succeeds |
| Revoked | timestamp | Auth returns 401 `invalid_api_key` |
| Expired | — | Auth returns 401 if `expiresAt < now()` |

#### Scopes

Each key has a `scopes` field (JSON string array). When scope enforcement ships, requests will be rejected with `403 insufficient_scope` if the key lacks a required scope.

Currently shipped scopes (not yet enforced):

- `read` — GET on any `/v1/*` endpoint
- `write` — POST/PUT/PATCH/DELETE on any `/v1/*` endpoint
- `webhooks:write` — manage webhooks via `/api/dashboard/webhooks`
- `keys:write` — roll/revoke keys via `/api/dashboard/keys/*`

#### Best practices

- **One key per environment.** Don't reuse a production key in CI.
- **Store in a secret manager.** AWS Secrets Manager, Doppler, Vault, 1Password — never in `.env` files committed to git.
- **Rotate on schedule.** Roll keys every 90 days, or immediately if a team member leaves.
- **Revoke on compromise.** Revocation is instant and audited.
- **Pass via header, not query string.** Query strings end up in access logs.

---"""


def main() -> int:
    if not DOCS_PATH.exists():
        print(f"ERROR: {DOCS_PATH} not found", file=sys.stderr)
        return 1

    with DOCS_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    getting_started = data.get("gettingStarted", [])
    if not isinstance(getting_started, list):
        print("ERROR: gettingStarted is not a list", file=sys.stderr)
        return 1

    # Find existing pages by slug
    by_slug = {p["slug"]: p for p in getting_started}

    # Update quickstart
    if "quickstart" in by_slug:
        by_slug["quickstart"]["markdown"] = NEW_QUICKSTART
        print("Updated 'quickstart' page")
    else:
        getting_started.insert(0, {"slug": "quickstart", "title": "Quickstart", "markdown": NEW_QUICKSTART})
        print("Inserted 'quickstart' page")

    # Update authentication
    if "authentication" in by_slug:
        by_slug["authentication"]["markdown"] = NEW_AUTHENTICATION
        print("Updated 'authentication' page")
    else:
        getting_started.append({"slug": "authentication", "title": "Authentication", "markdown": NEW_AUTHENTICATION})
        print("Inserted 'authentication' page")

    # Add api-keys page if not present
    if "api-keys" not in by_slug:
        # Insert after authentication
        auth_idx = next((i for i, p in enumerate(getting_started) if p["slug"] == "authentication"), 0)
        getting_started.insert(auth_idx + 1, {"slug": "api-keys", "title": "API Keys", "markdown": NEW_API_KEYS_PAGE})
        print("Inserted 'api-keys' page")
    else:
        by_slug["api-keys"]["markdown"] = NEW_API_KEYS_PAGE
        print("Updated 'api-keys' page")

    data["gettingStarted"] = getting_started

    # Write back with stable formatting
    with DOCS_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"\nWrote {DOCS_PATH}")
    print(f"  gettingStarted pages: {len(getting_started)}")
    for p in getting_started:
        print(f"    - {p['slug']}: {p['title']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
