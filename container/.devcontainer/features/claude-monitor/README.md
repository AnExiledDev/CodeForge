# Claude Monitor Feature

Installs [Claude Code Usage Monitor](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor) - a real-time terminal application for tracking Claude Code token consumption.

## Features

- **Real-time monitoring** with configurable refresh rates (0.1-20 Hz)
- **Multiple views**: realtime, daily, monthly usage reports
- **ML-based predictions** using P90 percentile for limit forecasting
- **Cost tracking** with automatic plan detection
- **Rich terminal UI** with WCAG-compliant progress displays

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | string | `latest` | Version to install |
| `installer` | string | `uv` | Package installer (`uv`, `pipx`, or `pip`) |
| `username` | string | `automatic` | Container user to install for |

## Usage

```json
"features": {
    "./features/claude-monitor": {
        "version": "latest",
        "installer": "uv",
        "username": "automatic"
    }
}
```

## Commands

After installation, these commands are available:

| Command | Description |
|---------|-------------|
| `claude-monitor` | Full command name |
| `cmonitor` | Short alias |
| `ccmonitor` | Alternative alias |
| `ccm` | Shortest alias |

## Examples

```bash
# Real-time monitoring (default)
claude-monitor

# Daily usage report
claude-monitor --daily

# Monthly usage report
claude-monitor --monthly

# Custom refresh rate (Hz)
claude-monitor --refresh 5

# Help and options
claude-monitor --help
```

## Requirements

- Python 3.9+ (provided by base image)
- Network access for package installation

## Related Tools

- [ccusage](https://github.com/ryoppippi/ccusage) - Token usage analyzer (Node.js-based, also available as a feature)

## License

MIT
