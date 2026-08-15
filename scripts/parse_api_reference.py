#!/usr/bin/env python3
"""
Parse the MusicOSY API reference markdown into a structured JSON model.

Output: /home/z/my-project/src/data/api-reference.json

Structure:
{
  "gettingStarted": [
    { "slug": "quickstart", "title": "Quickstart", "markdown": "..." },
    ...
  ],
  "guides": [
    { "slug": "shared-state-machines", "title": "Shared State Machines", "markdown": "..." },
    ...
  ],
  "domains": [
    {
      "code": "D1",
      "slug": "d1",
      "name": "Identity & Social Graph",
      "owner": "Identity Service",
      "basePath": "/v1",
      "markdown": "...",  # domain overview (intro paragraph, etc.)
      "resources": [
        {
          "slug": "users",
          "name": "Users",
          "endpoints": [
            {
              "method": "POST",
              "path": "/v1/auth/register",
              "title": "Register a new user account",
              "auth": "Optional (public)",
              "idempotent": "Yes",
              "rateLimit": "10/min",
              "markdown": "...",  # full endpoint markdown body (for rendering)
              "requestBody": "{ ... }",   # extracted json blocks
              "responseBody": "{ ... }",
              "queryParams": [...],
              "bodyParams": [...],
              "errorCodes": [...]
            }
          ]
        }
      ]
    }
  ],
  "appendices": {
    "uiComponents": { "markdown": "..." },
    "modals": { "markdown": "..." },
    "featureIndex": { "markdown": "..." }
  }
}
"""

import json
import re
from pathlib import Path

SRC = Path("/home/z/my-project/upload/Pasted Content_1786818530199.txt")
OUT = Path("/home/z/my-project/src/data/api-reference.json")


def to_slug(s: str) -> str:
    """Slugify a heading: lowercase, hyphens, strip non-alphanumerics."""
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s.strip())
    s = re.sub(r"-+", "-", s)
    return s


def heading_level(line: str) -> int:
    """Return heading level (2,3,4,5) or 0 if not a heading."""
    m = re.match(r"^(#{2,5})\s+(.+)$", line)
    if not m:
        return 0
    return len(m.group(1))


def heading_text(line: str) -> str:
    m = re.match(r"^#{2,5}\s+(.+)$", line)
    return m.group(1).strip() if m else ""


def split_into_sections(md: str, target_level: int) -> list[tuple[str, str]]:
    """
    Split markdown into (title, body) tuples for headings at exactly
    `target_level`. The body of each section is everything until the next
    heading at the same level OR a higher-level heading (lower number).

    Sub-headings (deeper than target_level) and their content are INCLUDED
    in the body — only same-or-higher level headings terminate a section.
    """
    lines = md.split("\n")
    sections: list[tuple[str, list[str]]] = []
    current = None  # (title, body_lines)
    in_code_block = False

    for line in lines:
        # Don't parse headings inside fenced code blocks
        if line.strip().startswith("```"):
            in_code_block = not in_code_block

        is_terminator = False
        if not in_code_block:
            lvl = heading_level(line)
            if lvl > 0:
                if lvl == target_level:
                    # Start a new section at our level
                    if current:
                        sections.append((current[0], current[1]))
                    current = (heading_text(line), [])
                    continue
                elif lvl < target_level:
                    # Higher-level heading ends our section (don't include it)
                    if current:
                        sections.append((current[0], current[1]))
                        current = None
                    continue
                # else lvl > target_level: fall through — include in body
                is_terminator = False

        # Default: append this line to the current section's body
        if current:
            current[1].append(line)
        # else: skip preamble before first target heading

    if current:
        sections.append((current[0], current[1]))

    return [(title, "\n".join(body).strip()) for title, body in sections]


# ─── Endpoint field extractors ───────────────────────────────────────────

METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE", "WS")


def extract_endpoint_meta(md: str) -> dict:
    """Pull auth/idempotent/rate-limit fields from endpoint markdown."""
    meta = {}

    # Auth: ...
    m = re.search(r"\*\*Auth:\*\*\s*(.+?)$", md, re.MULTILINE)
    meta["auth"] = m.group(1).strip() if m else None

    # Idempotent: ...
    m = re.search(r"\*\*Idempotent:\*\*\s*(.+?)$", md, re.MULTILINE)
    meta["idempotent"] = m.group(1).strip() if m else None

    # Rate Limit: ...
    m = re.search(r"\*\*Rate Limit:\*\*\s*(.+?)$", md, re.MULTILINE)
    meta["rateLimit"] = m.group(1).strip() if m else None

    return meta


