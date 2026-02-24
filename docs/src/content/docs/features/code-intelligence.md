---
title: Code Intelligence
description: AST-based code analysis with ast-grep and tree-sitter, plus Language Server Protocol integration for rich code navigation.
sidebar:
  order: 5
---

CodeForge provides three layers of code intelligence that work together: structural pattern matching with ast-grep, syntax tree parsing with tree-sitter, and semantic analysis with LSP servers. Each layer serves a different purpose, and knowing when to reach for each one makes you (and Claude) dramatically more effective at understanding and navigating code.

## When to Use What

Before diving into each tool, here is the decision framework:

| You need to... | Use | Why |
|----------------|-----|-----|
| Find a text string or identifier | `grep` / Grep tool | Fastest for literal text |
| Find a code pattern with variable parts | **ast-grep** (`sg`) | Understands syntax, ignores comments and strings |
| Parse a file's structure or extract all symbols | **tree-sitter** | Deepest structural insight per file |
| Get type info, jump to definition, or find all references | **LSP** | Semantic analysis with full type understanding |

:::tip[Start simple, escalate when needed]
Default to Grep for simple searches. Escalate to ast-grep when your pattern has variable sub-expressions or when you need to distinguish real code from strings and comments. Use LSP when you need semantic understanding — type information, definition lookups, or call hierarchies.
:::

## ast-grep

ast-grep (`sg` command, also available as `ast-grep`) enables structural code search using Abstract Syntax Tree patterns. Unlike text-based search, ast-grep understands code structure — it matches patterns regardless of formatting, whitespace, or naming, and it never matches inside comments or string literals.

### Basic Usage

```bash
# Find all console.log calls, regardless of arguments
sg --pattern 'console.log($$$)' --lang js

# Find Python functions decorated with @app.route
sg --pattern '@app.route($PATH)' --lang python

# Find all async function definitions in a directory
sg --pattern 'async def $NAME($$$PARAMS)' --lang python src/api/

# Find fetch calls with any options
sg --pattern 'fetch($URL, $$$OPTS)' --lang typescript
```

### Metavariables

Metavariables are the key to writing effective ast-grep patterns:

| Syntax | Matches | Example |
|--------|---------|---------|
| `$NAME` | Any single AST node | `$FUNC($ARG)` matches `foo(bar)` |
| `$$$ARGS` | Zero or more nodes (variadic) | `console.log($$$ARGS)` matches `console.log()`, `console.log(a)`, `console.log(a, b, c)` |

The `$` prefix with a name creates a named capture. The `$$$` prefix creates a variadic capture that matches any number of nodes, including zero.

### Structural Replace

ast-grep can also transform code, not just search for it:

```bash
# Convert var to const
sg --pattern 'var $NAME = $VALUE' --rewrite 'const $NAME = $VALUE' --lang js

# Convert require to import
sg --pattern 'const $NAME = require($PATH)' --rewrite 'import $NAME from $PATH' --lang js

# Add error handling to fetch calls
sg --pattern 'await fetch($URL)' --rewrite 'await fetch($URL).catch(handleError)' --lang ts
```

:::caution[Preview before rewriting]
Always run a search first (`sg --pattern ...`) to see what will be matched before using `--rewrite`. Structural replace modifies files in place.
:::

### Real-World Patterns

Here are patterns that solve common code search problems:

```bash
# Find all class definitions with their names
sg --pattern 'class $NAME { $$$BODY }' --lang python

# Find specific decorator usage
sg --pattern '@pytest.mark.parametrize($$$ARGS)' --lang python

# Find import statements for a specific module
sg --pattern 'from $MOD import $$$NAMES' --lang python

# Find all try/except blocks (Python)
sg --pattern 'try: $$$BODY except $$$HANDLERS' --lang python

# Find React useState hooks
sg --pattern 'const [$STATE, $SETTER] = useState($$$INIT)' --lang tsx

# Find all Express route handlers
sg --pattern 'app.$METHOD($PATH, $$$HANDLERS)' --lang js
```

### Why Not Just Use Grep?

Consider searching for all calls to `fetch()`:

- **Grep** `fetch(` matches: function calls, comments mentioning fetch, strings containing "fetch(", variable names like `fetchData(`, and import statements.
- **ast-grep** `fetch($$$ARGS)` matches: only actual `fetch()` function calls in the AST, nothing else.

For simple identifier lookups, Grep is faster and sufficient. For pattern matching where structure matters, ast-grep eliminates false positives.

## tree-sitter

tree-sitter provides incremental parsing and concrete syntax tree operations. It parses source files into syntax trees that you can query, inspect, and traverse. CodeForge installs tree-sitter with grammars for JavaScript, TypeScript, and Python pre-loaded.

