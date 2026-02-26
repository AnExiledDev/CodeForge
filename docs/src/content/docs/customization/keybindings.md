---
title: Keybindings
description: Resolve keyboard shortcut conflicts between VS Code and Claude Code, and customize Claude Code keybindings.
sidebar:
  order: 6
---

Claude Code runs inside VS Code's integrated terminal. Some VS Code shortcuts are intercepted before reaching the terminal, which conflicts with Claude Code's own keybindings. This page explains the conflicts and three ways to resolve them.

## Shortcut Conflicts

When the terminal is focused, VS Code intercepts these shortcuts before Claude Code can process them:

| Shortcut | VS Code Action | Claude Code Action |
|----------|---------------|-------------------|
| <kbd>Ctrl</kbd>+<kbd>G</kbd> | Go to Line | External editor |
| <kbd>Ctrl</kbd>+<kbd>S</kbd> | Save File | Stash conversation |
| <kbd>Ctrl</kbd>+<kbd>T</kbd> | Open Symbol | Toggle todos |
| <kbd>Ctrl</kbd>+<kbd>O</kbd> | Open File | Toggle transcript |
| <kbd>Ctrl</kbd>+<kbd>B</kbd> | Toggle Sidebar | Background task |
| <kbd>Ctrl</kbd>+<kbd>P</kbd> | Quick Open | Model picker |
| <kbd>Ctrl</kbd>+<kbd>R</kbd> | Open Recent | Search history |
| <kbd>Ctrl</kbd>+<kbd>F</kbd> | Find in Terminal | Navigation |

## Already Resolved

CodeForge pre-configures <kbd>Ctrl</kbd>+<kbd>P</kbd> and <kbd>Ctrl</kbd>+<kbd>F</kbd> to pass through to Claude Code via `terminal.integrated.commandsToSkipShell` in `devcontainer.json`:

```json
"terminal.integrated.commandsToSkipShell": [
    "-workbench.action.quickOpen",
    "-workbench.action.terminal.focusFind"
]
```

The `-` prefix removes the shortcut from VS Code's interception list when the terminal is focused.

## Resolving Other Conflicts

### Option 1: Use Alt Variants

Claude Code binds <kbd>Alt</kbd> (Meta) variants for all shortcuts. Use <kbd>Alt</kbd>+<kbd>G</kbd> instead of <kbd>Ctrl</kbd>+<kbd>G</kbd>, and so on. No configuration needed.

### Option 2: Add to VS Code's Skip List

Add more shortcuts to `terminal.integrated.commandsToSkipShell` in `devcontainer.json`:

```json
"terminal.integrated.commandsToSkipShell": [
    "-workbench.action.quickOpen",
    "-workbench.action.terminal.focusFind",
    "-workbench.action.gotoLine",
    "-workbench.action.files.save"
]
```

Common command IDs:

| Shortcut | VS Code Command ID |
|----------|-----------|
| <kbd>Ctrl</kbd>+<kbd>G</kbd> | `workbench.action.gotoLine` |
| <kbd>Ctrl</kbd>+<kbd>S</kbd> | `workbench.action.files.save` |
| <kbd>Ctrl</kbd>+<kbd>T</kbd> | `workbench.action.showAllSymbols` |
| <kbd>Ctrl</kbd>+<kbd>O</kbd> | `workbench.action.files.openFile` |
| <kbd>Ctrl</kbd>+<kbd>B</kbd> | `workbench.action.toggleSidebarVisibility` |
| <kbd>Ctrl</kbd>+<kbd>R</kbd> | `workbench.action.openRecent` |

### Option 3: Custom Claude Code Keybindings

Edit `.devcontainer/config/defaults/keybindings.json` to remap Claude Code actions to non-conflicting shortcuts:

```json
{
  "bindings": [
    {
      "key": "ctrl+shift+g",
      "command": "chat:externalEditor",
      "description": "Open external editor (remapped from Ctrl+G)"
    },
    {
      "key": "ctrl+shift+s",
      "command": "chat:stash",
      "description": "Stash conversation (remapped from Ctrl+S)"
    }
  ]
}
```

The keybindings file is deployed to `~/.claude/keybindings.json` on container start via `file-manifest.json`.

## Claude Code Shortcut Reference

Full list of default Claude Code shortcuts (these work when Claude Code has terminal focus):

| Key | Action |
|-----|--------|
| <kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>Esc</kbd> | Cancel / Interrupt |
| <kbd>Ctrl</kbd>+<kbd>L</kbd> | Clear screen |
| <kbd>Ctrl</kbd>+<kbd>P</kbd> | Model picker |
| <kbd>Ctrl</kbd>+<kbd>R</kbd> | Search history |
| <kbd>Ctrl</kbd>+<kbd>G</kbd> | External editor |
| <kbd>Ctrl</kbd>+<kbd>S</kbd> | Stash conversation |
| <kbd>Ctrl</kbd>+<kbd>T</kbd> | Toggle todos |
| <kbd>Ctrl</kbd>+<kbd>O</kbd> | Toggle transcript |
| <kbd>Ctrl</kbd>+<kbd>B</kbd> | Background current task |
| <kbd>Ctrl</kbd>+<kbd>F</kbd> | Find in output |

All of these also have <kbd>Alt</kbd> (Meta) variants that work even when VS Code intercepts the <kbd>Ctrl</kbd> version.

## Related

- [Configuration](./configuration/) — settings.json and file-manifest reference
- [Hooks](./hooks/) — lifecycle hooks that can be customized
- [Commands](../reference/commands/) — full CLI and slash command reference
