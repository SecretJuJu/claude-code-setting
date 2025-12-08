#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Post-tool-use JSON validation hook for ai-todolist.json.
Validates JSON format and reports errors when the file is written/edited.
"""

from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path
from typing import Any, NoReturn, TypedDict


class Config:
    """Configuration constants for the hook."""

    EXIT_CODE_WARNING: int = 2
    EXIT_CODE_SUCCESS: int = 0
    TARGET_FILENAME: str = "ai-todolist.json"


class WriteToolInput(TypedDict):
    file_path: str
    content: str


class EditToolInput(TypedDict):
    file_path: str
    old_string: str
    new_string: str


class MultiEditToolInput(TypedDict):
    file_path: str
    edits: list[dict[str, str]]


class PostToolUseInput(TypedDict):
    session_id: str
    tool_name: str
    transcript_path: str
    cwd: str
    hook_event_name: str
    tool_input: WriteToolInput | EditToolInput | MultiEditToolInput
    tool_response: dict[str, Any]


def main() -> None:
    """Main entry point for the JSON validation hook."""
    hook_filename = Path(__file__).stem.replace("_", "-")
    print(f"\n[{hook_filename}]", file=sys.stderr)

    try:
        _execute_hook_pipeline()
    except Exception as e:
        _handle_hook_error(e)


def _execute_hook_pipeline() -> NoReturn:
    """Execute the main hook logic pipeline."""
    data = parse_input()
    if not should_process(data):
        sys.exit(Config.EXIT_CODE_SUCCESS)

    file_path = extract_file_path(data)
    if not file_path:
        sys.exit(Config.EXIT_CODE_SUCCESS)

    # Only validate ai-todolist.json
    if not file_path.endswith(Config.TARGET_FILENAME):
        sys.exit(Config.EXIT_CODE_SUCCESS)

    path_obj = Path(file_path)
    if not path_obj.exists():
        sys.exit(Config.EXIT_CODE_SUCCESS)

    errors = validate_json_file(path_obj)
    handle_findings(errors, file_path)


def parse_input() -> PostToolUseInput:
    """Parse and validate stdin input."""
    input_raw = sys.stdin.read()
    if not input_raw.strip():
        sys.exit(Config.EXIT_CODE_SUCCESS)

    try:
        parsed_data: PostToolUseInput = json.loads(input_raw)
        return parsed_data
    except (json.JSONDecodeError, Exception) as e:
        print(f"Error parsing hook input: {e}", file=sys.stderr)
        sys.exit(Config.EXIT_CODE_SUCCESS)


def should_process(data: PostToolUseInput) -> bool:
    """Determine if the input should be processed."""
    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input")

    if not tool_name or not tool_input:
        return False

    if not isinstance(tool_input, dict):
        return False

    if tool_name not in ["Write", "Edit", "MultiEdit"]:
        return False

    return True


def extract_file_path(data: PostToolUseInput) -> str:
    """Extract file path from input data."""
    tool_input = data.get("tool_input", {})
    if isinstance(tool_input, dict):
        if "file_path" in tool_input:
            return tool_input["file_path"]  # type: ignore[literal-required]
        elif "target_file" in tool_input:
            return tool_input["target_file"]  # type: ignore[typeddict-item]
    return ""


def validate_json_file(path: Path) -> list[str]:
    """Validate the JSON file and return list of errors."""
    errors: list[str] = []

    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as e:
        return [f"Encoding error: {e}"]
    except OSError as e:
        return [f"File read error: {e}"]

    # Check if content is empty
    if not content.strip():
        return ["File is empty"]

    # Try to parse JSON
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        # Provide detailed error information
        error_msg = f"JSON parse error at line {e.lineno}, column {e.colno}: {e.msg}"

        # Try to identify common issues
        hints: list[str] = []

        if "Expecting property name" in e.msg:
            hints.append("Possible cause: trailing comma before closing brace/bracket")
        if "Expecting value" in e.msg:
            hints.append("Possible cause: missing value after colon or in array")
        if "Expecting ',' delimiter" in e.msg:
            hints.append("Possible cause: missing comma between elements")
        if "Invalid control character" in e.msg:
            hints.append("Possible cause: unescaped newline or tab in string (use \\n or \\t)")
        if "Expecting ':' delimiter" in e.msg:
            hints.append("Possible cause: missing colon after key in object")

        # Check for common escape issues
        if '\\"' not in content and '"' in content:
            # Count quotes to detect potential issues
            quote_positions = [i for i, c in enumerate(content) if c == '"']
            if len(quote_positions) % 2 != 0:
                hints.append("Possible cause: unmatched quote - check for unescaped quotes in strings")

        if "\\" in content and "\\\\" not in content:
            hints.append("Possible cause: unescaped backslash - use \\\\ for literal backslash")

        errors.append(error_msg)
        errors.extend(hints)

        # Show context around error
        lines = content.split("\n")
        if 0 < e.lineno <= len(lines):
            context_start = max(0, e.lineno - 3)
            context_end = min(len(lines), e.lineno + 2)
            errors.append("\nContext around error:")
            for i in range(context_start, context_end):
                line_num = i + 1
                prefix = ">>> " if line_num == e.lineno else "    "
                errors.append(f"{prefix}{line_num:4d} | {lines[i]}")

        return errors

    # Validate structure (basic schema check)
    structure_errors = validate_schema(data)
    errors.extend(structure_errors)

    # Check if prettified (2-space indent)
    try:
        prettified = json.dumps(data, indent=2, ensure_ascii=False)
        if content.strip() != prettified.strip():
            errors.append("Warning: JSON is not prettified with 2-space indent")
    except Exception:
        pass

    return errors


def validate_schema(data: dict[str, Any]) -> list[str]:
    """Validate basic schema structure."""
    errors: list[str] = []

    if not isinstance(data, dict):
        return ["Root must be a JSON object"]

    # Check required top-level keys
    required_keys = ["meta", "tasks"]
    for key in required_keys:
        if key not in data:
            errors.append(f"Missing required key: '{key}'")

    # Validate meta
    if "meta" in data:
        meta = data["meta"]
        if not isinstance(meta, dict):
            errors.append("'meta' must be an object")
        else:
            meta_required = ["execution_started", "all_goals_accomplished"]
            for key in meta_required:
                if key not in meta:
                    errors.append(f"Missing 'meta.{key}'")

    # Validate tasks
    if "tasks" in data:
        tasks = data["tasks"]
        if not isinstance(tasks, list):
            errors.append("'tasks' must be an array")
        else:
            for i, task in enumerate(tasks):
                if not isinstance(task, dict):
                    errors.append(f"tasks[{i}] must be an object")
                    continue

                task_required = ["id", "title", "status"]
                for key in task_required:
                    if key not in task:
                        errors.append(f"tasks[{i}] missing '{key}'")

                # Validate status enum
                if "status" in task:
                    valid_statuses = ["pending", "in_progress", "completed", "blocked"]
                    if task["status"] not in valid_statuses:
                        errors.append(
                            f"tasks[{i}].status '{task['status']}' is invalid. "
                            f"Must be one of: {valid_statuses}"
                        )

    return errors


def handle_findings(errors: list[str], file_path: str) -> NoReturn:
    """Handle detected errors and exit appropriately."""
    if not errors:
        print("[validate-ai-todolist-json] ✅ Valid JSON")
        sys.exit(Config.EXIT_CODE_SUCCESS)

    display_path = _get_display_path(file_path)
    error_list = "\n".join(f"  • {e}" for e in errors)

    message = f"""
<json-validation-error>
❌ JSON VALIDATION FAILED: {display_path}

{error_list}

**Fix the JSON errors before proceeding.**

Common escape rules:
  • Quote in string: \\"
  • Backslash: \\\\
  • Newline: \\n
  • Tab: \\t

Validate command:
  python3 -c "import json; json.load(open('{file_path}'))"

</json-validation-error>
"""

    print(message, file=sys.stderr)
    sys.exit(Config.EXIT_CODE_WARNING)


def _get_display_path(file_path: str) -> str:
    """Get display-friendly path relative to cwd if possible."""
    cwd = Path.cwd()
    try:
        path_obj = Path(file_path).resolve()
        if path_obj.is_relative_to(cwd):
            return str(path_obj.relative_to(cwd))
        return file_path
    except (ValueError, OSError):
        return file_path


def _handle_hook_error(e: Exception) -> NoReturn:
    """Handle errors in hook execution."""
    print(f"ERROR in JSON validation hook: {e}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    sys.exit(Config.EXIT_CODE_SUCCESS)


if __name__ == "__main__":
    main()
