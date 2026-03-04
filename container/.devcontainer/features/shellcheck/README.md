# ShellCheck

Static analysis tool for shell scripts.

## What It Does

Installs [ShellCheck](https://www.shellcheck.net/) via apt. ShellCheck finds bugs and style issues in bash/sh/zsh scripts, catching common pitfalls like unquoted variables, incorrect test syntax, and POSIX compatibility issues.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `version` | `latest` | Version to install (or `"none"` to skip). |

## Usage

```bash
shellcheck script.sh
shellcheck -x script.sh           # follow source'd files
shellcheck -f json script.sh      # JSON output
shellcheck -e SC2086 script.sh    # exclude specific rule
```

## Configuration

Used by the `auto-linter` plugin to lint shell scripts. For per-file directives, add comments at the top of your script:

```bash
# shellcheck disable=SC2086
# shellcheck shell=bash
```

For project-wide config, create a `.shellcheckrc`:

```
disable=SC2086,SC2034
shell=bash
```
