# Specification Template

Standard template for all feature specifications. Copy this structure when creating a new spec.

---

## Template

```markdown
# Feature: [Name]

**Version:** v0.X.0
**Status:** planned
**Last Updated:** YYYY-MM-DD
**Approval:** draft

## Intent

[What problem does this solve? Who has this problem? What's the cost of not solving it? 2-3 sentences.]

## Acceptance Criteria

[Testable criteria. Use Given/When/Then for complex flows, checklists for simple features, or tables for business rules. Every criterion must be verifiable.]

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Key Files

[File paths most relevant to implementation — paths an implementer should read first.]

**Backend:**
- `src/path/to/file.py` — [brief description]

**Frontend:**
- `src/web/path/to/component.svelte` — [brief description]

**Tests:**
- `tests/path/to/test_file.py` — [brief description]

## Schema / Data Model

[Reference migration files and model files by path. Describe what changes — do NOT paste DDL, Pydantic models, or TypeScript interfaces.]

- New table: `table_name` — see `src/db/migrations/NNN.sql`
- Modified: `existing_table` — added `column_name` column

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/resource` | List resources with pagination |
| POST | `/api/resource` | Create a new resource |

## Requirements

### Functional Requirements

- FR-1 [assumed]: [EARS format requirement — see specification-writing skill for templates]
- FR-2 [assumed]: When [event], the system shall [action].
- FR-3 [assumed]: If [unwanted condition], then the system shall [action].

### Non-Functional Requirements

- NFR-1 [assumed]: The system shall respond to [endpoint] within [N]ms at the [percentile] percentile.
- NFR-2 [assumed]: [Security, accessibility, scalability requirement]

## Dependencies

- [External system, library, or feature this depends on]
- [Blocked by: feature X must ship first]

## Out of Scope

- [Explicit non-goal 1 — prevents scope creep]
- [Explicit non-goal 2]

## Resolved Questions

[Decisions explicitly approved by the user via `/spec-refine`. Each entry: decision topic, chosen option, date, brief rationale.]

## Implementation Notes

[Post-implementation only. Leave empty in planned specs. After building, document what actually shipped vs. what was planned.]

## Discrepancies

[Post-implementation only. Document gaps between spec intent and actual build. Prevents next session from re-planning decided work.]
```

---

## Field Descriptions

| Section | Required | When to Fill |
|---------|----------|-------------|
| Intent | Always | At creation |
| Acceptance Criteria | Always | At creation |
| Key Files | Always | At creation (update post-implementation) |
| Schema / Data Model | If applicable | At creation |
| API Endpoints | If applicable | At creation |
| Requirements | Always | At creation |
| Dependencies | If applicable | At creation |
| Out of Scope | Always | At creation |
| Implementation Notes | Post-implementation | After building |
| Discrepancies | Post-implementation | After building |

## Status Values

| Status | Meaning |
|--------|---------|
| `planned` | Spec written, implementation not started |
| `partial` | Some acceptance criteria implemented, work ongoing |
| `implemented` | All acceptance criteria met, as-built notes complete |
