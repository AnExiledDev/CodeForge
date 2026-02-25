#!/usr/bin/env python3
"""Skill suggester hook for UserPromptSubmit and SubagentStart events.

Detects which hook event called it via input JSON shape:
- UserPromptSubmit: {"prompt": "..."} -> {"additionalContext": "..."}
- SubagentStart:    {"subagent_type": "Plan", "prompt": "..."} -> {"additionalContext": "..."}

Uses weighted scoring with negative patterns and context guards to suggest
the most relevant skills. Returns at most MAX_SKILLS suggestions, ranked
by confidence score.
"""

import json
import re
import sys

# Maximum number of skills to suggest per prompt.
MAX_SKILLS = 3

# Minimum score for a match to appear in final results.  Set to 0 so that
# even low-weight phrases can survive if they pass context guard checks.
# The context guard + MAX_SKILLS cap handle quality control instead.
MIN_SCORE = 0.0

# Fixed score assigned to whole-word term matches (regex \b...\b).
TERM_WEIGHT = 0.6

# Threshold below which context guards are enforced.  Matches scoring below
# this value must have at least one context guard word present in the prompt,
# otherwise the match is discarded as low-confidence.
CONTEXT_GUARD_THRESHOLD = 0.6

# ---------------------------------------------------------------------------
# Skill definitions
#
# Each skill has:
#   phrases         — list of (substring, weight) tuples.  Weight 0.0-1.0
#                     reflects how confidently the phrase indicates the skill.
#   terms           — list of whole-word regex terms (case-insensitive).
#                     All term matches receive TERM_WEIGHT.
#   negative        — (optional) list of substrings that instantly disqualify
#                     the skill, even if phrases/terms matched.
#   context_guards  — (optional) list of substrings.  When the best match
#                     score is below CONTEXT_GUARD_THRESHOLD, at least one
#                     guard must be present in the prompt or the match is
#                     dropped.
#   priority        — integer tie-breaker.  Higher = preferred when scores
#                     are equal.  10 = explicit commands, 7 = technology,
#                     5 = practice/pattern, 3 = meta/generic.
# ---------------------------------------------------------------------------

