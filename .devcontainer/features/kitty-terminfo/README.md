# kitty-terminfo

Installs xterm-kitty terminfo so Kitty terminal users get full color and capability support.

## What It Does

Downloads and compiles the official kitty terminfo entry from the [Kitty terminal repository](https://github.com/kovidgoyal/kitty). This ensures Kitty terminal users connecting to the container get proper color rendering, cursor shapes, and terminal capabilities.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `version` | `latest` | Set `"none"` to skip installation. |

## Usage

No configuration needed. Once installed, containers automatically recognize `TERM=xterm-kitty` and provide full capability support.

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