### Basic Usage

```bash
# Parse a file and output its syntax tree
tree-sitter parse src/main.py

# Extract all tagged definitions (functions, classes, methods) from a file
tree-sitter tags src/main.py

# Query the syntax tree with S-expression patterns
tree-sitter query '(function_definition name: (identifier) @name)' src/main.py
```

### When to Use tree-sitter

tree-sitter is most useful when you need to:

- **Understand file structure** — `tree-sitter tags` extracts all definitions (functions, classes, methods) from a file, giving you a quick symbol inventory.
- **Inspect nesting and complexity** — `tree-sitter parse` shows the full syntax tree, revealing nesting depth and structural complexity.
- **Write precise queries** — tree-sitter's S-expression query language lets you match specific syntactic constructs with field-level precision.

### tree-sitter vs ast-grep

Both tools work with syntax trees, but they serve different purposes:

| Feature | tree-sitter | ast-grep |
|---------|-------------|----------|
| **Scope** | Single file, deep analysis | Multi-file search |
| **Query syntax** | S-expressions (precise, verbose) | Code patterns (intuitive, concise) |
| **Best for** | Symbol extraction, parse tree inspection | Finding patterns across a codebase |
| **Output** | Syntax tree structure | Matching code locations |

In practice, Claude and the specialized agents use ast-grep for cross-file pattern searches and tree-sitter for per-file structural analysis. The [ast-grep-patterns skill](./skills/) provides comprehensive guidance for both tools.

## Language Server Protocol (LSP)

LSP servers provide semantic code intelligence — they understand types, scopes, definitions, and references at a level that syntax analysis alone cannot reach. CodeForge configures LSP servers for your installed language runtimes, giving Claude access to the same "go to definition" and "find references" operations your IDE provides.

### Installed LSP Servers

| Language | Server | Version |
|----------|--------|---------|
| **Python** | Pyright | 1.1.408 |
| **TypeScript/JavaScript** | typescript-language-server | 5.1.3 (with TypeScript 5.9.3) |
| **Go** | gopls | latest |

### Available Operations

| Operation | What it does | When to use it |
|-----------|-------------|----------------|
| `goToDefinition` | Jump to where a symbol is defined | "Where is this function defined?" |
| `findReferences` | Find all usages of a symbol | "Where is this class used?" |
| `hover` | Get type info and documentation | "What type does this return?" |
| `documentSymbol` | List all symbols in a file | "What functions are in this file?" |
| `workspaceSymbol` | Search symbols across the project | "Find all classes named Controller" |
| `goToImplementation` | Find interface implementations | "What implements this interface?" |
| `incomingCalls` | Find callers of a function | "What calls this function?" |
| `outgoingCalls` | Find callees from a function | "What does this function call?" |

### How LSP Differs from ast-grep

LSP understands **semantics** — types, scopes, and definitions. ast-grep understands **syntax** — code patterns and structure.

For example, if you search for `UserService` with ast-grep, you find every syntactic occurrence of that identifier. With LSP `findReferences`, you find only the places where that specific `UserService` class (the one defined in `services/user.py:15`) is actually used — excluding same-named classes in other modules, string mentions, and comments.

| Need | ast-grep | LSP |
|------|----------|-----|
| Find a code pattern | Excellent — designed for this | Not applicable |
| Find all references to a specific symbol | Finds text matches (may include false positives) | Finds semantic references (precise) |
| Get type information | Cannot | Full type inference |
| Navigate definition chains | Cannot | Go-to-definition across files |
| Work without a running server | Works immediately | Requires server startup |

## How They Work Together

The three tools form a progression from fast-and-broad to slow-and-precise:

```
Grep (text)  →  ast-grep (syntax)  →  LSP (semantics)
  Fastest            Fast              Precise
  Broadest           Focused           Narrowest
```

A typical investigation might use all three:

1. **Grep** to find files mentioning `authenticate` — casts a wide net quickly.
2. **ast-grep** to find all function calls to `authenticate(...)` — filters out comments, strings, and variable names.
3. **LSP** `findReferences` on the specific `authenticate` function in `auth/middleware.py` — finds only the call sites for that exact function, not other functions with the same name.

Claude and the specialized agents (especially the explorer and architect) use this progression automatically, starting with the fastest tool and escalating when precision matters.

## Related

- [CodeForge LSP Plugin](../plugins/codeforge-lsp/) — LSP server configuration
- [Tools Reference](./tools/) — CLI commands for these tools
- [ast-grep Patterns Skill](./skills/) — pattern-writing guidance