SKILLS: dict[str, dict] = {
    # ------------------------------------------------------------------
    # Technology skills (priority 7)
    # ------------------------------------------------------------------
    "fastapi": {
        "phrases": [
            ("build a fastapi app", 1.0),
            ("rest api with fastapi", 1.0),
            ("fastapi", 0.9),
            ("fast api", 0.9),
            ("add sse streaming", 0.5),
            ("dependency injection in fastapi", 1.0),
            ("define pydantic models", 0.4),
            ("stream llm responses", 0.3),
            ("add middleware to fastapi", 1.0),
            ("pydantic model", 0.3),
        ],
        "terms": ["fastapi", "uvicorn", "starlette", "sse-starlette"],
        "negative": ["pydanticai", "pydantic-ai", "pydantic ai"],
        "context_guards": [
            "fastapi", "fast api", "api", "endpoint", "route",
            "uvicorn", "rest", "server", "web",
        ],
        "priority": 7,
    },
    "sqlite": {
        "phrases": [
            ("sqlite", 0.9),
            ("set up a sqlite database", 1.0),
            ("wal mode", 0.9),
            ("fts5", 0.9),
            ("full-text search", 0.3),
            ("better-sqlite3", 1.0),
            ("cloudflare d1", 0.8),
            ("store json in sqlite", 1.0),
            ("write ctes", 0.3),
            ("window functions", 0.3),
        ],
        "terms": ["aiosqlite", "better-sqlite3"],
        "negative": ["elasticsearch", "algolia", "meilisearch", "postgres", "mysql"],
        "context_guards": [
            "sqlite", "sql", "database", "db", "query", "table",
        ],
        "priority": 7,
    },
    "claude-code-headless": {
        "phrases": [
            ("headless mode", 0.8),
            ("claude -p", 0.9),
            ("stream-json", 0.9),
            ("claude code headless", 1.0),
            ("run claude in ci", 1.0),
            ("claude in pipeline", 0.9),
            ("parse stream-json output", 1.0),
            ("track costs programmatically", 0.7),
            ("permissions for scripts", 0.3),
        ],
        "terms": ["--output-format stream-json", "--permission-mode"],
        "context_guards": ["claude", "headless", "ci", "pipeline", "script"],
        "priority": 7,
    },
    "claude-agent-sdk": {
        "phrases": [
            ("agent sdk", 0.9),
            ("claude agent sdk", 1.0),
            ("build an agent with the claude agent sdk", 1.0),
            ("canusetool", 1.0),
            ("sdk permissions", 0.7),
            ("create mcp tools", 0.7),
            ("define subagents", 0.8),
            ("configure sdk hooks", 0.8),
            ("stream sdk messages", 0.8),
        ],
        "terms": ["claude-agent-sdk", "claude_agent_sdk", "createSdkMcpServer"],
        "priority": 7,
    },
    "pydantic-ai": {
        "phrases": [
            ("pydantic ai", 0.9),
            ("pydantic-ai", 1.0),
            ("pydanticai", 1.0),
            ("build a pydanticai agent", 1.0),
            ("add tools to an agent", 0.5),
            ("stream responses with pydanticai", 1.0),
            ("test a pydanticai agent", 1.0),
            ("connect pydanticai to svelte", 1.0),
            ("configure model fallbacks", 0.5),
        ],
        "terms": ["pydanticai", "RunContext", "VercelAIAdapter", "FallbackModel"],
        "context_guards": [
            "pydantic", "agent", "ai", "model", "tool", "llm",
        ],
        "priority": 7,
    },
    "docker-py": {
        "phrases": [
            ("docker-py", 1.0),
            ("docker py", 1.0),
            ("docker sdk", 0.9),
            ("docker engine api", 0.9),
            ("docker from python", 1.0),
            ("docker api", 0.7),
            ("manage docker containers from python", 1.0),
            ("create containers programmatically", 0.8),
            ("stream container logs", 0.7),
            ("monitor container health from python", 1.0),
        ],
        "terms": ["aiodocker", "DockerClient"],
        "priority": 7,
    },
    "svelte5": {
        "phrases": [
            ("svelte component", 0.8),
            ("sveltekit", 0.9),
            ("svelte kit", 0.9),
            ("svelte rune", 1.0),
            ("svelte 5", 1.0),
            ("svelte5", 1.0),
            ("migrate from svelte 4", 1.0),
            ("manage state with $state", 1.0),
            ("drag and drop to svelte", 0.9),
        ],
        "terms": ["sveltekit", "svelte", "svelte-dnd-action", "@ai-sdk/svelte"],
        "priority": 7,
    },
    "docker": {
        "phrases": [
            ("dockerfile", 0.9),
            ("docker compose", 0.9),
            ("docker-compose", 0.9),
            ("compose file", 0.8),
            ("multi-stage build", 0.8),
            ("health check", 0.3),
            ("healthcheck", 0.3),
            ("docker compose watch", 1.0),
            ("optimize docker image", 1.0),
        ],
        "terms": ["dockerfile", "compose.yaml", "BuildKit"],
        "negative": ["docker-py", "docker py", "docker sdk", "docker from python",
                     "aiodocker", "dockerclient"],
        "context_guards": [
            "docker", "container", "compose", "image", "dockerfile",
        ],
        "priority": 7,
    },

    # ------------------------------------------------------------------
    # Practice / pattern skills (priority 5)
    # ------------------------------------------------------------------
    "testing": {
        "phrases": [
            ("write tests", 0.4),
            ("write a test", 0.4),
            ("add tests", 0.4),
            ("add a test", 0.4),
            ("pytest fixture", 0.9),
            ("vitest config", 0.9),
            ("testing library", 0.6),
            ("mock dependencies", 0.7),
            ("test endpoint", 0.5),
            ("test component", 0.5),
            ("test sse streaming", 0.8),
            ("unit test", 0.5),
            ("integration test", 0.6),
        ],
        "terms": ["pytest", "vitest", "pytest-anyio", "httpx AsyncClient"],
        "priority": 5,
    },
    "skill-building": {
        "phrases": [
            ("build a skill", 0.9),
            ("create a skill", 0.9),
            ("write a skill", 0.9),
            ("skill.md", 1.0),
            ("skill instructions", 0.8),
            ("skill authoring", 1.0),
            ("design a skill", 0.8),
            ("improve a skill description", 0.9),
            ("optimize skill content", 0.8),
        ],
        "terms": [],
        "priority": 5,
    },
    "debugging": {
        "phrases": [
            ("debug logs", 0.7),
            ("check logs", 0.4),
            ("check container logs", 0.9),
            ("find error", 0.3),
            ("investigate failure", 0.7),
            ("what went wrong", 0.3),
            ("why did this crash", 0.8),
            ("diagnose the issue", 0.8),
            ("look at the logs", 0.4),
            ("read the logs", 0.4),
            ("read docker logs", 0.9),
            ("analyze error", 0.5),
        ],
        "terms": ["diagnose", "troubleshoot", "OOMKilled", "ECONNREFUSED"],
        "context_guards": [
            "log", "crash", "fail", "bug", "container", "stack",
            "trace", "exception", "runtime", "service", "process",
        ],
        "priority": 5,
    },
    "refactoring-patterns": {
        "phrases": [
            ("refactor this", 0.4),
            ("clean up code", 0.4),
            ("clean up this function", 0.6),
            ("extract a method", 0.8),
            ("fix code smells", 0.9),
            ("reduce code duplication", 0.8),
            ("simplify this class", 0.6),
            ("break up this large function", 0.8),
            ("remove dead code", 0.7),
        ],
        "terms": ["refactor", "refactoring", "code smell", "feature envy", "god class"],
        "priority": 5,
    },
    "security-checklist": {
        "phrases": [
            ("security review", 0.8),
            ("security issues", 0.5),
            ("security vulnerabilities", 0.8),
            ("check for vulnerabilities", 0.7),
            ("scan for secrets", 0.9),
            ("audit security", 0.9),
            ("review for injection", 0.9),
            ("owasp compliance", 1.0),
            ("hardcoded credentials", 0.8),
        ],
        "terms": ["owasp", "injection", "xss", "cve", "trivy", "gitleaks"],
        "priority": 5,
    },
    "git-forensics": {
        "phrases": [
            ("git history", 0.7),
            ("who changed this", 0.7),
            ("when did this break", 0.7),
            ("git blame", 0.9),
            ("bisect a regression", 1.0),
            ("recover a lost commit", 0.9),
            ("search git history", 0.9),
            ("find when code was removed", 0.8),
            ("trace the history", 0.5),
            ("use git reflog", 1.0),
        ],
        "terms": ["bisect", "blame", "pickaxe", "reflog", "git log -S"],
        "context_guards": ["git", "commit", "branch", "history", "repo"],
        "priority": 5,
    },
    "specification-writing": {
        "phrases": [
            ("write a spec", 0.8),
            ("write requirements", 0.7),
            ("define requirements", 0.7),
            ("acceptance criteria", 0.6),
            ("user stories", 0.6),
            ("use ears format", 1.0),
            ("given/when/then", 0.8),
            ("write given/when/then scenarios", 1.0),
            ("structure requirements", 0.7),
        ],
        "terms": ["specification", "ears", "gherkin", "given when then"],
        "priority": 5,
    },
    "performance-profiling": {
        "phrases": [
            ("profile this code", 0.9),
            ("profile performance", 0.9),
            ("find bottleneck", 0.7),
            ("find the bottleneck", 0.7),
            ("benchmark this", 0.8),
            ("create a flamegraph", 1.0),
            ("find memory leaks", 0.8),
            ("why is this slow", 0.4),
            ("measure execution time", 0.7),
            ("reduce latency", 0.4),
        ],
        "terms": ["cProfile", "py-spy", "scalene", "flamegraph", "hyperfine"],
        "context_guards": [
            "profile", "profiler", "benchmark", "performance", "slow",
            "latency", "bottleneck", "memory",
        ],
        "priority": 5,
    },
    "ast-grep-patterns": {
        "phrases": [
            ("ast-grep", 1.0),
            ("ast grep", 1.0),
            ("structural search", 0.8),
            ("syntax-aware search", 0.9),
            ("find code patterns", 0.5),
            ("search with ast-grep", 1.0),
            ("use tree-sitter", 0.8),
        ],
        "terms": ["sg run", "ast-grep", "tree-sitter"],
        "context_guards": ["ast", "syntax", "pattern", "structural", "tree-sitter"],
        "priority": 5,
    },
    "dependency-management": {
        "phrases": [
            ("check dependencies", 0.5),
            ("audit dependencies", 0.8),
            ("outdated packages", 0.8),
            ("dependency health", 0.8),
            ("license check", 0.6),
            ("unused dependencies", 0.8),
            ("vulnerability scan", 0.7),
            ("find unused dependencies", 0.9),
        ],
        "terms": ["pip-audit", "npm audit", "cargo audit", "govulncheck"],
        "context_guards": [
            "dependency", "dependencies", "package", "packages",
            "npm", "pip", "cargo", "audit",
        ],
        "priority": 5,
    },
    "team": {
        "phrases": [
            ("spawn a team", 1.0),
            ("create a team", 0.8),
            ("team of agents", 0.9),
            ("use a swarm", 0.8),
            ("work in parallel", 0.4),
            ("coordinate multiple agents", 0.9),
            ("split this across agents", 0.9),
            ("team up", 0.5),
        ],
        "terms": ["TeamCreate", "SendMessage"],
        # Note: "parallel", "swarm", "coordinate", "team" omitted — overlap phrases
        "context_guards": ["agent", "agents", "teammate", "teammates"],
        "priority": 5,
    },

    # ------------------------------------------------------------------
    # Meta / generic skills (priority 3)
    # ------------------------------------------------------------------
    "api-design": {
        "phrases": [
            ("api design", 0.6),
            ("rest api design", 0.8),
            ("design an api", 0.7),
            ("design rest endpoints", 0.9),
            ("api versioning", 0.8),
            ("pagination strategy", 0.7),
            ("design error responses", 0.8),
            ("rate limiting", 0.6),
            ("openapi documentation", 0.9),
        ],
        "terms": ["openapi", "swagger", "rfc7807", "rfc 7807"],
        "priority": 3,
    },
    "documentation-patterns": {
        "phrases": [
            ("write a readme", 0.6),
            ("write documentation", 0.4),
            ("add docstrings", 0.8),
            ("add jsdoc", 0.9),
            ("document the api", 0.7),
            ("create architecture docs", 0.8),
            ("update the docs", 0.3),
        ],
        "terms": ["docstring", "jsdoc", "tsdoc", "rustdoc", "Sphinx"],
        # Note: "docs" omitted — it overlaps with the phrase "update the docs"
        "context_guards": [
            "documentation", "docstring", "readme", "jsdoc", "api doc",
            "rustdoc", "tsdoc", "sphinx",
        ],
        "priority": 3,
    },
    "migration-patterns": {
        "phrases": [
            ("migrate from", 0.4),
            ("upgrade to", 0.3),
            ("version upgrade", 0.4),
            ("framework migration", 0.8),
            ("bump python", 0.6),
            ("upgrade pydantic", 0.7),
            ("migrate express", 0.8),
            ("modernize the codebase", 0.7),
            ("commonjs to esm", 1.0),
        ],
        "terms": ["migrate", "migration"],
        # Note: "upgrade", "version", "modernize" omitted — overlap with phrases
        "context_guards": [
            "framework", "breaking", "compatibility", "deprecated",
            "legacy", "esm", "commonjs",
        ],
        "priority": 3,
    },

    # ------------------------------------------------------------------
    # Spec-workflow command skills (priority 10)
    # ------------------------------------------------------------------
    "spec-build": {
        "phrases": [
            ("implement the spec", 0.9),
            ("build from spec", 0.9),
            ("building from spec", 0.9),
            ("building from the spec", 0.9),
            ("start building", 0.2),
            ("spec-build", 1.0),
            ("implement this feature", 0.2),
            ("build what the spec describes", 1.0),
            ("run spec-build", 1.0),
        ],
        "terms": ["spec-build"],
        "context_guards": ["spec", "specification", ".specs"],
        "priority": 10,
    },
    "spec-review": {
        "phrases": [
            ("review the spec", 0.8),
            ("check spec adherence", 0.9),
            ("verify implementation", 0.3),
            ("spec-review", 1.0),
            ("does code match spec", 0.9),
            ("audit implementation", 0.4),
            ("run spec-review", 1.0),
            ("regression check", 0.3),
        ],
        "terms": ["spec-review"],
        "context_guards": ["spec", "specification", ".specs"],
        "priority": 10,
    },
    "spec-check": {
        "phrases": [
            ("check spec health", 0.9),
            ("audit specs", 0.9),
            ("which specs are stale", 1.0),
            ("find missing specs", 0.9),
            ("review spec quality", 0.9),
            ("run spec-check", 1.0),
            ("are my specs up to date", 0.9),
        ],
        "terms": ["spec-check"],
        "priority": 10,
    },
    "spec-init": {
        "phrases": [
            ("initialize specs", 0.9),
            ("specs directory", 0.7),
            ("set up specs", 0.8),
            ("bootstrap specs", 0.9),
            ("start using specs", 0.8),
            ("create spec directory", 0.9),
            ("init specs", 0.9),
            ("set up .specs", 1.0),
        ],
        "terms": ["spec-init"],
        "priority": 10,
    },
    "spec-new": {
        "phrases": [
            ("create a spec", 0.8),
            ("new spec", 0.8),
            ("new feature spec", 0.9),
            ("write a spec for", 0.9),
            ("spec this feature", 0.9),
            ("start a new spec", 0.9),
            ("plan a feature", 0.2),
            ("add a spec", 0.8),
        ],
        "terms": ["spec-new"],
        "context_guards": ["spec", "specification", ".specs"],
        "priority": 10,
    },
    "spec-refine": {
        "phrases": [
            ("refine the spec", 0.9),
            ("review spec assumptions", 0.9),
            ("validate spec decisions", 0.9),
            ("approve the spec", 0.8),
            ("walk me through the spec", 0.8),
            ("check spec for assumptions", 0.9),
            ("iterate on the spec", 0.8),
        ],
        "terms": ["spec-refine"],
        "priority": 10,
    },
    "spec-update": {
        "phrases": [
            ("update the spec", 0.8),
            ("mark spec as implemented", 0.9),
            ("as-built update", 0.9),
            ("finish the spec", 0.7),
            ("close the spec", 0.7),
            ("update spec status", 0.8),
            ("sync spec with code", 0.8),
        ],
        "terms": ["spec-update"],
        "priority": 10,
    },
    "worktree": {
        "phrases": [
            "create a worktree",
            "work in a worktree",
            "git worktree",
            "worktree",
            "parallel branches",
            "isolate my work",
            "clean up worktrees",
            "list worktrees",
            "set up a worktree",
            "enter worktree",
        ],
        "terms": ["worktree", "EnterWorktree", "WorktreeCreate"],
    },
}

