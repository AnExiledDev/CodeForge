# Language-Specific AST-Grep Patterns

Complete pattern reference organized by language. Each pattern includes the `sg` command and example matches.

---

## Python

### Function Definitions

```bash
# All functions
sg run -p 'def $NAME($$$PARAMS): $$$BODY' -l python

# Async functions
sg run -p 'async def $NAME($$$PARAMS): $$$BODY' -l python

# Functions with return type annotation
sg run -p 'def $NAME($$$PARAMS) -> $RET: $$$BODY' -l python

# Functions with specific decorator
sg run -p '@staticmethod
def $NAME($$$PARAMS): $$$BODY' -l python
```

### Class Definitions

```bash
# Any class
sg run -p 'class $NAME: $$$BODY' -l python

# Class with base classes
sg run -p 'class $NAME($$$BASES): $$$BODY' -l python

# Dataclass
sg run -p '@dataclass
class $NAME: $$$BODY' -l python

# Pydantic model
sg run -p 'class $NAME(BaseModel): $$$BODY' -l python
```

### Decorators

```bash
# Any decorated function
sg run -p '@$DEC
def $NAME($$$P): $$$B' -l python

# FastAPI/Flask route
sg run -p '@app.route($$$ARGS)
def $NAME($$$P): $$$B' -l python

# pytest fixture
sg run -p '@pytest.fixture
def $NAME($$$P): $$$B' -l python

# Property
sg run -p '@property
def $NAME(self): $$$B' -l python
```

### Imports

```bash
# From imports
sg run -p 'from $MOD import $$$NAMES' -l python

# Star import
sg run -p 'from $MOD import *' -l python

# Aliased import
sg run -p 'import $MOD as $ALIAS' -l python
```

### Try/Except

```bash
# Basic try/except
sg run -p 'try:
    $$$TRY
except $EXC:
    $$$HANDLER' -l python

# Bare except (code smell)
sg run -p 'try:
    $$$TRY
except:
    $$$HANDLER' -l python
```

### Comprehensions

```bash
# List comprehension
sg run -p '[$EXPR for $VAR in $ITER]' -l python

# Dict comprehension
sg run -p '{$KEY: $VAL for $VAR in $ITER}' -l python

# Generator with condition
sg run -p '($EXPR for $VAR in $ITER if $COND)' -l python
```

### Async Patterns

```bash
# Async with
sg run -p 'async with $CTX as $VAR: $$$BODY' -l python

# Await expression
sg run -p 'await $EXPR' -l python

# Async for
sg run -p 'async for $VAR in $ITER: $$$BODY' -l python
```

---

## TypeScript / JavaScript

### Function Calls

```bash
# Specific function call
sg run -p 'fetch($$$ARGS)' -l typescript

# Method call
sg run -p '$OBJ.addEventListener($$$ARGS)' -l typescript

# Console methods
sg run -p 'console.$METHOD($$$ARGS)' -l javascript

# React hook
sg run -p 'useState($$$ARGS)' -l typescript
sg run -p 'useEffect($$$ARGS)' -l typescript
```

### JSX / React Components

```bash
# Component usage
sg run -p '<$Component $$$PROPS />' -l typescript

# Component with children
sg run -p '<$Component $$$PROPS>$$$CHILDREN</$Component>' -l typescript

# Specific component
sg run -p '<Button $$$PROPS>$$$CHILDREN</Button>' -l typescript
```

### Imports / Exports

```bash
# Named import
sg run -p 'import { $$$NAMES } from "$MOD"' -l typescript

# Default import
sg run -p 'import $NAME from "$MOD"' -l typescript

# Dynamic import
sg run -p 'import($PATH)' -l typescript

# Named export
sg run -p 'export const $NAME = $VAL' -l typescript

# Export function
sg run -p 'export function $NAME($$$P) { $$$B }' -l typescript
```

### Class Methods