def extract_code_blocks(md: str, label: str) -> str | None:
    """
    Find the first ```json ... ``` block that follows a label like
    'Request Body:' or 'Response (200 OK):'.
    """
    # Look for **Label:** or plain Label: followed by a fenced code block
    pattern = rf"{re.escape(label)}[^\n]*\n+\s*```(?:json)?\s*\n(.*?)```"
    m = re.search(pattern, md, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return None


def extract_table(md: str, label: str) -> list[dict]:
    """
    Extract a markdown table that follows a label like 'Query Parameters:'
    or 'Request Body:' or 'Error Codes:'.
    Returns list of {column_name: cell_value} dicts.
    """
    # Find the label, then the next table
    pattern = rf"{re.escape(label)}[^\n]*\n(\|[^\n]+\|\n(?:\|[\s:|-]+\|\n)?(?:\|[^\n]+\|\n)+)"
    m = re.search(pattern, md)
    if not m:
        return []
    table = m.group(1)
    rows = [r for r in table.strip().split("\n") if r.strip().startswith("|")]
    if len(rows) < 2:
        return []
    # First row = header
    headers = [h.strip() for h in rows[0].strip("|").split("|")]
    # Skip separator row (---|---|...)
    data_rows = [r for r in rows[1:] if not re.match(r"^\|[\s:|-]+\|$", r.strip())]
    result = []
    for r in data_rows:
        cells = [c.strip() for c in r.strip("|").split("|")]
        # Pad/truncate to header length
        while len(cells) < len(headers):
            cells.append("")
        cells = cells[: len(headers)]
        result.append(dict(zip(headers, cells)))
    return result


def parse_endpoint(title: str, body: str) -> dict:
    """Parse a single endpoint (##### heading)."""
    # Title looks like: "POST /v1/auth/register"
    m = re.match(rf"^({'|'.join(METHODS)})\s+(.+)$", title)
    if m:
        method = m.group(1).upper()
        path = m.group(2).strip()
        # Strip surrounding backticks if any
        path = path.strip("`")
    else:
        method = "GET"
        path = title

    # First paragraph after the heading is the description
    desc_match = re.match(r"^([^\n]+(?:\n(?!\*\*)[^\n]+)*)", body)
    description = desc_match.group(1).strip() if desc_match else ""

    # Extract meta fields
    meta = extract_endpoint_meta(body)

    # Extract request body JSON
    request_body = extract_code_blocks(body, "Request Body")

    # Extract response JSON — label varies ("Response (200 OK):", "Response (201 Created):")
    # Note: the colon is INSIDE the bold markup: **Response (201 Created):**
    response_body = None
    response_label_match = re.search(r"\*\*(Response[^*]*?:?\*?)\*\*", body)
    if response_label_match:
        response_label = response_label_match.group(1).rstrip(":").strip()
        response_body = extract_code_blocks(body, response_label)
    # Fallback: any code block following a "**Response" line
    if not response_body:
        m = re.search(
            r"\*\*Response[^*]*\*\*:?\s*\n+\s*```(?:json)?\s*\n(.*?)```",
            body,
            re.DOTALL,
        )
        if m:
            response_body = m.group(1).strip()

    # Extract params tables
    query_params = extract_table(body, "Query Parameters")
    body_params = extract_table(body, "Request Body")  # the table version, if any
    # The extract_table for "Request Body" may match the JSON block instead.
    # Try a more specific table-only matcher:
    body_params_table = []
    table_after_body = re.search(
        r"Request Body[^\n]*\n+\s*```[^\n]*\n.*?```\s*\n+(\|[^\n]+\|\n(?:\|[\s:|-]+\|\n)?(?:\|[^\n]+\|\n)+)",
        body,
        re.DOTALL,
    )
    if table_after_body:
        table = table_after_body.group(1)
        rows = [r for r in table.strip().split("\n") if r.strip().startswith("|")]
        if len(rows) >= 2:
            headers = [h.strip() for h in rows[0].strip("|").split("|")]
            data_rows = [r for r in rows[1:] if not re.match(r"^\|[\s:|-]+\|$", r.strip())]
            for r in data_rows:
                cells = [c.strip() for c in r.strip("|").split("|")]
                while len(cells) < len(headers):
                    cells.append("")
                cells = cells[: len(headers)]
                body_params_table.append(dict(zip(headers, cells)))

    error_codes = extract_table(body, "Error Codes")

    return {
        "method": method,
        "path": path,
        "title": description.split("\n")[0] if description else path,
        "description": description,
        "auth": meta.get("auth"),
        "idempotent": meta.get("idempotent"),
        "rateLimit": meta.get("rateLimit"),
        "requestBody": request_body,
        "responseBody": response_body,
        "queryParams": query_params,
        "bodyParams": body_params_table,
        "errorCodes": error_codes,
        "markdown": body,  # keep full markdown as fallback for rendering
    }


def parse_resource(title: str, body: str) -> dict:
    """Parse a resource section (#### Users, #### Profiles, etc.)."""
    slug = to_slug(title)
    # Resources contain zero or more endpoints (##### headings)
    endpoint_sections = split_into_sections(body, 5)

    # The resource intro is everything before the first endpoint
    intro = ""
    if endpoint_sections:
        first_endpoint_start = body.find("#####")
        if first_endpoint_start > 0:
            intro = body[:first_endpoint_start].strip()
    else:
        intro = body.strip()

    endpoints = [parse_endpoint(t, b) for t, b in endpoint_sections]

    return {
        "slug": slug,
        "name": title,
        "intro": intro,
        "endpoints": endpoints,
    }


def parse_domain(title: str, body: str) -> dict:
    """Parse a domain section (### D1: Identity & Social Graph)."""
    # title: "D1: Identity & Social Graph"
    m = re.match(r"^(D\d+):\s*(.+)$", title)
    if m:
        code = m.group(1)
        name = m.group(2).strip()
    else:
        code = ""
        name = title

    slug = code.lower() if code else to_slug(name)

    # Extract owner and base path from the body's first few lines
    owner_match = re.search(r"\*\*Owner:\*\*\s*(.+?)$", body, re.MULTILINE)
    owner = owner_match.group(1).strip() if owner_match else None

    base_path_match = re.search(r"\*\*Base Path:\*\*\s*(.+?)$", body, re.MULTILINE)
    base_path = base_path_match.group(1).strip().strip("`") if base_path_match else None

    # Split body into resource sections (####)
    resource_sections = split_into_sections(body, 4)

    # Build domain intro: everything before the first #### heading
    domain_intro = ""
    first_resource_idx = body.find("\n#### ")
    if first_resource_idx > 0:
        domain_intro_lines = body[:first_resource_idx].split("\n")
        # Strip out Owner/Base Path lines and horizontal rules
        cleaned = [
            line
            for line in domain_intro_lines
            if not re.match(r"^\*\*(Owner|Base Path):\*\*", line)
            and line.strip() != "---"
        ]
        domain_intro = "\n".join(cleaned).strip()

    resources = [parse_resource(t, b) for t, b in resource_sections]

    return {
        "code": code,
        "slug": slug,
        "name": name,
        "owner": owner,
        "basePath": base_path,
        "intro": domain_intro,
        "resources": resources,
    }


def parse_simple_section(title: str, body: str) -> dict:
    """Parse a getting-started or guide section — just title + markdown body."""
    return {
        "slug": to_slug(title),
        "title": title,
        "markdown": body,
    }


# ─── Main parser ─────────────────────────────────────────────────────────

def main():
    md = SRC.read_text(encoding="utf-8")

    # Split into top-level (##) sections
    sections = split_into_sections(md, 2)
    print(f"Found {len(sections)} top-level (##) sections")

    getting_started: list[dict] = []
    guides: list[dict] = []
    domains: list[dict] = []
    appendices: dict[str, dict] = {}

    for title, body in sections:
        if title == "Docs Root":
            continue
        elif title == "Getting Started":
            # Each ### is a getting-started page
            for sub_title, sub_body in split_into_sections(body, 3):
                getting_started.append(parse_simple_section(sub_title, sub_body))
        elif title == "Guides":
            for sub_title, sub_body in split_into_sections(body, 3):
                guides.append(parse_simple_section(sub_title, sub_body))
        elif title == "API Reference":
            for sub_title, sub_body in split_into_sections(body, 3):
                if re.match(r"^D\d+:", sub_title):
                    domains.append(parse_domain(sub_title, sub_body))
        elif title == "Appendices":
            for sub_title, sub_body in split_into_sections(body, 3):
                slug = to_slug(sub_title)
                appendices[slug] = {
                    "slug": slug,
                    "title": sub_title,
                    "markdown": sub_body,
                }

    # ─── Stats ──────────────────────────────────────────────────────────
    total_resources = sum(len(d["resources"]) for d in domains)
    total_endpoints = sum(
        len(r["endpoints"]) for d in domains for r in d["resources"]
    )

    print(f"Getting Started pages: {len(getting_started)}")
    print(f"Guides:                 {len(guides)}")
    print(f"Domains:                {len(domains)}")
    print(f"Resources:              {total_resources}")
    print(f"Endpoints:              {total_endpoints}")
    print(f"Appendices:             {len(appendices)}")

    # ─── Write output ───────────────────────────────────────────────────
    output = {
        "gettingStarted": getting_started,
        "guides": guides,
        "domains": domains,
        "appendices": appendices,
        "stats": {
            "gettingStartedPages": len(getting_started),
            "guidesPages": len(guides),
            "domains": len(domains),
            "resources": total_resources,
            "endpoints": total_endpoints,
            "appendices": len(appendices),
        },
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
