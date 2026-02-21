---
name: refactoring-patterns
description: >-
  This skill should be used when the user asks to "refactor this code",
  "clean up this function", "extract a method", "reduce code duplication",
  "fix code smells", "simplify this class", "break up this large function",
  "apply design patterns", "remove dead code", "improve code structure",
  or discusses code smells, refactoring techniques, extract function,
  inline variable, feature envy, god class, or behavior-preserving
  transformations.
version: 0.1.0
---

# Refactoring Patterns

## Mental Model

Refactoring is **behavior-preserving transformation** -- you change the structure of code without changing what it does. The key word is *preserving*. Every refactoring step must leave the system in a working state. If you can't verify the behavior hasn't changed, you're not refactoring -- you're rewriting.

Tests are the safety net. Before touching any code, confirm that tests pass. After every transformation, run tests again. If there are no tests, write characterization tests first -- tests that capture the current behavior, even if that behavior is buggy. Fix bugs separately from refactoring; mixing the two makes both harder to verify.

The refactoring cycle is:
1. **Identify** a code smell (a surface indicator of a deeper structural problem)
2. **Choose** the appropriate transformation
3. **Apply** the transformation in the smallest possible step
4. **Verify** tests still pass
5. **Commit** before moving to the next smell

Small steps are critical. A refactoring that touches 15 files in one commit is a rewrite wearing a disguise. Each commit should be independently revertable.

---

## Code Smell Catalog

Code smells are heuristics, not rules. A method with 30 lines might be perfectly clear; a method with 8 lines might hide a design problem. Use these as starting points for investigation, not automatic triggers for refactoring.

### Long Method
**Detection:** Method exceeds ~20 lines, or you need to scroll to see the whole thing, or you find yourself writing comments to separate logical sections.
**Root cause:** The method has accumulated responsibilities over time.
**Fix:** Extract Function -- pull each commented section or logical block into a named function.

### Feature Envy
**Detection:** A method accesses data from another object more than its own. Count the dots -- `order.customer.address.city` suggests the method belongs elsewhere.
**Root cause:** Behavior is in the wrong class.
**Fix:** Move Method to the class whose data it uses most.

### Data Clump
**Detection:** The same group of parameters appears together in multiple function signatures (`x, y, z` or `host, port, protocol`).
**Root cause:** A missing abstraction -- these values form a concept that deserves its own type.
**Fix:** Introduce Parameter Object or extract a dataclass/type.

### Primitive Obsession
**Detection:** Using `str` for email, `int` for currency, `dict` for structured data. Business rules are scattered across validation checks.
**Root cause:** Domain concepts are represented as raw primitives instead of types.
**Fix:** Replace Primitive with Value Object -- create a type that encapsulates the value and its constraints.

### God Class
**Detection:** A class with 500+ lines, 20+ methods, or a name like `Manager`, `Handler`, `Processor`, `Utils`. It knows about everything and everything depends on it.
**Root cause:** Single Responsibility Principle violation accumulated over time.
**Fix:** Extract Class -- identify clusters of related fields and methods, pull each cluster into its own class.

### Shotgun Surgery
**Detection:** A single conceptual change requires editing 5+ files in the same way. Adding a new status enum value means updating the model, serializer, validator, template, and two tests.
**Root cause:** A concept is spread across too many places without a central abstraction.
**Fix:** Move Method / Move Field to consolidate the scattered logic, or introduce a registry/dispatch pattern.

### Divergent Change
**Detection:** One class changes for multiple unrelated reasons -- the `User` class changes when auth logic changes AND when profile rendering changes.
**Root cause:** The class has multiple responsibilities that change at different rates.
**Fix:** Extract Class to separate the responsibilities.

### Message Chain
**Detection:** A chain of calls like `a.getB().getC().getD().doSomething()`. Each link in the chain is a coupling point.
**Root cause:** Client code knows too much about the object graph.
**Fix:** Hide Delegate -- provide a method on the first object that reaches through the chain internally.

> **Deep dive:** See `references/smell-catalog.md` for the full catalog with before/after code examples for each smell.

---

## Safe Refactoring Steps

Each transformation below is mechanical and behavior-preserving when applied correctly. Follow the steps exactly.

### Extract Function
**When:** A block of code inside a method can be grouped under a descriptive name.

```python
from dataclasses import dataclass

@dataclass
class Order:
    items: list
    total: float
    customer: "Customer"

# Before
def process_order(order: Order) -> None:
    # validate
    if not order.items:
        raise ValueError("Empty order")
    if order.total < 0:
        raise ValueError("Negative total")
    # apply discount
    if order.customer.is_premium:
        order.total *= 0.9

# After
def process_order(order: Order) -> None:
    validate_order(order)
    apply_premium_discount(order)

def validate_order(order: Order) -> None:
    if not order.items:
        raise ValueError("Empty order")
    if order.total < 0:
        raise ValueError("Negative total")

def apply_premium_discount(order: Order) -> None:
    if order.customer.is_premium:
        order.total *= 0.9
```

### Inline Variable
**When:** A temporary variable adds no clarity and is used only once.

```typescript
// Before
const basePrice = order.quantity * order.itemPrice;
return basePrice;

// After
return order.quantity * order.itemPrice;
```

