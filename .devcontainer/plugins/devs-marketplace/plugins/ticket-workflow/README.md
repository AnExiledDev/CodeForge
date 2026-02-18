# ticket-workflow

Claude Code plugin that provides an EARS-based ticket workflow with GitHub issues as the single source of truth. Command-driven — no hooks or scripts, just a custom system prompt and four slash commands.

## What It Does

Provides a structured workflow for creating, planning, reviewing, and shipping work through GitHub issues. All major decisions, plans, and progress are posted as issue comments to maintain an audit trail.

### Slash Commands

| Command | Description |
|---------|-------------|
| `/ticket:new` | Transform requirements into a structured GitHub issue with EARS-formatted business requirements |
| `/ticket:work` | Retrieve a ticket, create a technical implementation plan, and post it to the GitHub issue |
| `/ticket:review-commit` | Conduct a thorough code review, verify requirements are met, and commit with a detailed message |
| `/ticket:create-pr` | Create a pull request with aggressive security and architecture review |

### EARS Requirement Format

Every requirement uses one of these patterns:

| Type | Template |
|------|----------|
| Ubiquitous | The `<system>` shall `<response>`. |
| Event-Driven | WHEN `<trigger>`, the `<system>` shall `<response>`. |
| State-Driven | WHILE `<state>`, the `<system>` shall `<response>`. |
| Unwanted Behavior | IF `<condition>`, THEN the `<system>` shall `<response>`. |
| Optional Feature | WHERE `<feature>`, the `<system>` shall `<response>`. |

## How It Works

### Workflow Lifecycle

```
/ticket:new [requirements]
  │
  └─→ Gather requirements → Create EARS-formatted GitHub issue
       │
       └─→ /ticket:work #123
            │
            └─→ Fetch issue → Create technical plan → Post plan as issue comment
                 │
                 │  ... implementation work ...
                 │
                 └─→ /ticket:review-commit
                      │
                      └─→ Review changes → Verify requirements → Commit
                           │
                           └─→ /ticket:create-pr
                                │
                                └─→ Create PR → Security/architecture review → Post findings
```

### Ticket Structure

Each ticket created by `/ticket:new` includes:
- **Overview**: Plain language description
- **Requirements**: EARS-formatted business requirements
- **Technical Questions**: Open questions for implementation
- **Acceptance Criteria**: Verifiable conditions for completion

### Audit Trail

| Action | Destination |
|--------|-------------|
| Plans | Issue comment |
| Decisions | Issue comment |
| Requirement changes | Issue comment |
| Commit summaries | Issue comment |
| Review findings | PR + issue comment |
| Created sub-issues | Linked to source ticket |

### Custom System Prompt

The plugin injects a system prompt that defines the assistant persona, coding standards (SOLID, DRY, KISS, YAGNI), testing standards, and the ticket workflow rules. This ensures consistent behavior across all four commands.

## Plugin Structure

```
ticket-workflow/
├── .claude-plugin/
│   ├── plugin.json                  # Plugin metadata
│   ├── system-prompt.md             # Custom system prompt (persona + workflow rules)
│   └── commands/
│       ├── ticket:new.md            # Create EARS-formatted issue
│       ├── ticket:work.md           # Implementation planning
│       ├── ticket:review-commit.md  # Review and commit
│       └── ticket:create-pr.md      # PR creation with review
└── README.md                        # This file
```

## Requirements

- Claude Code with plugin command support
- [GitHub CLI](https://cli.github.com/) (`gh`) installed and authenticated
- A GitHub repository as the working context
