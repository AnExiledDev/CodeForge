# kitty-terminfo

Installs xterm-kitty terminfo so Kitty terminal users get full color and capability support.

## What It Does

Downloads and compiles the official kitty terminfo entry from the [Kitty terminal repository](https://github.com/kovidgoyal/kitty). This ensures Kitty terminal users connecting to the container get proper color rendering, cursor shapes, and terminal capabilities.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `version` | `latest` | Set `"none"` to skip installation. |

## Usage

The container defaults to `TERM=xterm-256color` with `COLORTERM=truecolor`, which provides full 256-color and 24-bit truecolor support for all terminals.

For Kitty users: the `devcontainer.json` `remoteEnv` uses `${localEnv:TERM:xterm-256color}`, which forwards your host `TERM` into VS Code sessions. If your host sets `TERM=xterm-kitty`, the installed terminfo ensures full Kitty-specific capability support (correct `bce` behavior, status line, etc.). For non-VS Code entry points (tmux, `docker exec`, SSH), `setup-aliases.sh` upgrades `TERM=xterm` to `xterm-256color` but preserves any other value. If no Kitty TERM is forwarded, `xterm-256color` provides equivalent color rendering.

```bash
# Verify installation
infocmp xterm-kitty

# Check color support
tput colors  # should return 256
```

## How It Works

1. Checks if `xterm-kitty` terminfo is already present (skips if so)
2. Installs `ncurses-bin` if `tic` compiler is not available
3. Downloads the official kitty terminfo from GitHub
4. Compiles and installs to `/usr/share/terminfo`
