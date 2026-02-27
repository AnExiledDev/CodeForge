# tmux Terminal Multiplexer

Installs tmux for Claude Code Agent Teams split-pane support.

## What This Provides

- **tmux** terminal multiplexer for managing multiple terminal sessions
- **Catppuccin Mocha** theme with rounded window tabs and Nerd Font icons
- Pre-configured for Claude Code Agent Teams with optimized settings
- Mouse support enabled for easy pane navigation
- True color support (works with WezTerm, iTerm2, and other modern terminals)
- Transparent status bar background (inherits terminal theme)

## Claude Code Agent Teams Integration

When Agent Teams are enabled (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) and `teammateMode` is set to `"auto"` or `"tmux"`, Claude Code will automatically use tmux for split-pane display of teammates.

### VS Code Terminal Limitation

The VS Code integrated terminal does **not** support tmux split panes. To use split-pane mode with Agent Teams, you need to connect via an external terminal.

## Using External Terminal for Split Panes

### Option 1: Helper Scripts (Recommended)

Use the provided helper scripts in the `.codeforge/scripts/` folder:

**Linux/macOS:**
```bash
cd /path/to/your/project/.codeforge/scripts
./connect-external-terminal.sh
```

**Windows (PowerShell):**
```powershell
cd C:\path\to\your\project\.codeforge\scripts
.\connect-external-terminal.ps1
```

### Option 2: Manual Connection

1. Find your container ID:
   ```bash
   docker ps --filter "label=devcontainer.local_folder" --format "{{.ID}}"
   ```

2. Connect with tmux:
   ```bash
   docker exec -it <container-id> tmux new-session -A -s claude-teams
   ```

## tmux Quick Reference

| Key | Action |
|-----|--------|
| `Ctrl+B %` | Split pane vertically |
| `Ctrl+B "` | Split pane horizontally |
| `Ctrl+B arrow` | Navigate between panes |
| `Ctrl+B d` | Detach from session |
| `Ctrl+B [` | Enter scroll mode (q to exit) |

Mouse support is enabled - click to select panes, drag borders to resize.

## Prerequisites for Host Machine

### Linux
- Docker installed and running
- Any terminal emulator (GNOME Terminal, Konsole, Alacritty, etc.)

### Windows
- Docker Desktop installed and running
- Windows Terminal or PowerShell
- No additional software needed - tmux runs inside the container

### macOS
- Docker Desktop installed and running
- Terminal.app, iTerm2, or any terminal emulator
