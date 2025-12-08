#!/usr/bin/env python3
"""
Language rules loader for Claude Code hooks.

This module provides utilities to load language-specific rules from JSON files
and use them in hooks for consistent behavior across all language-specific checks.

Usage:
    from load_rules import get_rules, get_rules_for_file

    # Load rules by language name
    python_rules = get_rules("python")

    # Load rules based on file extension
    rules = get_rules_for_file("/path/to/file.py")

    # Access specific rule sections
    if rules:
        forbidden_types = rules.get("type_checking", {}).get("forbidden_types", [])
        lint_rules = rules.get("linting", {}).get("always_enforce_rules", [])
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

RULES_DIR = Path(__file__).parent
EXTENSION_TO_LANGUAGE: dict[str, str] = {}
_rules_cache: dict[str, dict[str, Any]] = {}


def _build_extension_map() -> None:
    """Build mapping from file extensions to language names."""
    global EXTENSION_TO_LANGUAGE

    if EXTENSION_TO_LANGUAGE:
        return

    for rule_file in RULES_DIR.glob("*.json"):
        if rule_file.name == "schema.json":
            continue

        try:
            with open(rule_file, encoding="utf-8") as f:
                rules = json.load(f)

            language = rules.get("language", rule_file.stem)
            extensions = rules.get("extensions", [])

            for ext in extensions:
                EXTENSION_TO_LANGUAGE[ext] = language
        except (json.JSONDecodeError, OSError):
            continue


@lru_cache(maxsize=32)
def get_rules(language: str) -> dict[str, Any] | None:
    """Load rules for a specific language.

    Args:
        language: Language name (e.g., 'python', 'typescript')

    Returns:
        Dictionary containing language rules, or None if not found
    """
    if language in _rules_cache:
        return _rules_cache[language]

    rule_file = RULES_DIR / f"{language}.json"

    if not rule_file.exists():
        return None

    try:
        with open(rule_file, encoding="utf-8") as f:
            rules = json.load(f)
        _rules_cache[language] = rules
        return rules
    except (json.JSONDecodeError, OSError):
        return None


def get_rules_for_file(file_path: str) -> dict[str, Any] | None:
    """Load rules based on file extension.

    Args:
        file_path: Path to the file

    Returns:
        Dictionary containing language rules, or None if not found
    """
    _build_extension_map()

    path = Path(file_path)
    ext = path.suffix.lower()

    if ext not in EXTENSION_TO_LANGUAGE:
        return None

    language = EXTENSION_TO_LANGUAGE[ext]
    return get_rules(language)


def is_excluded_path(file_path: str, rules: dict[str, Any]) -> bool:
    """Check if file path should be excluded based on rules.

    Args:
        file_path: Path to check
        rules: Language rules dictionary

    Returns:
        True if path should be excluded
    """
    excluded_paths = rules.get("excluded_paths", [])

    for pattern in excluded_paths:
        if pattern in file_path:
            return True

    return False


def is_excluded_extension(file_path: str, rules: dict[str, Any]) -> bool:
    """Check if file extension should be excluded based on rules.

    Args:
        file_path: Path to check
        rules: Language rules dictionary

    Returns:
        True if extension should be excluded
    """
    excluded_extensions = rules.get("excluded_extensions", [])
    path = Path(file_path)

    for ext in excluded_extensions:
        if file_path.endswith(ext):
            return True

    return path.suffix.lower() in excluded_extensions


def get_message(rules: dict[str, Any], message_key: str, default: str = "") -> str:
    """Get a message from rules.

    Args:
        rules: Language rules dictionary
        message_key: Key for the message
        default: Default value if not found

    Returns:
        Message string
    """
    messages = rules.get("messages", {})
    return messages.get(message_key, default)


def get_linting_config(rules: dict[str, Any]) -> dict[str, Any]:
    """Get linting configuration from rules.

    Args:
        rules: Language rules dictionary

    Returns:
        Linting configuration dictionary
    """
    return rules.get("linting", {})


def get_type_checking_config(rules: dict[str, Any]) -> dict[str, Any]:
    """Get type checking configuration from rules.

    Args:
        rules: Language rules dictionary

    Returns:
        Type checking configuration dictionary
    """
    return rules.get("type_checking", {})


def get_imports_config(rules: dict[str, Any]) -> dict[str, Any]:
    """Get imports configuration from rules.

    Args:
        rules: Language rules dictionary

    Returns:
        Imports configuration dictionary
    """
    return rules.get("imports", {})


def get_comments_config(rules: dict[str, Any]) -> dict[str, Any]:
    """Get comments configuration from rules.

    Args:
        rules: Language rules dictionary

    Returns:
        Comments configuration dictionary
    """
    return rules.get("comments", {})


def get_forbidden_types(rules: dict[str, Any]) -> list[str]:
    """Get list of forbidden types from rules.

    Args:
        rules: Language rules dictionary

    Returns:
        List of forbidden type names
    """
    type_config = get_type_checking_config(rules)
    return type_config.get("forbidden_types", [])


def get_forbidden_patterns(rules: dict[str, Any]) -> list[dict[str, str]]:
    """Get list of forbidden patterns from rules.

    Args:
        rules: Language rules dictionary

    Returns:
        List of forbidden pattern dictionaries
    """
    type_config = get_type_checking_config(rules)
    return type_config.get("forbidden_patterns", [])


def clear_cache() -> None:
    """Clear all cached rules."""
    global _rules_cache, EXTENSION_TO_LANGUAGE
    _rules_cache.clear()
    EXTENSION_TO_LANGUAGE.clear()
    get_rules.cache_clear()


if __name__ == "__main__":
    import sys

    print("Available language rules:")
    for rule_file in RULES_DIR.glob("*.json"):
        if rule_file.name != "schema.json":
            rules = get_rules(rule_file.stem)
            if rules:
                print(f"  - {rules.get('language', rule_file.stem)}: {rules.get('extensions', [])}")

    if len(sys.argv) > 1:
        test_file = sys.argv[1]
        rules = get_rules_for_file(test_file)
        if rules:
            print(f"\nRules for {test_file}:")
            print(f"  Language: {rules.get('language')}")
            print(f"  Linting tool: {rules.get('linting', {}).get('tool')}")
            print(f"  Forbidden types: {get_forbidden_types(rules)}")
        else:
            print(f"\nNo rules found for {test_file}")