```bash
# Method definition
sg run -p 'class $C { $$$B1 $METHOD($$$P) { $$$B2 } $$$B3 }' -l typescript

# Async method
sg run -p 'async $METHOD($$$P) { $$$BODY }' -l typescript

# Constructor
sg run -p 'constructor($$$PARAMS) { $$$BODY }' -l typescript
```

### Arrow Functions

```bash
# Arrow with body
sg run -p 'const $NAME = ($$$P) => { $$$BODY }' -l typescript

# Arrow with expression
sg run -p 'const $NAME = ($$$P) => $EXPR' -l typescript

# Callback arrow
sg run -p '($$$P) => $EXPR' -l typescript
```

---

## Go

### Function Signatures

```bash
# Function definition
sg run -p 'func $NAME($$$PARAMS) $$$RETURN { $$$BODY }' -l go

# Method (with receiver)
sg run -p 'func ($RECV $TYPE) $NAME($$$PARAMS) $$$RETURN { $$$BODY }' -l go

# Function returning error
sg run -p 'func $NAME($$$P) ($$$R, error) { $$$B }' -l go
```

### Struct Definitions

```bash
# Struct
sg run -p 'type $NAME struct { $$$FIELDS }' -l go

# Interface
sg run -p 'type $NAME interface { $$$METHODS }' -l go
```

### Goroutines and Concurrency

```bash
# Goroutine launch
sg run -p 'go $FUNC($$$ARGS)' -l go

# Defer statement
sg run -p 'defer $FUNC($$$ARGS)' -l go

# Channel send
sg run -p '$CH <- $VAL' -l go

# Channel receive
sg run -p '$VAR := <-$CH' -l go

# Select statement
sg run -p 'select { $$$CASES }' -l go
```

### Error Handling

```bash
# Error check pattern
sg run -p 'if err != nil { $$$BODY }' -l go

# Error wrapping
sg run -p 'fmt.Errorf($$$ARGS)' -l go
```

---

## Rust

### Function and Impl Blocks

```bash
# Function
sg run -p 'fn $NAME($$$PARAMS) -> $RET { $$$BODY }' -l rust

# Impl block
sg run -p 'impl $TYPE { $$$METHODS }' -l rust

# Trait implementation
sg run -p 'impl $TRAIT for $TYPE { $$$METHODS }' -l rust

# Public function
sg run -p 'pub fn $NAME($$$PARAMS) -> $RET { $$$BODY }' -l rust
```

### Match Arms

```bash
# Match statement
sg run -p 'match $EXPR { $$$ARMS }' -l rust

# Specific match arm (harder — ast-grep matches full expressions better)
```

### Macro Invocations

```bash
# println! macro
sg run -p 'println!($$$ARGS)' -l rust

# vec! macro
sg run -p 'vec![$$$ITEMS]' -l rust

# Any macro
sg run -p '$MACRO!($$$ARGS)' -l rust
```

### Error Handling

```bash
# unwrap calls (potential panics)
sg run -p '$EXPR.unwrap()' -l rust

# expect calls
sg run -p '$EXPR.expect($MSG)' -l rust

# ? operator (harder to match as standalone — use in function context)
```

### Async Patterns

```bash
# Async function
sg run -p 'async fn $NAME($$$P) -> $RET { $$$B }' -l rust

# .await
sg run -p '$EXPR.await' -l rust

# tokio::spawn
sg run -p 'tokio::spawn($$$ARGS)' -l rust
```

---

## Tips

- **Pattern doesn't match?** Use `tree-sitter parse file.ext` to see the actual syntax tree structure. ast-grep patterns must match the tree structure, which sometimes differs from how code appears visually.
- **Too many results?** Add more context to the pattern (surrounding code) or search within a specific directory.
- **Cross-language search?** Run separate `sg` commands per language — ast-grep requires a language specification.
- **Combine with Grep:** Use ast-grep to find structural patterns, then Grep to filter results by specific strings within matches.
