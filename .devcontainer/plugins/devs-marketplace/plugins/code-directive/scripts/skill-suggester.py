#!/usr/bin/env python3
"""Skill suggester hook for UserPromptSubmit and SubagentStart events.

Detects which hook event called it via input JSON shape:
- UserPromptSubmit: {"prompt": "..."} -> {"systemMessage": "..."}
- SubagentStart:    {"subagent_type": "Plan", "prompt": "..."} -> {"additionalContext": "..."}

Matches user prompts against skill keyword maps (phrases + terms) and suggests
relevant skills. Outputs nothing when no skills match.
"""

import json
import re
import sys

SKILLS = {
    "fastapi": {
        "phrases": [
            "rest api",
            "fastapi",
            "fast api",
            "pydantic model",
            "sse streaming",
            "server-sent event",
            "dependency injection",
            "asgi middleware",
            "api endpoint",
            "api route",
        ],
        "terms": ["fastapi", "pydantic", "uvicorn", "starlette"],
    },
    "sqlite": {
        "phrases": [
            "sqlite",
            "wal mode",
            "fts5",
            "full-text search",
            "better-sqlite3",
            "cloudflare d1",
            "json1 extension",
        ],
        "terms": ["aiosqlite"],
    },
    "claude-code-headless": {
        "phrases": [
            "headless mode",
            "claude -p",
            "stream-json",
            "claude code headless",
            "run claude in ci",
            "claude in pipeline",
        ],
        "terms": [],
    },
    "claude-agent-sdk": {
        "phrases": [
            "agent sdk",
            "claude agent sdk",
            "build an agent",
            "create an agent",
            "canusetool",
            "sdk permissions",
        ],
        "terms": ["claude-agent-sdk", "claude_agent_sdk"],
    },
    "pydantic-ai": {
        "phrases": [
            "pydantic ai",
            "pydantic-ai",
            "pydanticai",
            "ai agent",
            "runcontext",
            "vercel ai adapter",
            "model fallback",
        ],
        "terms": ["pydanticai"],
    },
    "testing": {
        "phrases": [
            "write tests",
            "write a test",
            "add tests",
            "add a test",
            "pytest fixture",
            "vitest config",
            "testing library",
            "mock dependencies",
            "test endpoint",
            "test component",
            "unit test",
            "integration test",
            "run tests",
            "run the tests",
        ],
        "terms": ["pytest", "vitest"],
    },
    "docker-py": {
        "phrases": [
            "docker-py",
            "docker py",
            "docker sdk",
            "docker engine api",
            "docker from python",
            "docker api",
        ],
        "terms": ["aiodocker"],
    },
    "svelte5": {
        "phrases": [
            "svelte component",
            "sveltekit",
            "svelte kit",
            "svelte rune",
            "svelte 5",
            "svelte5",
            "layercake",
            "layer cake",
            "svelte-dnd-action",
            "svelte dnd",
        ],
        "terms": ["sveltekit", "svelte"],
    },
    "docker": {
        "phrases": [
            "dockerfile",
            "docker compose",
            "docker-compose",
            "compose file",
            "multi-stage build",
            "health check",
            "healthcheck",
            "docker network",
            "docker volume",
            "docker image",
        ],
        "terms": ["dockerfile", "compose"],
    },
    "skill-building": {
        "phrases": [
            "build a skill",
            "create a skill",
            "write a skill",
            "skill.md",
            "skill instructions",
            "skill authoring",
            "design a skill",
        ],
        "terms": [],
    },
    "debugging": {
        "phrases": [
            "debug logs",
            "check logs",
            "find error",
            "investigate failure",
            "container logs",
            "what went wrong",
            "why did this crash",
            "diagnose the issue",
            "look at the logs",
            "read the logs",
            "analyze error",
        ],
        "terms": ["diagnose", "troubleshoot"],
    },
    "refactoring-patterns": {
        "phrases": [
            "refactor this",
            "clean up code",
            "improve code structure",
            "reduce complexity",
        ],
        "terms": [
            "refactor",
            "refactoring",
            "code smell",
            "extract function",
            "dead code",
        ],
    },
    "security-checklist": {
        "phrases": [
            "security review",
            "check for vulnerabilities",
            "audit security",
            "find security issues",
        ],
        "terms": [
            "security",
            "vulnerability",
            "owasp",
            "injection",
            "xss",
            "secrets",
            "cve",
        ],
    },
    "git-forensics": {
        "phrases": [
            "git history",
            "who changed this",
            "when did this break",
            "git blame",
        ],
        "terms": ["bisect", "blame", "archaeology", "git log", "pickaxe", "reflog"],
    },
    "specification-writing": {
        "phrases": [
            "write a spec",
            "define requirements",
            "acceptance criteria",
            "user stories",
        ],
        "terms": [
            "specification",
            "requirements",
            "ears",
            "gherkin",
            "given when then",
        ],
    },
    "performance-profiling": {
        "phrases": [
            "profile performance",
            "find bottleneck",
            "benchmark this",
            "why is this slow",
        ],
        "terms": [
            "profiling",
            "benchmark",
            "flamegraph",
            "bottleneck",
            "latency",
            "throughput",
        ],
    },
    "api-design": {
        "phrases": [
            "api design",
            "rest api design",
            "design an api",
            "design a rest",
            "api convention",
            "endpoint design",
            "api versioning",
            "pagination pattern",
            "error response format",
        ],
        "terms": ["openapi", "swagger", "rfc7807"],
    },
    "ast-grep-patterns": {
        "phrases": [
            "ast-grep",
            "ast grep",
            "structural search",
            "structural code search",
            "syntax-aware search",
            "tree-sitter",
        ],
        "terms": ["sg run", "ast-grep", "tree-sitter"],
    },
    "dependency-management": {
        "phrases": [
            "check dependencies",
            "audit dependencies",
            "outdated packages",
            "dependency health",
            "license check",
            "unused dependencies",
            "vulnerability scan",
        ],
        "terms": ["pip-audit", "npm audit", "cargo audit", "govulncheck"],
    },
    "documentation-patterns": {
        "phrases": [
            "write a readme",
            "write documentation",
            "add docstrings",
            "add jsdoc",
            "document the api",
            "documentation template",
            "update the docs",
        ],
        "terms": ["docstring", "jsdoc", "tsdoc", "godoc", "rustdoc"],
    },
    "migration-patterns": {
        "phrases": [
            "migrate from",
            "upgrade to",
            "version upgrade",
            "framework migration",
            "bump python",
            "upgrade pydantic",
            "migrate express",
        ],
        "terms": ["migrate", "migration", "upgrade"],
    },
}

