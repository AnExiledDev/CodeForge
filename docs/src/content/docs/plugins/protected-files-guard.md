---
title: Protected Files Guard
description: The protected files guard plugin prevents modification of designated critical files during Claude Code sessions.
sidebar:
  order: 9
---

The protected files guard prevents Claude from modifying files that should never be touched by an AI assistant -- secrets, credentials, lock files, and other sensitive content. Even if Claude has a legitimate reason to suggest changes to these files, the guard ensures that only a human makes those edits.

## How It Works

The plugin operates through two protection layers that together cover all modification paths:

| Script | What It Intercepts |
|--------|-------------------|
| `guard-protected.py` | Write and Edit tool calls targeting protected files |
| `guard-protected-bash.py` | Bash commands that would write to protected files (via redirects, `tee`, `cp`, `mv`, `sed -i`, etc.) |

Both scripts use the same set of protected file patterns. When a match is found, the operation is blocked with exit code 2 and a message explaining why the file is protected and what to do instead.

## Protected File Categories

### Secrets and Environment Variables

Files that typically contain API keys, database passwords, and other credentials:

| Pattern | Examples |
|---------|---------|
| `.env` | `.env`, `config/.env` |
| `.env.*` | `.env.local`, `.env.production` |
| `credentials.json` | `credentials.json`, `config/credentials.json` |
| `secrets.yaml` / `secrets.yml` / `secrets.json` | Any secrets file |
| `.secrets` | `.secrets` |

### Lock Files

Lock files should only be modified by their respective package managers, never edited directly:

| Pattern | Correct Alternative |
|---------|-------------------|
| `package-lock.json` | Run `npm install` instead |
| `yarn.lock` | Run `yarn install` instead |
| `pnpm-lock.yaml` | Run `pnpm install` instead |
| `Gemfile.lock` | Run `bundle install` instead |
| `poetry.lock` | Run `poetry install` instead |
| `Cargo.lock` | Run `cargo build` instead |
| `composer.lock` | Run `composer install` instead |
| `uv.lock` | Run `uv sync` instead |

:::tip[Lock File Edits]
The guard's block messages include the correct command to use. For example, blocking a `package-lock.json` edit tells you to run `npm install` instead. This helps Claude suggest the right approach.
:::

### Cryptographic Material

Private keys, certificates, and other sensitive cryptographic files:

| Pattern | What It Protects |
|---------|-----------------|
| `*.pem` | PEM-encoded keys and certificates |
| `*.key` | Private key files |
| `*.crt` | Certificate files |
| `*.p12` / `*.pfx` | PKCS#12 certificate bundles |
| `id_rsa*`, `id_ed25519*`, `id_ecdsa*` | SSH private keys |

### Authentication Configuration

Directories and files containing authentication tokens and credentials:

| Pattern | What It Protects |
|---------|-----------------|
| `.ssh/` | SSH keys and configuration |
| `.aws/` | AWS credentials and config |
| `.netrc` | Network authentication credentials |
| `.npmrc` | npm registry auth tokens |
| `.pypirc` | PyPI upload credentials |

### Git Internals

| Pattern | What It Protects |
|---------|-----------------|
| `.git/` | Git internal state -- always managed by git itself |

## The Bash Protection Layer

The `guard-protected-bash.py` script adds a second layer of protection specifically for shell commands. It detects write operations by looking for these patterns in the command string:

- **Output redirection**: `> file` and `>> file`
- **tee**: `tee file` and `tee -a file`
- **File operations**: `cp ... dest` and `mv ... dest`
- **In-place edits**: `sed -i ... file`
- **Heredoc writes**: `cat > file`

For each detected write target, the script checks it against the same protected patterns used by the Edit/Write guard. If a match is found, the entire command is blocked.

:::caution[Bash Layer Limitations]
The Bash guard uses regex pattern matching on command strings, which covers common write patterns but can't catch every possible way a shell command might modify a file. The Edit/Write guard is the primary protection layer; the Bash guard adds defense in depth.
:::

## Fail-Safe Behavior

Both guard scripts follow a "fail closed" philosophy for JSON parsing errors -- if the hook can't read its input, it blocks the operation rather than allowing something it couldn't inspect. For other unexpected errors, the scripts log to stderr and allow the operation to prevent false blocks from breaking the workflow.

## Hook Registration

| Script | Hook | Matcher | Purpose |
|--------|------|---------|---------|
| `guard-protected.py` | PreToolUse | Edit, Write | Blocks Write/Edit on protected files |
| `guard-protected-bash.py` | PreToolUse | Bash | Blocks shell commands that write to protected files |

## Related

- [Workspace Scope Guard](./workspace-scope-guard/) -- directory-level access control
- [Dangerous Command Blocker](./dangerous-command-blocker/) -- command-level safety
- [Hooks](../customization/hooks/) -- how PreToolUse hooks work
