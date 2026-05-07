# RTK — Token Compression

RTK (`rtk`) is installed in this environment. It compresses command output to save context window tokens.

## Instruction

**Always prefix shell commands with `rtk` when running supported commands.**

Examples:
- `rtk git status` instead of `git status`
- `rtk npm test` instead of `npm test`
- `rtk cargo build` instead of `cargo build`
- `rtk ls -la` instead of `ls -la`

## Supported Commands

git, npm, npx, yarn, pnpm, bun, bunx, cargo, rustup, pip, uv, uvx,
python, node, deno, go, docker, kubectl, helm, terraform,
aws, gcloud, az, make, cmake, gradle, mvn,
cat, ls, find, grep, rg, fd, tree, file, wc, du, df,
curl, wget, jq, yq, sed, awk, cut, sort, uniq, head, tail,
ps, top, free, uptime, env, printenv,
tar, zip, unzip, diff, patch,
pytest, jest, vitest, mocha,
eslint, prettier, biome, ruff, mypy, pyright, tsc, gh

## When NOT to Use RTK

- Interactive commands (vim, nano, less)
- Commands where you need exact byte-level output
- Piped commands where RTK would interfere with downstream parsing

## Meta-Commands

- `rtk gain` — show token savings
- `rtk discover` — list supported commands
- `rtk status` — version and config
