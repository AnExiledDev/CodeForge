# Workspace Scoping Rule

ALL file operations (reads, writes, edits, searches, globs, bash commands)
MUST target paths within the current project directory. No exceptions.

Violations:
- Writing, editing, or creating files outside the project directory is FORBIDDEN.
- Reading or searching outside the project directory is FORBIDDEN.
- Using paths like `/workspaces/.devcontainer/` when the project is at
  `/workspaces/projects/ProjectName/` is a scope violation — always use
  the project-relative path (e.g., `/workspaces/projects/ProjectName/.devcontainer/`).
- This rule applies even if a file exists at both locations. The project copy
  is the ONLY valid target.

Do not suggest, reference, or modify files in sibling project directories
or workspace-root directories that duplicate project content.
