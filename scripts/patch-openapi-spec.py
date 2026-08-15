#!/usr/bin/env python3
"""
Patch the OpenAPI spec to match what was actually built.

The original spec defines only `bearerAuth` with `bearerFormat: JWT`,
but the dashboard issues `sk_live_` API keys and the gateway authenticates
them via sha-256 hash lookup. This script:

  1. Adds an `apiKeyAuth` security scheme (in: header, name: Authorization)
  2. Changes the global `security:` block to use `apiKeyAuth` (primary)
  3. Updates the info.description to document both auth paths
  4. Saves the result to /home/z/my-project/download/openapi.yaml

We keep `bearerAuth` defined (for future user-facing endpoints that may
accept dashboard JWTs) but the global default is now `apiKeyAuth`.
"""
import re
import sys
from pathlib import Path

SRC = Path("/home/z/my-project/upload/Pasted Content_1786832906728.txt")
DST = Path("/home/z/my-project/download/openapi.yaml")


# New description block (replaces the existing info.description)
NEW_INFO_DESCRIPTION = """    The MusicOSY Platform API provides comprehensive access to the complete MusicOSY ecosystem.

    **Base URL:** `https://api.musicosy.com/v1`

    ## Authentication

    MusicOSY uses **two** authentication schemes:

    ### 1. API Keys (primary, server-to-server)

    Use an `sk_live_...` API key for any backend, CI, or service-to-service
    call against `/v1/*`. Keys are long-lived, revocable, and per-environment.

    ```
    Authorization: Bearer sk_live_...
    ```

    - **Format:** `sk_live_` + 43 chars url-safe base64 (51 chars total)
    - **Sandbox:** `sk_test_` prefix
    - **Storage:** Only the SHA-256 hash is stored; raw secret shown once
    - **Lifecycle:** create → use → roll (rotate) → revoke (soft delete)
    - **Dashboard:** [/dashboard/keys](https://musicosy.com/dashboard/keys)

    ### 2. Dashboard Session JWT (end-user, browser only)

    The Musicosy dashboard authenticates end users via Supabase Auth, which
    issues a short-lived JWT stored in an HTTP-only cookie. This JWT is
    **only** valid for `/api/dashboard/*` and `/api/me` routes — it is
    **not** accepted by `/v1/*` endpoints.

    ## Idempotency

    Mutating operations (POST, PUT, DELETE, PATCH) require an `Idempotency-Key`
    header (UUID v4) when implemented.

    ## Rate Limiting

    Rate limits vary by endpoint and are returned in response headers:
    `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

    ## Versioning

    All endpoints are versioned at `/v1`. Breaking changes require a new
    major version (v2, v3, etc.).

    ## Discovery

    `GET /v1/_meta` returns the gateway's auth schemes, rate-limit policy,
    and endpoint counts (documented vs. live vs. not-implemented).
"""


# New securitySchemes block — adds apiKeyAuth, keeps bearerAuth
NEW_SECURITY_SCHEMES = """  securitySchemes:
    apiKeyAuth:
      type: apiKey
      in: header
      name: Authorization
      description: |
        API key authentication for server-to-server calls.

        Pass the key in the `Authorization` header as a Bearer token:

        ```
        Authorization: Bearer sk_live_...
        ```

        Keys are issued in the [dashboard](https://musicosy.com/dashboard/keys).
        The raw secret is shown **once** at creation time. Only the SHA-256
        hash is stored at rest.

        - Production keys: `sk_live_` prefix
        - Sandbox keys: `sk_test_` prefix
        - Total length: 51 chars
        - Lifecycle: create → use → roll → revoke
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        JWT authentication for end-user browser sessions (dashboard only).

        **Not accepted by `/v1/*` endpoints.** Only valid for
        `/api/dashboard/*` and `/api/me` routes. Issued by Supabase Auth
        when a user signs in to the dashboard.
"""


# New global security block — primary is apiKeyAuth
NEW_GLOBAL_SECURITY = """security:
  - apiKeyAuth: []
  - bearerAuth: []
"""


def patch(text: str) -> str:
    """Apply all patches to the OpenAPI spec text."""

    # 1. Replace the info.description block. The original spans from
    #    `  description: |` to the next top-level key (which is `servers:`).
    #    We match non-greedily up to the `servers:` line.
    text = re.sub(
        r"(  description: \|)\n.*?\n(servers:)",
        lambda m: m.group(1) + "\n" + NEW_INFO_DESCRIPTION.rstrip("\n") + "\n" + m.group(2),
        text,
        count=1,
        flags=re.DOTALL,
    )

    # 2. Replace the global security: block (top-level, not nested under components).
    #    It appears between `security:` and the next top-level key `tags:`.
    text = re.sub(
        r"^security:\n  - bearerAuth: \[\]\n",
        NEW_GLOBAL_SECURITY,
        text,
        count=1,
        flags=re.MULTILINE,
    )

    # 3. Replace the securitySchemes block under components.
    #    Original:
    #      components:
    #        securitySchemes:
    #          bearerAuth:
    #            type: http
    #            scheme: bearer
    #            bearerFormat: JWT
    #    We replace from `  securitySchemes:` to the next sibling under `components:`
    #    (which is `  parameters:`).
    text = re.sub(
        r"(  securitySchemes:\n)    bearerAuth:\n      type: http\n      scheme: bearer\n      bearerFormat: JWT\n",
        NEW_SECURITY_SCHEMES,
        text,
        count=1,
    )

    # 4. Update the top-level `security:` block again (in case the regex above
    #    didn't match — defensive). The replacement must be the same.
    #    Already done above.

    return text