# ---------------------------------------------------------------------------
# Pre-compile term patterns for whole-word matching
# ---------------------------------------------------------------------------

_TERM_PATTERNS: dict[str, re.Pattern[str]] = {}
for _skill, _cfg in SKILLS.items():
    for _term in _cfg["terms"]:
        if _term not in _TERM_PATTERNS:
            _TERM_PATTERNS[_term] = re.compile(
                r"\b" + re.escape(_term) + r"\b", re.IGNORECASE
            )


# ---------------------------------------------------------------------------
# Scoring engine
# ---------------------------------------------------------------------------


def _score_skill(cfg: dict, prompt: str, lowered: str) -> float:
    """Return a confidence score for how well *prompt* matches *cfg*.

    Returns 0.0 when the skill should not be suggested.
    """

    # 1. Negative patterns — instant disqualification
    for neg in cfg.get("negative", []):
        if neg in lowered:
            return 0.0

    # 2. Phrase scoring — take the highest matching weight
    best_phrase: float = 0.0
    for phrase, weight in cfg["phrases"]:
        if phrase in lowered:
            if weight > best_phrase:
                best_phrase = weight

    # 3. Term scoring — fixed weight for any whole-word match
    term_score: float = 0.0
    for term in cfg["terms"]:
        if _TERM_PATTERNS[term].search(prompt):
            term_score = TERM_WEIGHT
            break

    base = max(best_phrase, term_score)
    if base < MIN_SCORE:
        return 0.0

    # 4. Context guard — low-confidence matches need confirmation
    if base < CONTEXT_GUARD_THRESHOLD:
        guards = cfg.get("context_guards")
        if guards and not any(g in lowered for g in guards):
            return 0.0

    return base


def match_skills(prompt: str) -> list[str]:
    """Return up to MAX_SKILLS skill names, ranked by confidence score."""
    lowered = prompt.lower()
    scored: list[tuple[str, float, int]] = []

    for skill, cfg in SKILLS.items():
        score = _score_skill(cfg, prompt, lowered)
        if score > 0.0:
            scored.append((skill, score, cfg.get("priority", 0)))

    # Sort by score descending, then priority descending for ties
    scored.sort(key=lambda x: (x[1], x[2]), reverse=True)

    return [name for name, _, _ in scored[:MAX_SKILLS]]


# ---------------------------------------------------------------------------
# Hook entry point
# ---------------------------------------------------------------------------


def main() -> None:
    """Read a hook event from stdin, score skills, and print suggestions to stdout."""
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
