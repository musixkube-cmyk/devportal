#!/usr/bin/env python3
"""
Deduplicate path keys in download/openapi.yaml.

The source spec has duplicate `/notifications`, `/notifications/read`, and
`/notifications/preferences` path entries. The earlier block (under
"Messaging, Notifications" tag) has only 3 endpoints. The later "D19:
NOTIFICATIONS" section has all 7 endpoints (including {id}, read-all,
tokens, tokens/{id}).

Strategy: when a path key appears twice, KEEP the later block (which is
the more complete canonical definition per the domain sections D1-D27)
and REMOVE the earlier occurrence.

We also scan for duplicate schema/parameter/response names under
`components:` and report them (though we don't auto-fix those — they
need manual review).

This script operates on lines, not on parsed YAML, because PyYAML
silently keeps the last duplicate and we need to physically remove the
earlier block from the source text.
"""
import re
import sys
from pathlib import Path

SPEC = Path("/home/z/my-project/download/openapi.yaml")

# Matches a top-level path key under `paths:` — 2-space indent, starts with /
PATH_KEY_RE = re.compile(r"^  (/[^:]+):\s*$")

# Matches a component key under `components:` — 2-space indent, like `  schemas:`
# Then sub-keys are 4-space indent, like `    Notification:`
COMPONENT_KEY_RE = re.compile(r"^  (\w+):\s*$")
SCHEMA_KEY_RE = re.compile(r"^    (\w+):\s*$")


def find_path_blocks(lines: list[str]) -> list[tuple[str, int, int]]:
    """Returns [(path, start_line_1indexed, end_line_inclusive), ...]
    for each path block under `paths:`.

    A path block starts at a `  /foo:` line and ends at the line before
    the next path key (or before `components:`).
    """
    blocks = []
    in_paths = False
    current_path = None
    current_start = None

    for i, line in enumerate(lines, 1):
        # Detect entry into `paths:` section
        if line.rstrip() == "paths:":
            in_paths = True
            continue
        # Detect exit from `paths:` section
        if in_paths and not line.startswith(" ") and line.strip():
            # Hit a top-level key (no indent) — paths: section is over
            if current_path:
                blocks.append((current_path, current_start, i - 1))
                current_path = None
            in_paths = False
            continue
        if not in_paths:
            continue
        m = PATH_KEY_RE.match(line)
        if m:
            # New path key — close out the previous block
            if current_path:
                blocks.append((current_path, current_start, i - 1))
            current_path = m.group(1)
            current_start = i

    # Close the last block
    if current_path:
        blocks.append((current_path, current_start, len(lines)))

    return blocks


def find_duplicate_paths(blocks: list[tuple[str, int, int]]) -> dict[str, list[tuple[int, int]]]:
    """Returns {path: [(start, end), ...]} for paths that appear more than once."""
    by_path: dict[str, list[tuple[int, int]]] = {}
    for path, start, end in blocks:
        by_path.setdefault(path, []).append((start, end))
    return {p: spans for p, spans in by_path.items() if len(spans) > 1}


def remove_earlier_blocks(
    lines: list[str], dup_spans: list[tuple[int, int]]
) -> list[str]:
    """Removes the specified (start, end) line ranges (1-indexed, inclusive)
    from `lines`. Also removes any trailing blank line immediately after
    each removed block so we don't leave double blank lines.

    When multiple ranges are removed, we process from the END backwards
    so line numbers stay valid.
    """
    # Sort descending by start line so we can mutate without reindexing
    spans = sorted(dup_spans, key=lambda s: s[0], reverse=True)
    # Track which 1-indexed line numbers to delete
    to_delete: set[int] = set()
    for start, end in spans:
        for ln in range(start, end + 1):
            to_delete.add(ln)
        # Also delete one trailing blank line if present (to avoid double blanks)
        if end + 1 <= len(lines) and not lines[end].strip():
            # lines is 0-indexed; line `end+1` is at index `end`
            to_delete.add(end + 1)
    return [line for i, line in enumerate(lines, 1) if i not in to_delete]


