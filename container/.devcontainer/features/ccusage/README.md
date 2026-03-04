# ccusage - Claude Code Usage Analyzer

A DevContainer feature that installs the ccusage CLI tool for analyzing Claude Code and Codex token usage from local JSONL files.

## Overview

ccusage tracks token usage and costs across daily, monthly, and session-based reports with live monitoring capabilities. This feature configures shell aliases for easy access to the tool via `npx`.

## Installation

Add this feature to your `.devcontainer/devcontainer.json`:

```json
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": {},
    "./features/ccusage": {}
  }
}
```

### With Custom Options

```json
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": {},
    "./features/ccusage": {
      "version": "latest",
      "shells": "both",
      "username": "automatic"
    }
  }
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | string | `latest` | ccusage version to use (e.g., 'latest', '1.0.0') |
| `shells` | string | `both` | Which shells to configure: `bash`, `zsh`, or `both` |
| `username` | string | `automatic` | Container user to install for (auto-detects vscode/node/codespace) |

## Usage

Once installed, use the `ccusage` command from any shell:

### Daily Usage Report
```bash
ccusage --daily
```
Shows token usage and costs for today.

### Monthly Report
```bash
ccusage --monthly
```
Displays monthly token consumption and costs.

### Live Monitoring
```bash
ccusage --live
```
Real-time monitoring of your Claude Code usage.

### JSON Output
```bash
ccusage --json
```
Output data in JSON format for scripting/integration.

### Compact Display
```bash
ccusage --compact
```
Minimal output for quick checks.

## Features

- **Beautiful Tables**: Formatted output with clear cost breakdown
- **Multiple Models**: Supports Claude Opus, Sonnet, and other models
- **Timezone Support**: Customize timezone and locale settings
- **Session Tracking**: View usage by individual sessions
- **Cost Tracking**: Accurate pricing for different models

## How It Works

This feature creates a shell alias that points to `npx -y ccusage@<version>`, which automatically downloads and runs the latest version of ccusage without requiring a global installation.

ccusage automatically reads from Claude Code's JSONL usage logs located in:
- `~/.claude/` (default)
- `$CLAUDE_CONFIG_DIR` (if customized)

## Advanced Options

For full list of ccusage command options:
```bash
ccusage --help
```

## Example Configurations

### Install for Specific User (zsh only)
```json
{
  "features": {
    "./features/ccusage": {
      "username": "vscode",
      "shells": "zsh"
    }
  }
}
```

### Pin to Specific Version
```json
{
  "features": {
    "./features/ccusage": {
      "version": "1.0.0"
    }
  }
}
```

### Bash Only Installation
```json
{
  "features": {
    "./features/ccusage": {
      "shells": "bash"
    }
  }
}
```

## Troubleshooting

### Command Not Found

If `ccusage` is not found after installation:

1. **Reload your shell**:
   ```bash
   source ~/.bashrc  # for bash
   source ~/.zshrc   # for zsh
   ```

2. **Check if alias is configured**:
   ```bash
   grep ccusage ~/.bashrc  # for bash
   grep ccusage ~/.zshrc   # for zsh
   ```

3. **Verify npx is available**:
   ```bash
   npx --version
   ```

### Permission Errors

If you see permission errors:
```bash
sudo chown -R $(whoami):$(whoami) ~/.bashrc
sudo chown -R $(whoami):$(whoami) ~/.zshrc
```

### Network Issues

If ccusage fails to download:
- Check your internet connection
- The tool will be cached after first successful download
- Try running manually: `npx -y ccusage@latest --version`

## Dependencies

This feature requires:
- **Node.js**: Install the `node` feature first
- The feature automatically declares this dependency via `installsAfter`

## Integration with Other Tools

This tool complements:
- **splitrail**: Real-time monitoring during active sessions
- **ccstatusline**: Visual status display in terminal

## Links

- **GitHub**: https://github.com/ryoppippi/ccusage
- **NPM**: https://www.npmjs.com/package/ccusage
- **DevContainer Features**: https://containers.dev/features

## Version History

### 1.0.0
- Initial release as DevContainer feature
- Automatic user detection
- Configurable shell support (bash/zsh/both)
- Version pinning support
- Idempotent installation

## License

This feature wrapper follows the same license as the underlying ccusage tool.
