#!/usr/bin/env python3
"""Skill suggester hook for UserPromptSubmit and SubagentStart events.

Detects which hook event called it via input JSON shape:
- UserPromptSubmit: {"prompt": "..."} -> {"additionalContext": "..."}
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
            "build a fastapi app",
            "rest api with fastapi",
            "fastapi",
            "fast api",
            "add sse streaming",
            "dependency injection in fastapi",
            "define pydantic models",
            "stream llm responses",
            "add middleware to fastapi",
            "pydantic model",
        ],
        "terms": ["fastapi", "pydantic", "uvicorn", "starlette", "sse-starlette"],
    },
    "sqlite": {
        "phrases": [
            "sqlite",
            "set up a sqlite database",
            "wal mode",
            "fts5",
            "full-text search",
            "better-sqlite3",
            "cloudflare d1",
            "store json in sqlite",
            "write ctes",
            "window functions",
        ],
        "terms": ["aiosqlite", "better-sqlite3"],
    },
    "claude-code-headless": {
        "phrases": [
            "headless mode",
            "claude -p",
            "stream-json",
            "claude code headless",
            "run claude in ci",
            "claude in pipeline",
            "parse stream-json output",
            "track costs programmatically",
            "permissions for scripts",
        ],
        "terms": ["--output-format stream-json", "--permission-mode"],
    },
    "claude-agent-sdk": {
        "phrases": [
            "agent sdk",
            "claude agent sdk",
            "build an agent with the claude agent sdk",
            "canusetool",
            "sdk permissions",
            "create mcp tools",
            "define subagents",
            "configure sdk hooks",
            "stream sdk messages",
        ],
        "terms": ["claude-agent-sdk", "claude_agent_sdk", "createSdkMcpServer"],
    },
    "pydantic-ai": {
        "phrases": [
            "pydantic ai",
            "pydantic-ai",
            "pydanticai",
            "build a pydanticai agent",
            "add tools to an agent",
            "stream responses with pydanticai",
            "test a pydanticai agent",
            "connect pydanticai to svelte",
            "configure model fallbacks",
        ],
        "terms": ["pydanticai", "RunContext", "VercelAIAdapter", "FallbackModel"],
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
            "test sse streaming",
            "unit test",
            "integration test",
        ],
        "terms": ["pytest", "vitest", "pytest-anyio", "httpx AsyncClient"],
    },
    "docker-py": {
        "phrases": [
            "docker-py",
            "docker py",
            "docker sdk",
            "docker engine api",
            "docker from python",
            "docker api",
            "manage docker containers from python",
            "create containers programmatically",
            "stream container logs",
            "monitor container health from python",
        ],
        "terms": ["aiodocker", "DockerClient"],
    },
    "svelte5": {
        "phrases": [
            "svelte component",
            "sveltekit",
            "svelte kit",
            "svelte rune",
            "svelte 5",
            "svelte5",
            "migrate from svelte 4",
            "manage state with $state",
            "drag and drop to svelte",
        ],
        "terms": ["sveltekit", "svelte", "svelte-dnd-action", "@ai-sdk/svelte"],
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
            "docker compose watch",
            "optimize docker image",
        ],
        "terms": ["dockerfile", "compose.yaml", "BuildKit"],
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
            "improve a skill description",
            "optimize skill content",
        ],
        "terms": [],
    },
    "debugging": {
        "phrases": [
            "debug logs",
            "check logs",
            "check container logs",
            "find error",
            "investigate failure",
            "what went wrong",
            "why did this crash",
            "diagnose the issue",
            "look at the logs",
            "read the logs",
            "read docker logs",
            "analyze error",
        ],
        "terms": ["diagnose", "troubleshoot", "OOMKilled", "ECONNREFUSED"],
    },
    "refactoring-patterns": {
        "phrases": [
            "refactor this",
            "clean up code",
            "clean up this function",
            "extract a method",
            "fix code smells",
            "reduce code duplication",
            "simplify this class",
            "break up this large function",
            "remove dead code",
        ],
        "terms": ["refactor", "refactoring", "code smell", "feature envy", "god class"],
    },
    "security-checklist": {
        "phrases": [
            "security review",
            "security issues",
            "security vulnerabilities",
            "check for vulnerabilities",
            "scan for secrets",
            "audit security",
            "review for injection",
            "owasp compliance",
            "hardcoded credentials",
        ],
        "terms": ["owasp", "injection", "xss", "cve", "trivy", "gitleaks"],
    },
    "git-forensics": {
        "phrases": [
            "git history",
            "who changed this",
            "when did this break",
            "git blame",
            "bisect a regression",
            "recover a lost commit",
            "search git history",
            "find when code was removed",
            "trace the history",
            "use git reflog",
        ],
        "terms": ["bisect", "blame", "pickaxe", "reflog", "git log -S"],
    },
    "specification-writing": {
        "phrases": [
            "write a spec",
            "write requirements",
            "define requirements",
            "acceptance criteria",
            "user stories",
            "use ears format",
            "given/when/then",
            "write given/when/then scenarios",
            "structure requirements",
        ],
        "terms": ["specification", "ears", "gherkin", "given when then"],
    },
    "performance-profiling": {
        "phrases": [
            "profile this code",
            "profile performance",
            "find bottleneck",
            "find the bottleneck",
            "benchmark this",
            "create a flamegraph",
            "find memory leaks",
            "why is this slow",
            "measure execution time",
            "reduce latency",
        ],
        "terms": ["cProfile", "py-spy", "scalene", "flamegraph", "hyperfine"],
    },
    "api-design": {
        "phrases": [
            "api design",
            "rest api design",
            "design an api",
            "design rest endpoints",
            "api versioning",
            "pagination strategy",
            "design error responses",
            "rate limiting",
            "openapi documentation",
        ],
        "terms": ["openapi", "swagger", "rfc7807", "rfc 7807"],
    },
    "ast-grep-patterns": {
        "phrases": [
            "ast-grep",
            "ast grep",
            "structural search",
            "syntax-aware search",
            "find code patterns",
            "search with ast-grep",
            "use tree-sitter",
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
            "find unused dependencies",
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
            "create architecture docs",
            "update the docs",
        ],
        "terms": ["docstring", "jsdoc", "tsdoc", "rustdoc", "Sphinx"],
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
            "modernize the codebase",
            "commonjs to esm",
        ],
        "terms": ["migrate", "migration"],
    },
    "spec-build": {
        "phrases": [
            "implement the spec",
            "build from spec",
            "start building",
            "spec-build",
            "implement this feature",
            "build what the spec describes",
            "run spec-build",
        ],
        "terms": ["spec-build"],
    },
    "spec-review": {
        "phrases": [
            "review the spec",
            "check spec adherence",
            "verify implementation",
            "spec-review",
            "does code match spec",
            "audit implementation",
            "run spec-review",
            "regression check",
        ],
        "terms": ["spec-review"],
    },
    "spec-check": {
        "phrases": [
            "check spec health",
            "audit specs",
            "which specs are stale",
            "find missing specs",
            "review spec quality",
            "run spec-check",
            "are my specs up to date",
        ],
        "terms": ["spec-check"],
    },
    "spec-init": {
        "phrases": [
            "initialize specs",
            "specs directory",
            "set up specs",
            "bootstrap specs",
            "start using specs",
            "create spec directory",
            "init specs",
            "set up .specs",
        ],
        "terms": ["spec-init"],
    },
    "spec-new": {
        "phrases": [
            "create a spec",
            "new spec",
            "new feature spec",
            "write a spec for",
            "spec this feature",
            "start a new spec",
            "plan a feature",
            "add a spec",
        ],
        "terms": ["spec-new"],
    },
    "spec-refine": {
        "phrases": [
            "refine the spec",
            "review spec assumptions",
            "validate spec decisions",
            "approve the spec",
            "walk me through the spec",
            "check spec for assumptions",
            "iterate on the spec",
        ],
        "terms": ["spec-refine"],
    },
    "spec-update": {
        "phrases": [
            "update the spec",
            "mark spec as implemented",
            "as-built update",
            "finish the spec",
            "close the spec",
            "update spec status",
            "sync spec with code",
        ],
        "terms": ["spec-update"],
    },
    "team": {
        "phrases": [
            "spawn a team",
            "create a team",
            "team of agents",
            "use a swarm",
            "work in parallel",
            "coordinate multiple agents",
            "split this across agents",
            "team up",
        ],
        "terms": ["TeamCreate", "SendMessage"],
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

    output = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": (
                f"MANDATORY — Skill activation required. The user's prompt matches: {skill_list}. "
                f"Before responding, evaluate each matched skill: is it relevant to this specific request? "
                f"For each relevant skill, activate it using the Skill tool NOW. "
                f"Skip any that are not relevant to the user's actual intent. "
                f"Do not proceed with implementation until relevant skills are loaded."
            ),
        }
    }

    json.dump(output, sys.stdout)


if __name__ == "__main__":
    main()
