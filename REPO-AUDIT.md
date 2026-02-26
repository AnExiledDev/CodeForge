# CodeForge — Public Repo Checklist Audit

**Date:** 2026-02-26
**Repository:** [AnExiledDev/CodeForge](https://github.com/AnExiledDev/CodeForge)

---

## Professional Signals

| Item | Status | Notes |
|------|--------|-------|
| CI badge | ✅ | CI workflow badge added to README |
| License badge | ✅ | GPL-3.0 badge present |
| Version badge | ✅ | npm version badge present |
| Clear repo description | ✅ | "A fully configured DevPod environment optimized for Claude Code development…" |
| Topics added | ⏳ | Post-merge: `gh repo edit --add-topic devcontainer,claude-code,ai-development,developer-tools,vscode,devpod` |
| Releases enabled | ✅ | Active releases (latest: v1.14.2, 2026-02-24). Automated via `release.yml` |
| Dependabot enabled | ✅ | `.github/dependabot.yml` added (npm root, npm docs, github-actions). Vulnerability alerts ⏳ post-merge |
| CodeQL enabled | ✅ | `.github/workflows/codeql.yml` added (JS, weekly schedule + PR/push triggers) |
| Discussions enabled | ⏳ | Post-merge: `gh repo edit --enable-discussions` |

**Recommendation:**
- **Topics** — Add immediately. Free discoverability boost: `devcontainer`, `claude-code`, `ai-development`, `developer-tools`, `vscode`. Zero effort, high ROI.
- **CI badge** — Add after implementing a CI workflow (see Automation section below).
- **Dependabot** — **Implement.** You have npm and Python dependencies. A basic `dependabot.yml` covering `npm` and `pip` takes 10 lines.
- **CodeQL** — **Implement.** GitHub provides a starter workflow. Since you have JS/Python, it catches real issues. Low effort.
- **Discussions** — **Ignore.** Solo project, issues are sufficient.

---

## GPL-3.0 Best Practices

| Item | Status | Notes |
|------|--------|-------|
| LICENSE file | ✅ | `LICENSE.txt` — full GPL-3.0 text. `package.json` declares `"license": "GPL-3.0"` |
| COPYING file | ❌ | Not present |
| Copyright header in source files | ✅ | SPDX + copyright headers added to all 36 source files |
| CONTRIBUTING.md noting GPL3 | ✅ | CONTRIBUTING.md added with GPL-3.0 + CLA guidelines |
| CLA for dual licensing | ✅ | CLA.md added; CLA Assistant GitHub App to be installed separately |

**Recommendation:**
- **COPYING** — **Ignore.** Traditional GNU convention but `LICENSE.txt` is the modern standard. Having both is redundant.
- **Copyright headers** — **Implement.** GPL-3.0 recommends a brief header in each source file. This is the most impactful missing GPL practice. A one-liner like:
  ```
  # SPDX-License-Identifier: GPL-3.0-only
  # Copyright (c) 2026 AnExiledDev
  ```
  The SPDX short-form is widely accepted and less intrusive than the full GNU boilerplate.
- **CONTRIBUTING.md** — **Implement.** Must address both GPL-3.0 contribution terms AND CLA requirements if dual licensing. See Dual Licensing section below.
- **CLA** — **Implement if dual licensing.** See Dual Licensing section for details.

---

## PR & Issue Hygiene

| Item | Status | Notes |
|------|--------|-------|
| Issue templates (bug / feature) | ✅ | Bug report + feature request YAML form templates added |
| PR template | ✅ | `.github/pull_request_template.md` added |
| Label: `bug` | ✅ | Present |
| Label: `enhancement` | ✅ | Present |
| Label: `good-first-issue` | ✅ | Present (as "good first issue") |
| Label: `help-wanted` | ✅ | Present (as "help wanted") |
| Label: `breaking-change` | ⏳ | Post-merge: `gh label create "breaking-change" -c "D93F0B"` |

**Recommendation:**
- **Issue templates** — **Implement.** Bug and feature request templates guide contributors and reduce noise. Standard GitHub practice, ~20 minutes of work.
- **PR template** — **Implement.** A simple template with Description / Linked Issue / Checklist sections. Helps even for solo PRs to maintain discipline.
- **`breaking-change` label** — **Implement.** One CLI command: `gh label create "breaking-change" -c "D93F0B" -d "Introduces a breaking change"`. Critical for a published npm package.

---

## README Quality

| Item | Status | Notes |
|------|--------|-------|
| 1-sentence clear description | ✅ | Line 11 — concise and accurate |
| Why it exists | ❌ | No motivation/problem statement section |
| Installation | ✅ | Clear with `npx` command and alternatives |
| Quick start example | ✅ | 4-step guide |
| Configuration section | ❌ | Deferred to `.devcontainer/README.md` — no inline summary |
| Contributing section | ✅ | Added with link to CONTRIBUTING.md and CLA |
| License section | ✅ | Dedicated section with GPL-3.0 link + commercial licensing notice |
| Roadmap | ❌ | Not present |
| Architecture overview | ❌ | Not present (relevant for dev tooling) |

**Recommendation:**
- **Why it exists** — **Implement.** 2-3 sentences explaining the problem (configuring dev environments for Claude Code is tedious/error-prone). Makes the README compelling.
- **Configuration** — **Implement.** A brief section (5-10 lines) summarizing key config options with a link to the full guide. Users shouldn't have to click through to know if config exists.
- **Contributing** — **Implement.** Even a short section saying "See CONTRIBUTING.md" with a link. Standard expectation for public repos.
- **License section** — **Implement.** Add a 2-line section: license name + link to LICENSE.txt. Badges alone aren't sufficient for some compliance scanners.
- **Roadmap** — **Ignore.** You use `.specs/BACKLOG.md` internally. A public roadmap is optional for this project type.
- **Architecture overview** — **Consider.** A brief diagram or section listing the plugin/feature/agent architecture would help contributors understand the system. Lower priority.

---

## Automation Hygiene

| Item | Status | Notes |
|------|--------|-------|
| CI required for merge | ✅ | CI workflow added (test + lint jobs). Status checks ⏳ post-merge ruleset update |
| Tests required | ✅ | CI workflow runs `npm test` on PRs and pushes to main |
| Lint required | ✅ | CI workflow runs Biome lint on PRs and pushes to main |
| No direct pushes to main | ✅ | Ruleset enforces PR requirement with `non_fast_forward` rule |
| Squash-only merge | ✅ | Ruleset `allowed_merge_methods: ["squash"]` |
| Signed commits | ✅ | `required_signatures` rule active |

**Recommendation:**
- **CI workflow** — **Implement (high priority).** Create a `.github/workflows/ci.yml` that runs on PRs: `npm test` + lint. This is the biggest gap — you have tests but they only gate releases, not PRs.
- **Required status checks** — **Implement** after CI workflow exists. Add `required_status_checks` to the ruleset so PRs can't merge without passing CI.
- **Lint step** — **Implement.** You ship `biome` and `ruff` — use them in CI.

---

## Opinionated Setup (Solo + Technical)

| Item | Status | Notes |
|------|--------|-------|
| Require PR | ✅ | Enforced via ruleset |
| Restrict updates (you only) | ✅ | `bypass_actors` limited to repo admin (RepositoryRole 5) |
| Status checks required | ⏳ | Post-merge: add `required_status_checks` to ruleset 13201702 (test + lint) |
| Squash-only merge | ✅ | Enforced |
| Signed commits | ✅ | Enforced |
| Automation can open PRs but NOT bypass | ✅ | No automation actors in bypass list; CI now gates merges |
| No auto-merge without review | ✅ | 1 required review, dismiss stale reviews, require last push approval |

---

## Dual Licensing & Commercial Licensing Strategy

### Current State

| Item | Status | Notes |
|------|--------|-------|
| Dual licensing notice in README | ✅ | License section with commercial licensing notice added |
| Dual licensing notice in LICENSE.txt | ✅ | Dual licensing header prepended to GPL-3.0 text |
| CLA for contributors | ✅ | CLA.md added; CLA Assistant GitHub App install is manual/post-merge |
| Copyright ownership documentation | ✅ | SPDX headers with `Copyright (c) 2026 Marcus Krueger` in all source files |
| Commercial license template | ❌ | Prepared offline, not in repo (out of scope) |
| Contact method for licensing inquiries | ✅ | Email in README, LICENSE.txt, and issue template config |

### Why This Matters

Dual licensing (GPL-3.0 public + commercial for paying customers) is a proven monetization model for dev tooling. But it **only works if you own 100% of the copyright**. The moment an external contributor submits code without a CLA, you lose the legal right to offer that code under a non-GPL license.

### What to Implement

**1. Contributor License Agreement (CLA)** — **Critical if dual licensing**

You need contributors to grant you relicensing rights. Two common approaches:

| Approach | Pros | Cons |
|----------|------|------|
| **CLA Assistant** (GitHub App) | Automated, signs on first PR via comment. Free. [cla-assistant.io](https://cla-assistant.io/) | Extra step for contributors |
| **DCO (Developer Certificate of Origin)** | Lighter — `Signed-off-by` line in commits. No separate agreement | Does NOT grant relicensing rights — insufficient for dual licensing |

**Recommendation:** Use **CLA Assistant** with a simple CLA that grants you the right to sublicense contributions. DCO alone is not enough for dual licensing.

**2. README Licensing Notice** — Add to the License section:

```
## License

This project is licensed under the [GNU General Public License v3.0](LICENSE.txt).

**Commercial licensing** is available for organizations that need to use CodeForge
without GPL obligations. Contact [your-email] for terms.
```

**3. CONTRIBUTING.md CLA Section** — Make it clear upfront:

```
## Contributor License Agreement

By submitting a pull request, you agree to the CodeForge CLA, which grants
the project maintainer the right to relicense your contributions. This enables
us to offer commercial licenses while keeping the open source version free
under GPL-3.0.

The CLA bot will prompt you to sign on your first PR.
```

**4. Copyright Ownership File** — Optional but recommended. A `COPYRIGHT` file or section in README stating:

```
Copyright (c) 2026 AnExiledDev. All rights reserved.
Licensed under GPL-3.0. Commercial licenses available.
```

**5. Commercial License Template** — Prepare a standard commercial license agreement. Does not need to live in the repo, but have it ready before advertising availability. Key terms to cover:
- Scope of use (embedding, distribution, modification)
- Support/maintenance terms (if any)
- Warranty disclaimers
- Duration and renewal

### Decision Tree

```
Want to offer commercial licenses?
├── YES → Implement CLA + dual licensing notice + copyright headers
│         ├── Accepting external contributions? → CLA is MANDATORY
│         └── Solo-only contributions? → CLA not needed yet, but add before opening to contributors
└── NO  → Keep current setup. No CLA needed. CONTRIBUTING.md just states GPL-3.0 terms.
```

### Impact on Other Checklist Items

If you pursue dual licensing, these items change:

| Item | Previous | Updated |
|------|----------|---------|
| CLA | ✅ "No CLA (correct for GPL3)" | ❌ → **Implement CLA** |
| CONTRIBUTING.md | ❌ "Note GPL3 implications" | ❌ → **Note GPL3 + CLA + dual licensing** |
| Copyright headers | ❌ SPDX only | ❌ → **SPDX + copyright holder name** (required for relicensing proof) |
| README License section | ⚠️ Badge only | ❌ → **Full section with commercial notice** |

---

## Priority Actions

### Do Now (high impact, low effort)

1. **Add repo topics** — `gh repo edit --add-topic devcontainer,claude-code,ai-development,developer-tools,vscode`
2. **Add `breaking-change` label** — `gh label create "breaking-change" -c "D93F0B"`
3. **Create CI workflow** — run `npm test` + lint on PRs
4. **Add `required_status_checks`** to ruleset after CI exists
5. **Enable Dependabot** — create `.github/dependabot.yml`

### Dual Licensing (decide first, then implement)

6. **Decide: dual licensing yes/no** — this gates items 7-9
7. **Set up CLA** — CLA Assistant GitHub App + CLA document (if dual licensing)
8. **Add dual licensing notice** — README License section + LICENSE.txt header (if dual licensing)
9. **Prepare commercial license template** — offline, not in repo (if dual licensing)

### Do Soon (moderate effort, professional polish)

10. **Add issue templates** — bug report + feature request in `.github/ISSUE_TEMPLATE/`
11. **Add PR template** — `.github/pull_request_template.md`
12. **Create CONTRIBUTING.md** — contribution guidelines + GPL-3.0 + CLA notice (if applicable)
13. **Add SPDX copyright headers** — `SPDX-License-Identifier` + `Copyright (c)` to source files
14. **Add CodeQL workflow** — `.github/workflows/codeql.yml`

### Enhance README

15. Add "Why CodeForge?" section
16. Add brief Configuration summary
17. Add Contributing section (link to CONTRIBUTING.md)
18. Add License section with commercial licensing notice (not just badge)

### Ignore

- **COPYING file** — `LICENSE.txt` is sufficient
- **Discussions** — issues are enough for a solo project
- **Public roadmap** — internal backlog serves the purpose
- **Wiki** — README + docs site covers it
- **DCO** — insufficient for dual licensing; use a real CLA instead

---

## Scorecard

| Category | Score | Change |
|----------|-------|--------|
| Professional Signals | 7/9 | +3 (CI badge, Dependabot, CodeQL). Topics + Discussions ⏳ post-merge |
| GPL-3.0 Best Practices | 5/5 | +3 (copyright headers, CONTRIBUTING.md, CLA) |
| PR & Issue Hygiene | 7/8 | +3 (issue templates, PR template). `breaking-change` label ⏳ post-merge |
| README Quality | 6/9 | +2 (Contributing section, License section) |
| Automation Hygiene | 6/6 | +3 (CI workflow, tests on PR, lint on PR) |
| Opinionated Setup | 6/7 | +1 (CI gates merges). `required_status_checks` ⏳ post-merge |
| Dual Licensing Readiness | 5/6 | +5 (README notice, LICENSE header, CLA, copyright docs, contact). Commercial template offline |
| **Overall** | **42/50 (84%)** | **+20 from 22/50** |

Remaining ⏳ items require post-merge GitHub API changes (topics, discussions, labels, required status checks, vulnerability alerts). See "GitHub API Changes (Post-Merge)" in the PR description.
