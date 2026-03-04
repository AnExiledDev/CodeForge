#!/usr/bin/env python3
"""
Data file syntax validator.

Validates JSON, JSONC, YAML, and TOML files after editing.
Uses Python stdlib only (plus PyYAML if available).

Reads tool input from stdin, validates syntax, reports errors.
Non-blocking: always exits 0.
"""

import json
import os
import re
import sys
from pathlib import Path

EXTENSIONS = {".json", ".jsonc", ".yaml", ".yml", ".toml"}


def strip_jsonc_comments(text: str) -> str:
    """Remove // and /* */ comments from JSONC text.

    Handles URLs (https://...) by only stripping // comments that are
    preceded by whitespace or appear at line start, not those inside strings.
    """
    # Remove multi-line comments first
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    # Remove single-line comments: // preceded by start-of-line or whitespace
    # This avoids stripping :// in URLs
    text = re.sub(r"(^|[\s,\[\{])//.*$", r"\1", text, flags=re.MULTILINE)
    return text


def validate_json(file_path: str, is_jsonc: bool) -> str:
    """Validate JSON/JSONC syntax.

    Returns:
        Error message string, or empty string if valid.
    """
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    if is_jsonc:
        content = strip_jsonc_comments(content)

    try:
        json.loads(content)
        return ""
    except json.JSONDecodeError as e:
        return f"[Syntax] JSON error at line {e.lineno}, col {e.colno}: {e.msg}"


def validate_yaml(file_path: str) -> str:
    """Validate YAML syntax.

    Returns:
        Error message string, or empty string if valid.
    """
    try:
        import yaml
    except ImportError:
        return ""  # PyYAML not available, skip

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            yaml.safe_load(f)
        return ""
    except yaml.YAMLError as e:
        if hasattr(e, "problem_mark"):
            mark = e.problem_mark
            return f"[Syntax] YAML error at line {mark.line + 1}, col {mark.column + 1}: {e.problem}"
        return f"[Syntax] YAML error: {e}"


def validate_toml(file_path: str) -> str:
    """Validate TOML syntax.

    Returns:
        Error message string, or empty string if valid.
    """
    try:
        import tomllib
    except ImportError:
        return ""  # Python < 3.11, skip

    try:
        with open(file_path, "rb") as f:
            tomllib.load(f)
        return ""
    except tomllib.TOMLDecodeError as e:
        return f"[Syntax] TOML error: {e}"


def validate(file_path: str) -> str:
    """Validate file syntax based on extension.

    Returns:
        Error message string, or empty string if valid.
    """
    ext = Path(file_path).suffix.lower()

    if ext == ".jsonc":
        return validate_json(file_path, is_jsonc=True)
    elif ext == ".json":
        return validate_json(file_path, is_jsonc=False)
    elif ext in {".yaml", ".yml"}:
        return validate_yaml(file_path)
    elif ext == ".toml":
        return validate_toml(file_path)

    return ""


def main():
    try:
        input_data = json.load(sys.stdin)
        tool_input = input_data.get("tool_input", {})
        file_path = tool_input.get("file_path", "")

        if not file_path:
            sys.exit(0)

        ext = Path(file_path).suffix.lower()
        if ext not in EXTENSIONS:
            sys.exit(0)

        if not os.path.isfile(file_path):
            sys.exit(0)

        message = validate(file_path)

        if message:
            print(json.dumps({"additionalContext": message}))

        sys.exit(0)

    except json.JSONDecodeError:
        sys.exit(0)
    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
