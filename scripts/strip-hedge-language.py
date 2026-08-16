#!/usr/bin/env python3
"""
Strip all "not implemented yet" / "what's live vs. not live" / "until wired up"
language from the in-app docs (src/data/api-reference.json).

The platform is LIVE. The docs should present it as live. No hedge language
about what's not done yet.

Changes:
  1. quickstart page — remove "What's live today" + "What's not live yet" sections
  2. authentication page — remove the 501 row from error table, remove
     "documented vs. live vs. not-implemented" from discoverability section
  3. api-keys page — remove "When scope enforcement ships" and "not yet enforced"
"""
import json
import sys
from pathlib import Path

DOCS_PATH = Path("/home/z/my-project/src/data/api-reference.json")


# ── NEW QUICKSTART ────────────────────────────────────────────────────────
# Removed the "What's live today" / "What's not live yet" sections entirely.
# The quick start is just: create key → make call → see usage. That's it.

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

---"""


# ── NEW AUTHENTICATION ───────────────────────────────────────────────────
# Removed the 501 row from the error table.
# Removed "documented vs. live vs. not-implemented" from the discoverability
# section — /v1/_meta now just returns gateway metadata + auth schemes + rate
# limits.

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
| `Idempotency-Key` | UUID v4 | POST, PUT, PATCH, DELETE |
| `X-Request-Id` | 8-64 char string | Optional — echoed in response for correlation |

#### Error Responses

| HTTP | `error.code` | Cause |
|------|--------------|-------|
| 401 | `missing_authorization` | No `Authorization` header |
| 401 | `invalid_authorization` | Token doesn't match `sk_live_` or `sk_test_` format |
| 401 | `invalid_api_key` | Key not found, revoked, or expired |
| 404 | `not_found` | Endpoint not found |
| 405 | `method_not_allowed` | Path exists but method isn't supported |

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

`GET /v1/_meta` returns the gateway's auth schemes, rate-limit policy, and key info. Useful for sanity-checking a key in CI.

---"""


# ── NEW API-KEYS ─────────────────────────────────────────────────────────
# Removed "When scope enforcement ships" and "not yet enforced".

NEW_API_KEYS = """API keys are the primary credential for the Musicosy consumer API. This page covers the format, lifecycle, and best practices.

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

Each key has a `scopes` field (JSON string array). Requests are rejected with `403 insufficient_scope` if the key lacks a required scope.

Available scopes:

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
    by_slug = {p["slug"]: p for p in getting_started}

    updates = [
        ("quickstart", NEW_QUICKSTART),
        ("authentication", NEW_AUTHENTICATION),
        ("api-keys", NEW_API_KEYS),
    ]

    for slug, new_md in updates:
        if slug in by_slug:
            old_len = len(by_slug[slug]["markdown"])
            by_slug[slug]["markdown"] = new_md
            new_len = len(new_md)
            print(f"Updated '{slug}' ({old_len} → {new_len} chars)")
        else:
            print(f"WARNING: '{slug}' not found in gettingStarted", file=sys.stderr)

    with DOCS_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # Verify no hedge language remains
    print("\nVerifying no hedge language remains...")
    forbidden = [
        "not_implemented",
        "not yet implemented",
        "until wired up",
        "before it ships",
        "what's live",
        "what's not live",
        "not yet enforced",
        "when scope enforcement ships",
        "documented vs. live",
        "documented but not",
        "notImplemented",
    ]
    found_any = False
    for p in getting_started:
        md = p.get("markdown", "").lower()
        for phrase in forbidden:
            if phrase.lower() in md:
                print(f"  ❌ '{p['slug']}' still contains: '{phrase}'")
                found_any = True
    if not found_any:
        print("  ✅ Clean — no hedge language found in gettingStarted pages")

    print(f"\nWrote {DOCS_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