### Replace Conditional with Polymorphism
**When:** A switch or if-chain selects behavior based on a type field.

```python
import math
from dataclasses import dataclass

# Before
def calculate_area(shape):
    if shape.type == "circle":
        return math.pi * shape.radius ** 2
    elif shape.type == "rectangle":
        return shape.width * shape.height

# After
@dataclass
class Circle:
    radius: float

    def area(self) -> float:
        return math.pi * self.radius ** 2

@dataclass
class Rectangle:
    width: float
    height: float

    def area(self) -> float:
        return self.width * self.height
```

### Introduce Parameter Object
**When:** Multiple parameters travel together across function boundaries.

```python
from dataclasses import dataclass

# Before
def search(query: str, page: int, per_page: int, sort_by: str, order: str): ...
def count(query: str, sort_by: str, order: str): ...

# After
@dataclass
class SearchParams:
    query: str
    page: int = 1
    per_page: int = 20
    sort_by: str = "relevance"
    order: str = "desc"

def search(params: SearchParams): ...
def count(params: SearchParams): ...
```

### Pull Up Method
**When:** A method in a subclass is identical across all subclasses.

```python
# Before: duplicated method in both subclasses
class SalariedEmployee(Employee):
    def annual_cost(self) -> float:
        return self.salary * 1.3  # 30% benefits overhead

class HourlyEmployee(Employee):
    def annual_cost(self) -> float:
        return self.salary * 1.3  # identical logic

# After: pulled up to parent
class Employee:
    def annual_cost(self) -> float:
        return self.salary * 1.3
```

### Push Down Method
**When:** A method in the parent is only relevant to one subclass.

```python
# Before: method in parent used by only one subclass
class Employee:
    def commission_rate(self) -> float:  # only SalesRep uses this
        return 0.05

# After: pushed down to the relevant subclass
class SalesRep(Employee):
    def commission_rate(self) -> float:
        return 0.05
```

> **Deep dive:** See `references/safe-transformations.md` for step-by-step transformation recipes with pre-conditions, mechanical steps, and post-conditions.

---

## Language-Specific Patterns

### Python

**Dataclasses over raw dicts:**
```python
from dataclasses import dataclass

# Before: dict with implicit schema
user = {"name": "Alice", "email": "alice@example.com", "role": "admin"}

# After: explicit, typed, with defaults
@dataclass
class User:
    name: str
    email: str
    role: str = "viewer"
```

**Comprehensions over manual loops:**
```python
# Before
result = []
for item in items:
    if item.is_active():
        result.append(item.name)

# After
result = [item.name for item in items if item.is_active()]
```

**Context managers over try/finally:**
```python
# Before
f = open("data.txt")
try:
    data = f.read()
finally:
    f.close()

# After
with open("data.txt") as f:
    data = f.read()
```

### TypeScript

**Type narrowing over type assertions:**
```typescript
// Before: unsafe assertion
const user = data as User;

// After: runtime narrowing
function isUser(data: unknown): data is User {
    return typeof data === "object" && data !== null && "email" in data;
}
if (isUser(data)) {
    console.log(data.email); // safely narrowed
}
```

**Discriminated unions over type fields:**
```typescript
// Before: stringly-typed
interface Shape { type: string; radius?: number; width?: number; height?: number; }

// After: discriminated union
type Shape =
    | { kind: "circle"; radius: number }
    | { kind: "rectangle"; width: number; height: number };
```

---

## Verification Protocol

Every refactoring session follows this protocol:

1. **Run all tests** before starting. If tests fail, fix them first -- don't refactor broken code.
2. **Make one transformation** at a time. Extract one function, rename one variable, move one method.
3. **Run tests** after every transformation. If tests fail, revert immediately -- don't debug a failed refactoring.
4. **Commit** each passing transformation. Atomic commits make bisecting easy if something breaks later.
5. **Review the diff** before pushing. Does each change preserve behavior? Are there unintended side effects?

```bash
# The refactoring loop
git stash        # save any unrelated work
pytest           # green? proceed. red? fix first.

# ... make ONE transformation ...

pytest           # green? commit. red? git checkout -- .
git add -p       # stage only the refactoring
git commit -m "refactor: extract validate_order from process_order"
```

---

## Ambiguity Policy

These defaults apply when the user does not specify a preference. State the assumption when making a choice:

- **Scope:** Default to the smallest transformation that addresses the identified smell. Do not chain multiple refactorings without testing between each step.
- **Test requirement:** If no tests exist, write characterization tests before refactoring. Do not refactor untested code.
- **Naming:** When extracting a function, name it after what it does, not how it does it. Prefer verbs (`validate_order`) over nouns (`order_validation`).
- **Depth:** Default to one level of extraction. If the extracted function itself has smells, address them in a separate commit.
- **Language idioms:** Prefer language-native patterns (Python dataclasses over hand-rolled `__init__`, TypeScript discriminated unions over type assertions).
- **Commit granularity:** One refactoring transformation per commit. Multiple files in one commit is fine if they're part of the same transformation.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/smell-catalog.md` | Full catalog of code smells with detection heuristics, before/after code examples, and recommended transformations |
| `references/safe-transformations.md` | Step-by-step transformation recipes with pre-conditions, mechanical steps, post-conditions, and rollback instructions |
