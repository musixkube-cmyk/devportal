#!/usr/bin/env python3
"""
Parse /tmp/musicosy-api-arch.md (extracted from MUSICOSY API ARCHITECTURE.docx)
into structured JSON files for the Next.js portal.

Outputs:
  src/data/architecture/domains.json       (D1-D27 with endpoints + contracts)
  src/data/architecture/modals.json        (modal specs)
  src/data/architecture/components.json    (UI component catalog by context)
  src/data/architecture/feature-map.json   (feature → domain mapping)
"""

import json
import re
from pathlib import Path

SRC = Path("/tmp/musicosy-api-arch.md")
OUT_DIR = Path("/home/z/my-project/src/data/architecture")
OUT_DIR.mkdir(parents=True, exist_ok=True)

text = SRC.read_text(encoding="utf-8")

# ---------- DOMAINS ----------
# A domain block starts with "**D<N>: <Name>**" and ends at the next "**D" or section header.
DOMAIN_RE = re.compile(r"^\*\*D(\d+):\s*(.+?)\*\*\s*$", re.MULTILINE)

domains_raw = []
for m in DOMAIN_RE.finditer(text):
    start = m.end()
    # next domain or section header
    next_m = DOMAIN_RE.search(text, pos=m.end())
    # also find next "**SECTION" header
    sec_m = re.search(r"^\*\*SECTION \d", text[m.end():], re.MULTILINE)
    end_candidates = []
    if next_m:
        end_candidates.append(next_m.start())
    if sec_m:
        end_candidates.append(m.end() + sec_m.start())
    end = min(end_candidates) if end_candidates else len(text)
    body = text[start:end]
    domains_raw.append({
        "code": f"D{m.group(1)}",
        "name": m.group(2).strip(),
        "body": body,
    })


def parse_table(body):
    """Parse a pandoc-style grid table into list-of-lists.
    Pandoc grid tables in this doc use:
      - top border:    all dashes
      - header row:    one line
      - col separator: dashes with spaces (defines column widths)
      - data rows:     one or more lines per row, separated by EMPTY lines
      - bottom border: optional `===` line OR implicit (end when content changes)
    Returns None if no table found."""
    lines = body.splitlines()
    tbl_start = None
    tbl_end = None
    for i, ln in enumerate(lines):
        s = ln.strip()
        if tbl_start is None:
            if s.startswith("---") and len(s) > 10:
                tbl_start = i
            continue
        # We've seen the top border; now look for the end.
        # End is: an `===` line, OR another all-dashes `---` line (bottom border),
        # OR a line that begins with `-   **` (bullet of implementation contract).
        # We deliberately do NOT end on a `**...` line because cells inside the
        # table can contain bold text like `**Page/container**`.
        if s.startswith("===") and len(s) > 10:
            tbl_end = i
            break
        # Bottom border: all dashes (no spaces), length > 10, after we've seen the
        # col separator (which has spaces). This avoids matching the col separator itself.
        if (
            s.startswith("---")
            and " " not in s
            and len(s) > 10
            and tbl_start is not None
        ):
            tbl_end = i
            break
        # Implementation contract bullet: `-   **Actors:**`
        if s.startswith("-   **") and i > tbl_start + 2:
            tbl_end = i
            break
    if tbl_start is None or tbl_end is None:
        return None
    # Find col separator line (second line of dashes, after header)
    sep_idx = None
    for i in range(tbl_start + 1, tbl_end):
        s = lines[i].strip()
        if s.startswith("---") and " " in s:
            sep_idx = i
            break
    if sep_idx is None:
        return None
    sep_line = lines[sep_idx]
    # Column boundaries are runs of dashes separated by spaces.
    cols = []
    i = 0
    while i < len(sep_line):
        if sep_line[i] == "-":
            start = i
            while i < len(sep_line) and sep_line[i] == "-":
                i += 1
            cols.append((start, i))
        else:
            i += 1
    if not cols:
        return None

    def split_row(line):
        return [line[s:e].strip() for s, e in cols]

    # Header is line tbl_start + 1 (between top border and col separator).
    header = split_row(lines[tbl_start + 1])
    rows = []
    # Data rows live between sep_idx+1 and tbl_end. Multi-line cells are joined.
    # A new row starts when the line is non-empty and has content in the first column.
    cur_cells = ["" for _ in cols]
    cur_has_content = False
    for i in range(sep_idx + 1, tbl_end):
        ln = lines[i]
        if not ln.strip():
            # empty line = row boundary
            if cur_has_content:
                rows.append([c.strip() for c in cur_cells])
            cur_cells = ["" for _ in cols]
            cur_has_content = False
            continue
        # Detect new row start: first column has non-space content AND current row
        # already has content (so this is a continuation of a wrapped cell, not a new row).
        first_col_content = ln[cols[0][0]:cols[0][1]].strip() if len(ln) > cols[0][0] else ""
        if first_col_content and cur_has_content:
            # previous row ended without an empty line — flush it
            rows.append([c.strip() for c in cur_cells])
            cur_cells = ["" for _ in cols]
            cur_has_content = False
        for j, (s, e) in enumerate(cols):
            cell_part = ln[s:e] if len(ln) >= e else ln[s:].ljust(e - s)
            if cur_cells[j]:
                cur_cells[j] += " " + cell_part.strip()
            else:
                cur_cells[j] = cell_part.strip()
            if cell_part.strip():
                cur_has_content = True
    if cur_has_content:
        rows.append([c.strip() for c in cur_cells])
    return {"header": header, "rows": rows}


