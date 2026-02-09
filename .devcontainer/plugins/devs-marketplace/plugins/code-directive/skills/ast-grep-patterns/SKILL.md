---
name: ast-grep-patterns
description: >-
  This skill should be used when the user asks to "use ast-grep",
  "structural search", "syntax-aware search", "find code patterns",
  "search with ast-grep", "use tree-sitter", "find function calls structurally",
  or discusses ast-grep patterns, structural code search, meta-variables,
  tree-sitter parsing, or syntax-aware code matching.
version: 0.1.0
---

# AST-Grep Patterns

## Mental Model

Text search finds **strings**. Structural search finds **code constructs**. When you need to find all calls to `fetch()` regardless of arguments, a regex like `fetch\(.*\)` matches strings inside comments, string literals, and variable names containing "fetch." ast-grep matches the actual function call in the syntax tree.

**When to use which tool:**

| Need | Tool | Why |
|------|------|-----|
| Simple text or identifier | `Grep` | Fastest for literal text matching |
| Code pattern with variable parts | `ast-grep` (`sg`) | Understands syntax, ignores comments/strings |
| Full parse tree or all symbols | `tree-sitter` | Deepest structural insight per file |
| File names by pattern | `Glob` | Path-based discovery |

**Default to Grep** for simple searches. Escalate to ast-grep when:
- The pattern has variable sub-expressions (any arguments, any name)
- You need to distinguish code from comments/strings
- The pattern spans multiple syntax elements (function with decorator, class with method)

---

## Meta-Variable Reference

ast-grep uses meta-variables to match parts of the syntax tree:

| Syntax | Meaning | Example |
|--------|---------|---------|
| `$NAME` | Matches exactly one AST node | `console.log($MSG)` matches `console.log("hi")` |
| `$$$ARGS` | Matches zero or more nodes (variadic) | `func($$$ARGS)` matches `func()`, `func(a)`, `func(a, b, c)` |
| `$_` | Wildcard — matches one node, not captured | `if ($_ ) { $$$BODY }` matches any if-statement |

**Key distinctions:**
- `$X` captures and can be referenced — use when you care about what matched
- `$_` is a throwaway — use when you just need "something here"
- `$$$X` is greedy — it captures everything between fixed anchors

---

## Tool Invocation

### ast-grep (`sg`)

```bash
# Basic pattern search
sg run -p 'PATTERN' -l LANGUAGE

# Search in specific directory
sg run -p 'PATTERN' -l LANGUAGE path/to/dir/

# With JSON output for parsing
sg run -p 'PATTERN' -l LANGUAGE --json
```

**Language identifiers**: `python`, `javascript`, `typescript`, `go`, `rust`, `java`, `c`, `cpp`, `css`, `html`

### tree-sitter

```bash
# Extract all definitions (functions, classes, methods)
tree-sitter tags /path/to/file.py

# Parse file and show syntax tree
tree-sitter parse /path/to/file.py

# Parse and show tree for specific language
tree-sitter parse --language python /path/to/file.py
```

---

## Common Cross-Language Patterns

### Function Calls

```bash
# Any call to a specific function
sg run -p 'fetch($$$ARGS)' -l javascript

# Method call on any object
sg run -p '$OBJ.save($$$ARGS)' -l python

# Chained method calls
sg run -p '$OBJ.filter($$$A).map($$$B)' -l javascript
```

### Function/Method Definitions

```bash
# Python function
sg run -p 'def $NAME($$$PARAMS): $$$BODY' -l python

# Async Python function
sg run -p 'async def $NAME($$$PARAMS): $$$BODY' -l python

# JavaScript/TypeScript function
sg run -p 'function $NAME($$$PARAMS) { $$$BODY }' -l javascript

# Arrow function assigned to variable
sg run -p 'const $NAME = ($$$PARAMS) => $$$BODY' -l javascript
```

### Import Statements

```bash
# Python imports
sg run -p 'from $MODULE import $$$NAMES' -l python
sg run -p 'import $MODULE' -l python

# JavaScript/TypeScript imports
sg run -p 'import $$$NAMES from "$MODULE"' -l javascript
sg run -p 'import { $$$NAMES } from "$MODULE"' -l typescript
```

### Class Definitions

```bash
# Python class
sg run -p 'class $NAME($$$BASES): $$$BODY' -l python

# TypeScript class
sg run -p 'class $NAME { $$$BODY }' -l typescript

# Class with extends
sg run -p 'class $NAME extends $BASE { $$$BODY }' -l typescript
```

### Error Handling

```bash
# Python try/except
sg run -p 'try: $$$TRY except $EXCEPTION: $$$EXCEPT' -l python

# JavaScript try/catch
sg run -p 'try { $$$TRY } catch ($ERR) { $$$CATCH }' -l javascript
```

### Decorators / Attributes

```bash
# Python decorator
sg run -p '@$DECORATOR def $NAME($$$PARAMS): $$$BODY' -l python

# Specific decorator
sg run -p '@app.route($$$ARGS) def $NAME($$$PARAMS): $$$BODY' -l python

# TypeScript decorator
sg run -p '@$DECORATOR class $NAME { $$$BODY }' -l typescript
```

---

## Combining Tools

Use ast-grep for structural finding, then Grep and Read for context:

1. **Find structurally**: `sg run -p 'pattern' -l lang` → get file paths and line numbers
2. **Filter textually**: Use `Grep` on the results to narrow by specific strings
3. **Read context**: Use `Read` to examine surrounding code for the matches

Example workflow — find all Express route handlers that don't have error handling:

```bash
# Step 1: Find all route handlers
sg run -p 'app.$METHOD($PATH, $$$HANDLERS)' -l javascript

# Step 2: Check which handlers lack try/catch (use Grep on matched files)
# Grep for the handler function names, then check for try/catch blocks

# Step 3: Read the full handler to confirm
```

---

## tree-sitter Integration

Use `tree-sitter` when you need the full syntax tree, not just pattern matches:

- **`tree-sitter tags`** — Extracts all definitions (functions, classes, methods, variables) from a file. Use for getting a file's API surface quickly.
- **`tree-sitter parse`** — Shows the complete syntax tree. Use for debugging ast-grep patterns that don't match as expected, or for understanding unfamiliar syntax.

---

## Ambiguity Policy

| Ambiguity | Default |
|-----------|---------|
| **Search tool not specified** | Use Grep for simple text; ast-grep for structural patterns |
| **Language not specified** | Infer from file extensions in the search directory |
| **Pattern too broad** | Narrow by directory first, then refine the pattern |
| **No results from ast-grep** | Fall back to Grep — the pattern may not match the exact syntax tree structure |
| **Complex nested pattern** | Break into simpler patterns and combine results |

---

## Reference Files

| File | Contents |
|------|----------|
| [Language Patterns](references/language-patterns.md) | Complete pattern catalog for Python, TypeScript/JavaScript, Go, and Rust — function calls, class definitions, imports, async patterns, and more with exact `sg` commands |