# Pre-compile term patterns for whole-word matching
_TERM_PATTERNS: dict[str, re.Pattern[str]] = {}
for _skill, _cfg in SKILLS.items():
    for _term in _cfg["terms"]:
        if _term not in _TERM_PATTERNS:
            _TERM_PATTERNS[_term] = re.compile(
                r"\b" + re.escape(_term) + r"\b", re.IGNORECASE
            )


def match_skills(prompt: str) -> list[str]:
    """Return sorted list of skill names matching the prompt."""
    lowered = prompt.lower()
    matched: list[str] = []

    for skill, cfg in SKILLS.items():
        # Check phrases (substring match on lowercased prompt)
        if any(phrase in lowered for phrase in cfg["phrases"]):
            matched.append(skill)
            continue

        # Check terms (whole-word regex match)
        if any(_TERM_PATTERNS[term].search(prompt) for term in cfg["terms"]):
            matched.append(skill)

    matched.sort()
    return matched


def main() -> None:
    raw = sys.stdin.read().strip()
    if not raw:
        return

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return

    prompt = data.get("prompt", "")
    if not prompt:
        return

    skills = match_skills(prompt)
    if not skills:
        return

    skill_list = ", ".join(f'"{s}"' for s in skills)
    is_subagent = "subagent_type" in data

    if is_subagent:
        output = {
            "additionalContext": (
                f"Available skills matching this planning task: {skill_list}. "
                "These skills contain project-specific patterns, conventions, "
                "and reference material. Consider their guidance when designing "
                "the implementation approach."
            )
        }
    else:
        output = {
            "systemMessage": (
                f"<system-reminder>The user's prompt matches available skill(s): "
                f"{skill_list}. Load the relevant skill(s) using the Skill tool "
                f"before responding.</system-reminder>"
            )
        }

    json.dump(output, sys.stdout)


if __name__ == "__main__":
    main()