def parse_implementation_contract(body):
    """Pull the bulleted Implementation Contract list."""
    m = re.search(r"\*\*Implementation Contract:\*\*\s*\n(.*?)(?=\n\*\*D|\n\*\*SECTION|\Z)",
                  body, re.DOTALL)
    if not m:
        return {}
    block = m.group(1)
    contract = {}
    # Bullets like "- **Field:** value"
    for bm in re.finditer(r"-\s+\*\*([^*]+):\*\*\s*(.+?)(?=\n-\s+\*\*|\Z)", block, re.DOTALL):
        key = bm.group(1).strip().lower().replace(" ", "_")
        val = bm.group(2).strip().replace("\n", " ")
        val = re.sub(r"\s+", " ", val)
        contract[key] = val
    return contract


def normalize_endpoint_row(header, row):
    """Convert a raw endpoint row to a clean dict."""
    if len(row) < len(header):
        row = row + [""] * (len(header) - len(row))
    d = {}
    for h, v in zip(header, row):
        key = h.strip().lower().replace(" ", "_").replace("/", "_per_")
        # Clean up escaped brackets from pandoc
        v = v.replace("\\[", "[").replace("\\]", "]").replace("\\_", "_")
        # Strip markdown bold markers
        v = v.replace("**", "")
        # Normalize non-breaking spaces
        v = v.replace("\xa0", " ")
        # Collapse runs of whitespace
        v = re.sub(r"\s+", " ", v).strip()
        d[key] = v
    return d


def clean_cell(v: str) -> str:
    """Strip markdown bold markers and normalize whitespace in a cell value."""
    v = v.replace("**", "")
    v = v.replace("\\[", "[").replace("\\]", "]").replace("\\_", "_")
    v = v.replace("\xa0", " ")
    v = re.sub(r"\s+", " ", v).strip()
    return v


def merge_continuation_rows(rows: list, primary_key: str, max_other_fields: int = 2) -> list:
    """Merge rows where the primary key field is a continuation of the
    previous row's primary key (e.g. multi-line bold '**Reusable domain\nUI**'
    was split into two rows, or 'DSP\\nDistribution' was split).

    Heuristic: a continuation row's primary key has content but FEWER than
    `max_other_fields` other fields have content. Real new rows have content
    in most fields; continuation rows only have wrapped text from the
    previous row's last cell(s)."""
    if not rows:
        return rows
    merged = []
    for row in rows:
        pk = row.get(primary_key, "")
        non_primary = [v for k, v in row.items() if k != primary_key and v]
        is_continuation = bool(
            merged and pk and len(non_primary) <= max_other_fields
        )
        if is_continuation:
            merged[-1][primary_key] = (merged[-1].get(primary_key, "") + " " + pk).strip()
            # Also merge any non-empty fields from the continuation row
            for k, v in row.items():
                if k != primary_key and v:
                    existing = merged[-1].get(k, "")
                    merged[-1][k] = (existing + " " + v).strip() if existing else v
        else:
            merged.append(row)
    return merged


domains = []
for d in domains_raw:
    body = d["body"]
    # Extract owner line: "**Owner: <X>**"
    owner_m = re.search(r"\*\*Owner:\s*(.+?)\*\*", body)
    owner = owner_m.group(1).strip() if owner_m else ""
    table = parse_table(body)
    endpoints = []
    if table:
        for row in table["rows"]:
            endpoints.append(normalize_endpoint_row(table["header"], row))
    contract = parse_implementation_contract(body)
    domains.append({
        "code": d["code"],
        "name": d["name"],
        "owner": owner,
        "endpoints": endpoints,
        "contract": contract,
    })

(OUT_DIR / "domains.json").write_text(
    json.dumps(domains, indent=2, ensure_ascii=False), encoding="utf-8"
)
print(f"domains.json: {len(domains)} domains, "
      f"{sum(len(d['endpoints']) for d in domains)} endpoints")


