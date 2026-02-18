# protected-files-guard

Claude Code plugin that blocks modifications to sensitive files — environment secrets, lock files, git internals, certificates, and credentials. Covers both direct file edits (Edit/Write tools) and indirect writes through Bash commands.

## What It Does

Intercepts file operations and checks target paths against a set of protected patterns. If a match is found, the operation is blocked with an error message explaining why and suggesting the correct approach (e.g., "use npm install instead" for package-lock.json).

### Protected File Categories

| Category | Patterns | Reason |
|----------|----------|--------|
| Environment secrets | `.env`, `.env.*` | Contains secrets |
| Git internals | `.git/` | Managed by git |
| Lock files | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Gemfile.lock`, `poetry.lock`, `Cargo.lock`, `composer.lock`, `uv.lock` | Must be modified via package manager |
| Certificates & keys | `.pem`, `.key`, `.crt`, `.p12`, `.pfx` | Sensitive cryptographic material |
| Credential files | `credentials.json`, `secrets.yaml`, `secrets.yml`, `secrets.json`, `.secrets` | Contains secrets |
| Auth directories | `.ssh/`, `.aws/` | Contains authentication data |
| Auth config files | `.netrc`, `.npmrc`, `.pypirc` | Contains authentication credentials |
| SSH private keys | `id_rsa`, `id_ed25519`, `id_ecdsa` | SSH private key files |

## How It Works

### Two-Hook Architecture

The plugin registers two PreToolUse hooks to cover different attack vectors:

```
Claude calls Edit or Write tool
  │
  └─→ guard-protected.py checks file_path against protected patterns
       │
       ├─→ Match → exit 2 (block)
       └─→ No match → exit 0 (allow)

Claude calls Bash tool
  │
  └─→ guard-protected-bash.py extracts write targets from the command
       │
       ├─→ Detects: > redirect, >> append, tee, cp, mv, sed -i, cat heredoc
       ├─→ Checks each target against protected patterns
       ├─→ Any match → exit 2 (block)
       └─→ No match → exit 0 (allow)
```

### Bash Write Detection

The Bash guard parses commands for write-indicating patterns and extracts the target file path:

| Pattern | Example |
|---------|---------|
| Redirect (`>`, `>>`) | `echo "key=val" > .env` |
| `tee` / `tee -a` | `cat data \| tee .env` |
| `cp` / `mv` | `cp template .env` |
| `sed -i` | `sed -i 's/old/new/' .env` |
| `cat` heredoc | `cat <<EOF > .env` |

### Error Handling

| Scenario | Behavior |
|----------|----------|
| JSON parse failure | Fails closed (exit 2) — blocks the operation |
| Other exceptions | Fails open (exit 0) — logs error, allows the operation |

### Timeout

Both hooks have a 5-second timeout.

## Plugin Structure

```
protected-files-guard/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── hooks/
│   └── hooks.json               # PreToolUse hook registrations (Edit|Write + Bash)
├── scripts/
│   ├── guard-protected.py       # Edit/Write file path checker
│   └── guard-protected-bash.py  # Bash command write target checker
└── README.md                    # This file
```

## Requirements

- Python 3.11+
- Claude Code with plugin hook support
