#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, TypedDict

RULES_DIR = Path(__file__).parent.parent.parent / "rules"


def _load_typescript_rules() -> dict[str, Any]:
    rules_file = RULES_DIR / "typescript.json"
    if rules_file.exists():
        try:
            with open(rules_file, encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {}


_TS_RULES = _load_typescript_rules()
_TYPE_CONFIG = _TS_RULES.get("type_checking", {})
_MESSAGES = _TS_RULES.get("messages", {})


class EditOperation(TypedDict):
    old_string: str
    new_string: str


class WriteToolInput(TypedDict):
    file_path: str
    content: str


class EditToolInput(TypedDict):
    file_path: str
    old_string: str
    new_string: str


class MultiEditToolInput(TypedDict):
    file_path: str
    edits: list[EditOperation]


class PostToolUseInput(TypedDict):
    session_id: str
    tool_name: str
    transcript_path: str
    cwd: str
    hook_event_name: str
    tool_input: WriteToolInput | EditToolInput | MultiEditToolInput
    tool_response: dict[str, Any]


def main() -> None:
    """Main entry point for the PostToolUse hook."""
    hook_filename = Path(__file__).stem.replace("_", "-")
    print(f"\n[{hook_filename}]", file=sys.stderr)

    input_data = sys.stdin.read()
    if not input_data:
        sys.exit(0)

    try:
        data: PostToolUseInput = json.loads(input_data)
        tool_input = data["tool_input"]
    except (json.JSONDecodeError, KeyError):
        sys.exit(0)

    file_path = ""
    if "file_path" in tool_input:
        file_path = tool_input["file_path"]  # type: ignore[literal-required]

    if not file_path or not _is_valid_typescript_file(file_path):
        print(f"[typescript-any-check] Skipping: Not a TypeScript file: {file_path}")
        sys.exit(0)

    path = Path(file_path)
    if not path.exists():
        print(f"[typescript-any-check] Skipping: File does not exist: {file_path}")
        sys.exit(0)

    content = path.read_text()
    issues = check_any_usage(content, file_path)

    if not issues:
        print("[typescript-any-check] Success: No 'any' type usage detected")
        sys.exit(0)

    # Print error message and exit with code 2 to block the tool
    error_message = build_error_message(issues, file_path)
    print(error_message, file=sys.stderr)
    sys.exit(2)


def check_any_usage(content: str, file_path: str) -> list[dict[str, Any]]:
    """Check for 'any' type usage in TypeScript code.
    
    Returns list of issues found.
    """
    issues: list[dict[str, Any]] = []
    lines = content.split("\n")
    
    # Patterns to detect 'any' usage
    # Matches: `: any`, `<any>`, `Array<any>`, etc.
    # But NOT: 'company', 'many', comments, strings
    any_pattern = re.compile(
        r'''
        (?:^|[^a-zA-Z0-9_])  # Not preceded by alphanumeric or underscore
        (
            :\s*any\b|           # : any
            <any>|               # <any>
            <any,|               # <any,
            ,\s*any>|            # , any>
            Array<any>|          # Array<any>
            Promise<any>|        # Promise<any>
            \(\s*\)\s*:\s*any|   # () : any (function return)
            as\s+any\b           # as any
        )
        ''',
        re.VERBOSE | re.MULTILINE
    )
    
    for line_num, line in enumerate(lines, start=1):
        # Skip comments and strings (simple heuristic)
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('/*') or stripped.startswith('*'):
            continue
        
        # Check for @ts-ignore or @ts-expect-error on previous or same line
        has_ts_ignore = False
        if line_num > 1:
            prev_line = lines[line_num - 2].strip()
            has_ts_ignore = '@ts-ignore' in prev_line or '@ts-expect-error' in prev_line
        has_ts_ignore = has_ts_ignore or '@ts-ignore' in line or '@ts-expect-error' in line
        
        matches = any_pattern.finditer(line)
        for match in matches:
            # Skip if inside string literal (simple check)
            before_match = line[:match.start()]
            single_quotes = before_match.count("'") - before_match.count("\\'")
            double_quotes = before_match.count('"') - before_match.count('\\"')
            backticks = before_match.count('`') - before_match.count('\\`')
            
            if single_quotes % 2 != 0 or double_quotes % 2 != 0 or backticks % 2 != 0:
                continue  # Inside a string
            
            issues.append({
                'line': line_num,
                'column': match.start() + 1,
                'matched_text': match.group(1).strip(),
                'full_line': line.strip(),
                'has_ts_ignore': has_ts_ignore,
            })
    
    return issues


def build_error_message(issues: list[dict[str, Any]], file_path: str) -> str:
    """Build formatted error message for 'any' type usage."""
    message_parts = [
        "\n<typescript-any-usage-error>",
        f"**CRITICAL: 'any' type usage detected in {file_path}!**",
        "",
        "You are STRICTLY PROHIBITED from using the 'any' type in TypeScript code.",
        "The user has explicitly forbidden 'any' type usage.",
        "",
        f"Found {len(issues)} instance(s) of 'any' type usage:",
        "",
    ]
    
    for issue in issues:
        line = issue['line']
        matched = issue['matched_text']
        full_line = issue['full_line']
        has_ignore = issue['has_ts_ignore']
        
        ignore_note = " (has @ts-ignore/expect-error)" if has_ignore else ""
        message_parts.append(f"  Line {line}{ignore_note}: {matched}")
        message_parts.append(f"    {full_line}")
        message_parts.append("")
    
    message_parts.extend([
        "**You MUST fix this by:**",
        "1. Replace 'any' with 'unknown' if the type is truly unknown, then use type guards",
        "2. Use proper generic types (e.g., <T>, <T extends SomeType>)",
        "3. Use union types (e.g., string | number | null)",
        "4. Use specific interface or type definitions",
        "5. Use utility types (Partial<T>, Record<K, V>, etc.)",
        "",
        "**Examples of correct alternatives:**",
        "  ❌ const data: any = await fetch(...)",
        "  ✅ const data: unknown = await fetch(...)",
        "     if (typeof data === 'object' && data !== null) { ... }",
        "",
        "  ❌ function process(input: any): any { ... }",
        "  ✅ function process<T>(input: T): T { ... }",
        "  ✅ function process(input: unknown): string | number { ... }",
        "",
        "  ❌ const items: any[] = []",
        "  ✅ const items: Item[] = []",
        "  ✅ const items: Array<string | number> = []",
        "",
        "</typescript-any-usage-error>\n",
    ])
    
    return "\n".join(message_parts)


def _is_valid_typescript_file(file_path: str) -> bool:
    if not file_path:
        return False

    valid_extensions = set(_TS_RULES.get("extensions", [".ts", ".tsx", ".mts", ".cts"]))
    excluded_extensions = _TS_RULES.get("excluded_extensions", [".d.ts"])
    path = Path(file_path)

    if path.suffix not in valid_extensions:
        return False

    for excluded in excluded_extensions:
        if file_path.endswith(excluded):
            return False

    return True


if __name__ == "__main__":
    main()

