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
import os

# Hook gate — check ~/.claude/disabled-hooks.json
_dh = os.path.join(os.path.expanduser("~"), ".claude", "disabled-hooks.json")
if os.path.exists(_dh):
    with open(_dh) as _f:
        if os.path.basename(__file__).replace(".py", "") in json.load(_f).get(
            "disabled", []
        ):
            sys.exit(0)

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
    "agent-browser": {
        "phrases": [
            ("agent-browser", 1.0),
            ("agent browser", 1.0),
            ("headless browser", 0.8),
            ("browser automation", 0.9),
            ("open a webpage", 0.7),
            ("navigate a site", 0.7),
            ("take a screenshot of a page", 0.8),
            ("fill a form on a website", 0.8),
            ("accessibility tree", 0.8),
            ("scrape a page", 0.5),
            ("interact with a website", 0.5),
            ("automate browser", 0.9),
        ],
        "terms": ["agent-browser", "agent_browser"],
        "negative": ["playwright test", "cypress", "puppeteer"],
        "context_guards": [
            "browser",
            "webpage",
            "website",
            "page",
            "url",
            "screenshot",
            "headless",
            "navigate",
            "form",
        ],
        "priority": 7,
    },
    # ------------------------------------------------------------------
    # Practice / pattern skills (priority 5)
    # ------------------------------------------------------------------
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