def scan_component_duplicates(lines: list[str]) -> dict[str, list[str]]:
    """Scans `components:` sub-sections (schemas, parameters, responses,
    securitySchemes) for duplicate keys. Returns {section: [dup_key, ...]}."""
    dups: dict[str, list[str]] = {}
    current_section = None
    seen_in_section: dict[str, set[str]] = {}

    for line in lines:
        # Detect `components:` section
        if line.rstrip() == "components:":
            current_section = "__components__"
            continue
        # Sub-section under components: 4-space indent for items, 2-space for section name
        if current_section == "__components__":
            m = COMPONENT_KEY_RE.match(line)
            if m and not line.startswith("    "):
                # New sub-section like `  schemas:`, `  parameters:`, etc.
                section_name = m.group(1)
                current_section = f"__components__.{section_name}"
                seen_in_section.setdefault(current_section, set())
                continue
            # Item key under a sub-section (4-space indent)
            if current_section and current_section.startswith("__components__."):
                sm = SCHEMA_KEY_RE.match(line)
                if sm:
                    key = sm.group(1)
                    if key in seen_in_section[current_section]:
                        section_short = current_section.split(".")[-1]
                        dups.setdefault(section_short, [])
                        if key not in dups[section_short]:
                            dups[section_short].append(key)
                    else:
                        seen_in_section[current_section].add(key)
        elif current_section and not line.startswith(" ") and line.strip():
            # Left components: section
            current_section = None

    return dups


def main() -> int:
    if not SPEC.exists():
        print(f"ERROR: {SPEC} not found", file=sys.stderr)
        return 1

    lines = SPEC.read_text(encoding="utf-8").splitlines(keepends=False)
    print(f"Loaded {SPEC}: {len(lines):,} lines")

    # 1. Find all path blocks
    blocks = find_path_blocks(lines)
    print(f"Found {len(blocks)} path blocks under `paths:`")

    # 2. Find duplicates
    dups = find_duplicate_paths(blocks)
    if not dups:
        print("No duplicate path keys found.")
    else:
        print(f"\nFound {len(dups)} duplicate path(s):")
        for path, spans in dups.items():
            print(f"  {path}")
            for i, (s, e) in enumerate(spans):
                label = "KEEP" if i == len(spans) - 1 else "REMOVE"
                print(f"    [{label}] lines {s}-{e} ({e - s + 1} lines)")

    # 3. Remove earlier occurrences
    to_remove: list[tuple[int, int]] = []
    for path, spans in dups.items():
        # Keep the LAST occurrence, remove all earlier ones
        for span in spans[:-1]:
            to_remove.append(span)

    if not to_remove:
        print("\nNothing to remove.")
    else:
        total_removed = sum(e - s + 1 for s, e in to_remove)
        print(f"\nRemoving {len(to_remove)} earlier block(s), {total_removed} lines total")
        lines = remove_earlier_blocks(lines, to_remove)
        print(f"After removal: {len(lines):,} lines")

    # 4. Scan for component duplicates (informational)
    print("\nScanning components: for duplicates...")
    comp_dups = scan_component_duplicates(lines)
    if not comp_dups:
        print("  No duplicate component keys found.")
    else:
        print("  ⚠️  Duplicate component keys found (manual review needed):")
        for section, keys in comp_dups.items():
            print(f"    {section}: {keys}")

    # 5. Write back
    SPEC.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nWrote {SPEC} ({len(lines):,} lines)")

    # 6. Validate with PyYAML (strict mode)
    print("\nValidating with PyYAML...")
    try:
        import yaml

        # Use a loader that raises on duplicate keys
        class StrictLoader(yaml.SafeLoader):
            pass

        def no_duplicates(loader, node, deep=False):
            """Reject duplicate keys in mapping nodes."""
            mapping = {}
            for key_node, value_node in node.value:
                key = loader.construct_object(key_node, deep=deep)
                if key in mapping:
                    raise yaml.constructor.ConstructorError(
                        None,
                        None,
                        f"Duplicate mapping key: {key!r}",
                        key_node.start_mark,
                    )
                mapping[key] = loader.construct_object(value_node, deep=deep)
            return mapping

        StrictLoader.add_constructor(
            yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, no_duplicates
        )

        with SPEC.open("r", encoding="utf-8") as f:
            spec = yaml.load(f, Loader=StrictLoader)
        print("✅ Strict YAML validation passed (no duplicate keys)")
        print(f"   OpenAPI version: {spec.get('openapi')}")
        print(f"   Paths: {len(spec['paths'])}")
        print(f"   Schemas: {len(spec['components'].get('schemas', {}))}")
        print(f"   Security schemes: {list(spec['components']['securitySchemes'].keys())}")
    except Exception as e:
        print(f"❌ YAML validation FAILED: {e}", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
