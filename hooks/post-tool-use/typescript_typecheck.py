#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
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


class EditOperation(TypedDict):
    old_string: str
    new_string: str


class PostToolUseInput(TypedDict):
    session_id: str
    tool_name: str
    transcript_path: str
    cwd: str
    hook_event_name: str
    tool_input: ClaudeCodeToolInput
    tool_response: dict[str, Any]


class WriteToolInput(TypedDict):
    file_path: str
    content: str


class MultiEditToolInput(TypedDict):
    file_path: str
    edits: list[EditOperation]


class EditToolInput(TypedDict):
    file_path: str
    old_string: str
    new_string: str


class NotebookEditToolInput(TypedDict):
    notebook_path: str
    new_source: str


ClaudeCodeToolInput = WriteToolInput | EditToolInput | MultiEditToolInput | NotebookEditToolInput


@dataclass
class TscResults:
    output: str
    exit_code: int
    has_type_errors: bool


def main() -> None:
    """Main entry point for the TypeScript typecheck hook."""
    hook_filename = Path(__file__).stem.replace("_", "-")
    print(f"\n[{hook_filename}]", file=sys.stderr)

    input_data = sys.stdin.read()
    file_path = get_target_file_path(input_data)
    if not file_path:
        print("[tsc-hook] Skipping: No valid TypeScript file path provided")
        sys.exit(0)

    tsc_path = find_tsc_executable()
    if not tsc_path:
        print("[tsc-hook] Skipping: tsc not found in node_modules or system PATH")
        sys.exit(0)

    results = execute_tsc_typecheck(tsc_path, file_path)
    handle_results_and_exit(results)


def get_target_file_path(input_data: str) -> str | None:
    """Extract and validate the target TypeScript file path from input.

    Returns:
        The file path if it's a valid TypeScript file, None otherwise
    """
    if not input_data:
        return None

    try:
        data: PostToolUseInput = json.loads(input_data)
        tool_input = data["tool_input"]
    except (json.JSONDecodeError, KeyError, TypeError):
        return None

    file_path = ""
    if "file_path" in tool_input:
        file_path = tool_input["file_path"]  # type: ignore[literal-required]
    elif "notebook_path" in tool_input:
        file_path = tool_input["notebook_path"]  # type: ignore[literal-required]
    elif "target_file" in tool_input:  # Legacy support
        file_path = tool_input["target_file"]  # type: ignore[typeddict-item]

    return file_path if _is_valid_typescript_file(file_path) else None


def find_tsc_executable() -> str | None:
    local_paths = [Path(p) for p in _TYPE_CONFIG.get("executable_paths", [
        "node_modules/.bin/tsc",
        "node_modules/typescript/bin/tsc",
    ])]

    for path in local_paths:
        if path.exists():
            return str(path.absolute())

    system_tsc = shutil.which("tsc")
    if system_tsc:
        return system_tsc

    try:
        result = subprocess.run(
            ["npx", "--no-install", "which", "tsc"],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            return "npx tsc"
    except (FileNotFoundError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        pass

    return None


def execute_tsc_typecheck(tsc_path: str, file_path: str) -> TscResults:
    """Execute TypeScript type checking on the specified file.

    Args:
        tsc_path: Path to tsc executable
        file_path: Path to the TypeScript file to check

    Returns:
        TscResults containing output and exit code
    """
    tsconfig_path = find_tsconfig(file_path)

    if tsconfig_path:
        cmd_args = ["--noEmit", "--pretty", "false", "--project", str(tsconfig_path)]
    else:
        cmd_args = [
            "--noEmit",
            "--pretty",
            "false",
            "--strict",  # Enable strict type checking
            "--esModuleInterop",
            "--skipLibCheck",
            "--forceConsistentCasingInFileNames",
            "--target",
            "ES2020",
            "--module",
            "commonjs",
            str(file_path),
        ]

    tsc_cwd = str(tsconfig_path.parent) if tsconfig_path else "."
    output, exit_code = run_tsc_command(tsc_path, cmd_args, cwd=tsc_cwd)

    # Filter output to only show errors for the specific file
    if tsconfig_path and output:
        filtered_lines = []
        for line in output.split("\n"):
            if file_path in line or (filtered_lines and not line.startswith(" ")):
                filtered_lines.append(line)
        output = "\n".join(filtered_lines)

    has_type_errors = exit_code != 0 and bool(output.strip())

    return TscResults(
        output=output.strip(),
        exit_code=exit_code,
        has_type_errors=has_type_errors,
    )


def find_tsconfig(file_path: str) -> Path | None:
    """Find the nearest tsconfig.json file for the given TypeScript file.

    Args:
        file_path: Path to the TypeScript file

    Returns:
        Path to tsconfig.json if found, None otherwise
    """
    current_dir = Path(file_path).parent.absolute()

    while current_dir != current_dir.parent:
        tsconfig = current_dir / "tsconfig.json"
        if tsconfig.exists():
            return tsconfig
        current_dir = current_dir.parent

    tsconfig = Path("tsconfig.json")
    if tsconfig.exists():
        return tsconfig

    return None


def run_tsc_command(tsc_path: str, args: list[str], *, cwd: str = ".") -> tuple[str, int]:
    try:
        if tsc_path == "npx tsc":
            cmd = ["npx", "--no-install", "tsc"] + args
        else:
            cmd = [tsc_path] + args

        result = subprocess.run(
            cmd,
            check=False,
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=30,
        )
        return result.stdout + result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        return "Error: TypeScript compilation timed out after 30 seconds", 1
    except (FileNotFoundError, subprocess.SubprocessError) as e:
        return f"Error running tsc: {e}", 1


def handle_results_and_exit(results: TscResults) -> None:
    """Handle tsc results and exit with appropriate code."""
    if not results.has_type_errors:
        print("[tsc-hook] Success: No type errors found")
        sys.exit(0)

    message = _build_error_message(results)
    print(message, file=sys.stderr)
    sys.exit(2)  # Exit with code 2 to indicate hook blocked


def _build_error_message(results: TscResults) -> str:
    """Build error message from tsc results."""
    if not results.output:
        return ""

    message_parts = [
        "\n<typescript-errors>",
        results.output,
        "\n",
        "**CRITICAL: TypeScript type errors detected!**",
        "You MUST fix ALL type errors shown above.",
        "These errors will prevent successful compilation.",
        "",
        "Common fixes:",
        "- Add missing type annotations",
        "- Fix type mismatches",
        "- Add missing imports for types",
        "- Check for undefined/null values",
        "- Ensure proper generic type parameters",
        "</typescript-errors>\n",
    ]

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

    return path.exists()


if __name__ == "__main__":
    main()
