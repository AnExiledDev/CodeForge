# shfmt

Shell script formatter supporting bash, mksh, and POSIX sh.

## What It Does

Installs [shfmt](https://github.com/mvdan/sh) as a static binary. shfmt formats shell scripts consistently, supporting bash, mksh, and POSIX sh dialects.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `version` | `v3.12.0` | shfmt version to install. Set `"latest"` for newest, `"none"` to skip. |

## Usage

```bash
shfmt script.sh              # print formatted output
shfmt -w script.sh           # format in place
shfmt -d script.sh           # show diff
shfmt -i 4 script.sh         # use 4-space indent
shfmt -l .                   # list files that need formatting
```

## Configuration

Used by the `auto-formatter` plugin for shell script formatting. Default formatting uses shfmt's defaults (tabs for indentation). For project-specific config, create an `.editorconfig`:

```ini
[*.sh]
indent_style = space
indent_size = 4
```

## Checksum Verification

Downloads are verified against `sha256sums.txt` published with each GitHub release.