def clean_preamble(text: str) -> str:
    """Strip the markdown preamble, trailing markdown, and stray whitespace.

    The uploaded file has three issues:
      1. Line 1 is a markdown sentence: "You're absolutely right..."
      2. Line 2 has a stray leading space: ` openapi: 3.1.0`
      3. The file ends with a trailing markdown summary block

    All three break YAML parsing. We:
      - Find the first line that contains `openapi:` and start from there
      - Strip the leading whitespace from that first line
      - Find the last valid YAML line (before trailing markdown) and cut there
    """
    lines = text.splitlines()

    # Find start (first `openapi:` line)
    start_idx = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("openapi:") and "3." in stripped:
            start_idx = i
            break
    if start_idx > 0:
        print(f"Stripped {start_idx} preamble line(s) before `openapi:`")

    # Find end (last line that looks like YAML before trailing markdown).
    # Trailing markdown starts with a blank line followed by a sentence
    # like "This is the complete OpenAPI 3.1 specification...".
    end_idx = len(lines)
    for i in range(len(lines) - 1, start_idx, -1):
        stripped = lines[i].strip()
        # An empty line is fine (YAML allows trailing blank lines)
        if not stripped:
            end_idx = i
            continue
        # A line starting with a capital letter and containing spaces (not a YAML key)
        # signals the start of trailing markdown prose.
        if (
            stripped[0].isupper()
            and " " in stripped
            and ":" not in stripped.split(" ")[0]
            and not stripped.startswith("#")
        ):
            end_idx = i
            continue
        # We hit a real YAML line — stop trimming
        break

    if end_idx < len(lines):
        print(f"Stripped {len(lines) - end_idx} trailing markdown line(s)")

    cleaned_lines = lines[start_idx:end_idx]
    # Strip leading whitespace from the first line (the `openapi:` line)
    if cleaned_lines:
        cleaned_lines[0] = cleaned_lines[0].lstrip()
    # Drop trailing empty lines
    while cleaned_lines and not cleaned_lines[-1].strip():
        cleaned_lines.pop()
    return "\n".join(cleaned_lines) + "\n"


def main() -> int:
    if not SRC.exists():
        print(f"ERROR: {SRC} not found", file=sys.stderr)
        return 1

    DST.parent.mkdir(parents=True, exist_ok=True)

    raw = SRC.read_text(encoding="utf-8")
    print(f"Loaded source: {SRC} ({len(raw):,} chars, {raw.count(chr(10)):,} lines)")

    original = clean_preamble(raw)
    print(f"After cleaning: {len(original):,} chars, {original.count(chr(10)):,} lines")

    patched = patch(original)

    # Sanity-check: ensure apiKeyAuth is present
    if "apiKeyAuth:" not in patched:
        print("ERROR: apiKeyAuth not found in patched output — regex didn't match", file=sys.stderr)
        return 1
    if "Bearer sk_live_..." not in patched:
        print("ERROR: sk_live_ example not found in patched output", file=sys.stderr)
        return 1
    # Ensure bearerAuth is still defined (we keep it for dashboard-only JWT)
    if "bearerAuth:" not in patched:
        print("ERROR: bearerAuth was removed — should still be defined", file=sys.stderr)
        return 1

    DST.write_text(patched, encoding="utf-8")
    print(f"\nWrote patched spec: {DST}")
    print(f"  {len(patched):,} chars, {patched.count(chr(10)):,} lines")
    print(f"  Added: apiKeyAuth security scheme (in: header, name: Authorization)")
    print(f"  Updated: global security block (apiKeyAuth primary, bearerAuth fallback)")
    print(f"  Updated: info.description (documents both auth paths)")

    # Show the relevant patched sections
    print("\n--- Patched global security block ---")
    m = re.search(r"^security:.*?(?=^tags:)", patched, re.MULTILINE | re.DOTALL)
    if m:
        print(m.group(0).rstrip())

    print("\n--- Patched securitySchemes block ---")
    m = re.search(r"^  securitySchemes:.*?(?=^  parameters:)", patched, re.MULTILINE | re.DOTALL)
    if m:
        print(m.group(0).rstrip())

    return 0


if __name__ == "__main__":
    sys.exit(main())
