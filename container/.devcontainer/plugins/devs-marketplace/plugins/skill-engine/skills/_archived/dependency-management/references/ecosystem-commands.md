# Ecosystem Commands Reference

Per-ecosystem command reference for dependency analysis. All commands are **read-only** — they inspect but never modify the project.

If a command is not found, note it as unavailable and skip. Do not attempt to install tools.

---

## Node.js (npm / yarn / pnpm)

### Outdated Packages

```bash
# npm
npm outdated 2>/dev/null || true

# yarn
yarn outdated 2>/dev/null || true

# pnpm
pnpm outdated 2>/dev/null || true
```

Output columns: Package, Current, Wanted (semver-compatible), Latest (newest).

### Security Audit

```bash
# npm — structured output for parsing
npm audit --json 2>/dev/null || true

# npm — human-readable summary
npm audit 2>/dev/null || true

# yarn
yarn audit 2>/dev/null || true

# pnpm
pnpm audit 2>/dev/null || true
```

### Unused Detection

No built-in command. Cross-reference `package.json` dependencies with source imports:

```bash
# List declared dependencies
node -e "const p=require('./package.json'); console.log(Object.keys(p.dependencies||{}).join('\n'))"

# Search for imports (use Grep tool, not bash grep)
# Pattern: require('pkg') or import ... from 'pkg'
```

Known exceptions to flag as "verify manually":
- `@types/*` packages — TypeScript type definitions, no runtime import
- Packages in `devDependencies` used only by build/test tooling
- Babel/ESLint/Prettier plugins loaded by configuration
- `dotenv` and similar packages loaded via `-r` flag or preload

### Version Conflicts

```bash
# Check for peer dependency issues
npm ls 2>&1 | head -100 || true

# Check for duplicated packages
npm ls --all 2>/dev/null | head -200 || true
```

### License Listing

```bash
# Using npx (no install needed)
npx license-checker --summary 2>/dev/null || true

# Detailed per-package
npx license-checker --json 2>/dev/null || true
```

---

## Python (pip / uv / poetry)

### Outdated Packages

```bash
# pip
pip list --outdated 2>/dev/null || true

# uv
uv pip list --outdated 2>/dev/null || true

# poetry
poetry show --outdated 2>/dev/null || true
```

### Security Audit

```bash
# pip-audit (preferred)
pip-audit 2>/dev/null || true

# pip-audit with JSON output
pip-audit --format json 2>/dev/null || true

# safety (alternative)
safety check 2>/dev/null || true
```

### Unused Detection

Cross-reference manifest with source imports:

```bash
# List declared dependencies from pyproject.toml
python3 -c "
import tomllib, pathlib
data = tomllib.loads(pathlib.Path('pyproject.toml').read_text())
deps = data.get('project', {}).get('dependencies', [])
for d in deps:
    print(d.split('>=')[0].split('==')[0].split('<')[0].split('>')[0].split('~=')[0].strip())
" 2>/dev/null || true
```

Then use Grep to search for `import pkg` or `from pkg import` across `.py` files.

Known exceptions: pytest plugins, mypy/ruff extensions, ASGI/WSGI servers (uvicorn, gunicorn), and packages used only in configuration files.

### Version Conflicts

```bash
# pip check for broken dependencies
pip check 2>/dev/null || true
```

### License Listing

```bash
# pip-licenses
pip-licenses 2>/dev/null || true

# pip-licenses with format
pip-licenses --format=json 2>/dev/null || true
```

---

## Rust (cargo)

### Outdated Packages

```bash
# Requires cargo-outdated
cargo outdated 2>/dev/null || true

# Alternative: check Cargo.toml against crates.io manually
cargo search <crate_name> 2>/dev/null || true
```

### Security Audit

```bash
# Requires cargo-audit
cargo audit 2>/dev/null || true

# JSON output
cargo audit --json 2>/dev/null || true
```

### Unused Detection

```bash
# Requires cargo-udeps (nightly)
cargo +nightly udeps 2>/dev/null || true
```

If `cargo-udeps` is unavailable, cross-reference `Cargo.toml` `[dependencies]` with `use` statements in `src/**/*.rs`.

### Version Conflicts

```bash
# Check dependency tree for duplicates
cargo tree --duplicates 2>/dev/null || true
```

### License Listing

```bash
# Requires cargo-license
cargo license 2>/dev/null || true

# Alternative: cargo-deny
cargo deny check licenses 2>/dev/null || true
```

---

## Go

### Outdated Packages

```bash
# List all dependencies with available updates
go list -u -m all 2>/dev/null || true
```

### Security Audit

```bash
# Official Go vulnerability checker
govulncheck ./... 2>/dev/null || true
```

### Unused Detection

Go modules are imported explicitly. Check for modules in `go.mod` not imported in any `.go` file:

```bash
# List declared modules
go list -m all 2>/dev/null | tail -n +2 || true

# Tidy check (would remove unused, but don't run with -v to avoid modifications)
# Instead, compare go.mod with actual imports via Grep
```

### Version Conflicts

Go uses minimum version selection — conflicts are rare. Check for replace directives that may mask issues:

```bash
# Show replace directives
grep -n "replace" go.mod 2>/dev/null || true

# Verify module graph consistency
go mod verify 2>/dev/null || true
```

### License Listing

```bash
# Requires go-licenses
go-licenses csv ./... 2>/dev/null || true

# Alternative: manual check via go.sum and module proxy
```

---

## Error Handling

When a tool is not installed:
- Note it as **unavailable** in the report.
- Skip that check and proceed to the next.
- Suggest installation if the tool would provide significant value.
- Never attempt to install tools — that changes system state.

Common missing tools and alternatives:
| Tool | Ecosystem | Alternative |
|------|-----------|-------------|
| `cargo-audit` | Rust | Check RustSec advisory DB manually |
| `cargo-outdated` | Rust | `cargo search` per crate |
| `pip-audit` | Python | `safety check` |
| `govulncheck` | Go | Check Go vulnerability DB manually |
| `license-checker` | Node.js | Read `license` field from each `node_modules/*/package.json` |
