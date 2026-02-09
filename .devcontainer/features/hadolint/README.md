# hadolint

Dockerfile linter that validates best practices.

## What It Does

Installs [hadolint](https://github.com/hadolint/hadolint) as a static binary. Hadolint parses Dockerfiles and checks them against best-practice rules based on the official Docker documentation.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `version` | `v2.14.0` | hadolint version to install. Set `"latest"` for newest, `"none"` to skip. |

## Usage

```bash
hadolint Dockerfile
hadolint --ignore DL3008 Dockerfile    # ignore specific rule
hadolint -f json Dockerfile            # JSON output
```

## Configuration

Used by the `auto-linter` plugin to lint Dockerfiles on save. For project-specific ignores, create a `.hadolint.yaml` in your project root:

```yaml
ignored:
  - DL3008  # Pin versions in apt-get install
  - DL3009  # Delete apt lists
```

## Checksum Verification

Downloads are verified against per-binary `.sha256` files published with each GitHub release.
