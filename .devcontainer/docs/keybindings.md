# Keybinding Customization

Claude Code runs inside VS Code's integrated terminal. Some VS Code shortcuts are intercepted before reaching the terminal, conflicting with Claude Code's keybindings.

## Conflicts

| Shortcut | VS Code Action | Claude Code Action |
|----------|---------------|-------------------|
| `Ctrl+G` | Go to Line | `chat:externalEditor` |
| `Ctrl+S` | Save File | `chat:stash` |
| `Ctrl+T` | Open Symbol | `app:toggleTodos` |
| `Ctrl+O` | Open File | `app:toggleTranscript` |
| `Ctrl+B` | Toggle Sidebar | `task:background` |
| `Ctrl+P` | Quick Open | `chat:modelPicker` |
| `Ctrl+R` | Open Recent | `history:search` |
| `Ctrl+F` | Find in Terminal | (navigation) |

## Already Resolved

`Ctrl+P` and `Ctrl+F` are configured to pass through to Claude Code via `terminal.integrated.commandsToSkipShell` in `devcontainer.json`:

```json
"terminal.integrated.commandsToSkipShell": [
    "-workbench.action.quickOpen",
    "-workbench.action.terminal.focusFind"
]
```

The `-` prefix removes the shortcut from VS Code's interception list when the terminal is focused.

## Resolving Other Conflicts

### Option 1: Use Meta (Alt) Variants

Claude Code binds Meta (Alt) variants for all shortcuts. Use `Alt+G` instead of `Ctrl+G`, etc. No configuration needed.

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
| Shortcut | Command ID |
|----------|-----------|
| `Ctrl+G` | `workbench.action.gotoLine` |
| `Ctrl+S` | `workbench.action.files.save` |
| `Ctrl+T` | `workbench.action.showAllSymbols` |
| `Ctrl+O` | `workbench.action.files.openFile` |
| `Ctrl+B` | `workbench.action.toggleSidebarVisibility` |
| `Ctrl+R` | `workbench.action.openRecent` |

### Option 3: Custom Claude Code Keybindings

Edit `config/defaults/keybindings.json` to remap Claude Code actions to non-conflicting shortcuts:

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

The keybindings file is copied to `/workspaces/.claude/keybindings.json` on container start (controlled by `file-manifest.json`).

## Claude Code Keybinding Reference

Full list of default Claude Code shortcuts (these work when Claude Code has terminal focus):

| Key | Action |
|-----|--------|
| `Ctrl+C` / `Esc` | Cancel / Interrupt |
| `Ctrl+L` | Clear screen |
| `Ctrl+P` | Model picker |
| `Ctrl+R` | Search history |
| `Ctrl+G` | External editor |
| `Ctrl+S` | Stash conversation |
| `Ctrl+T` | Toggle todos |
| `Ctrl+O` | Toggle transcript |
| `Ctrl+B` | Background current task |
| `Ctrl+F` | Find in output |

All of these also have `Meta` (Alt) variants that work even when VS Code intercepts the `Ctrl` version.