# ---------- MODALS ----------
MODAL_RE = re.compile(r"^\*\*Modal:\s*(.+?)\*\*\s*$", re.MULTILINE)
modals = []
for m in MODAL_RE.finditer(text):
    start = m.end()
    next_m = MODAL_RE.search(text, pos=m.end())
    sec_m = re.search(r"^\*\*SECTION \d", text[m.end():], re.MULTILINE)
    end_candidates = []
    if next_m:
        end_candidates.append(next_m.start())
    if sec_m:
        end_candidates.append(m.end() + sec_m.start())
    end = min(end_candidates) if end_candidates else len(text)
    body = text[start:end]
    table = parse_table(body)
    fields = {}
    if table:
        for row in table["rows"]:
            if len(row) >= 2:
                key = row[0].strip().rstrip(":").lower().replace(" ", "_")
                val = row[1].strip().replace("\\[", "[").replace("\\]", "]").replace("\\_", "_")
                fields[key] = val
    modals.append({"name": m.group(1).strip(), "fields": fields})

(OUT_DIR / "modals.json").write_text(
    json.dumps(modals, indent=2, ensure_ascii=False), encoding="utf-8"
)
print(f"modals.json: {len(modals)} modals")


# ---------- COMPONENTS ----------
# Section 2 has 5 catalogs: Personal Context, Creator Studio, Business Context,
# Production & Commerce, Podcast.
# Each catalog has a "**Component Catalog --- <name>**" header followed by a table.
COMP_CATALOG_RE = re.compile(
    r"^\*\*Component Catalog[^\*]*?---\s*(.+?)\*\*\s*$", re.MULTILINE
)
components_by_context = []
for m in COMP_CATALOG_RE.finditer(text):
    context_name = m.group(1).strip().rstrip("*")
    body = text[m.end():]
    # Table follows shortly.
    table = parse_table(body[:8000])
    items = []
    if table:
        for row in table["rows"]:
            if len(row) < len(table["header"]):
                row = row + [""] * (len(table["header"]) - len(row))
            item = {}
            for h, v in zip(table["header"], row):
                key = h.strip().lower().replace(" ", "_")
                item[key] = clean_cell(v)
            if item.get("component"):
                items.append(item)
        # Merge continuation rows where 'component' is a tail fragment
        items = merge_continuation_rows(items, "component")
    components_by_context.append({"context": context_name, "components": items})

# Also capture the component TYPE definitions table at the top of section 2.
sec2_start = text.find("**SECTION 2: UI COMPONENT CLASSIFICATION**")
sec2_end = text.find("**SECTION 3: MODAL DOCUMENTATION**")
sec2 = text[sec2_start:sec2_end]
type_defs = []
type_table = parse_table(sec2[:4000])
if type_table:
    raw_rows = []
    for row in type_table["rows"]:
        if len(row) < len(type_table["header"]):
            row = row + [""] * (len(type_table["header"]) - len(row))
        item = {}
        for h, v in zip(type_table["header"], row):
            key = h.strip().lower().replace(" ", "_")
            item[key] = clean_cell(v)
        if item.get("type"):
            raw_rows.append(item)
    type_defs = merge_continuation_rows(raw_rows, "type")

(OUT_DIR / "components.json").write_text(
    json.dumps({
        "type_definitions": type_defs,
        "catalogs": components_by_context,
    }, indent=2, ensure_ascii=False),
    encoding="utf-8"
)
total_components = sum(len(c["components"]) for c in components_by_context)
print(f"components.json: {len(components_by_context)} catalogs, "
      f"{total_components} components, {len(type_defs)} type defs")


# ---------- FEATURE-TO-DOMAIN MAP ----------
# Section 4 has one big table.
sec4_start = text.find("**SECTION 4: FEATURE-TO-DOMAIN MAPPING**")
sec4_end = text.find("**SECTION 5: OPENAPI COMPOSITION**")
sec4 = text[sec4_start:sec4_end]
feature_map = []
fm_table = parse_table(sec4)
if fm_table:
    raw_rows = []
    for row in fm_table["rows"]:
        if len(row) < len(fm_table["header"]):
            row = row + [""] * (len(fm_table["header"]) - len(row))
        item = {}
        for h, v in zip(fm_table["header"], row):
            key = h.strip().lower().replace("/", "_per_").replace(" ", "_")
            item[key] = clean_cell(v)
        if item.get("feature"):
            raw_rows.append(item)
    feature_map = merge_continuation_rows(raw_rows, "feature")

(OUT_DIR / "feature-map.json").write_text(
    json.dumps(feature_map, indent=2, ensure_ascii=False), encoding="utf-8"
)
print(f"feature-map.json: {len(feature_map)} features mapped")

print("\nAll architecture data extracted to:", OUT_DIR)
