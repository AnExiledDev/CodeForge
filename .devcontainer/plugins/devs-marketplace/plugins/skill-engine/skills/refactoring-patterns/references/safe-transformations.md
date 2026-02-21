# Safe Transformation Recipes

Step-by-step recipes for behavior-preserving refactorings. Each recipe has pre-conditions, mechanical steps, and post-conditions.

## Contents

- [Extract Function](#extract-function)
- [Inline Variable](#inline-variable)
- [Replace Conditional with Polymorphism](#replace-conditional-with-polymorphism)
- [Introduce Parameter Object](#introduce-parameter-object)
- [Move Method](#move-method)
- [Pull Up Method](#pull-up-method)
- [Push Down Method](#push-down-method)
- [Rollback Protocol](#rollback-protocol)

---

## Extract Function

### Pre-conditions
- [ ] Tests pass before starting
- [ ] The code block to extract has clear inputs and outputs
- [ ] The block does not modify local variables used later in the parent function (or you handle the return)

### Steps

1. **Identify** the block of code to extract. Note all variables it reads (inputs) and all variables it modifies (outputs).
2. **Create** a new function with a descriptive name. Use the inputs as parameters.
3. **Copy** the code block into the new function.
4. **Return** any outputs that the parent function needs.
5. **Replace** the original block with a call to the new function.
6. **Run tests.**

```python
# Step 1: Identify inputs (items, tax_rate) and outputs (total)
def process(items, tax_rate):
    # --- begin extract ---
    subtotal = sum(i.price for i in items)
    total = subtotal * (1 + tax_rate)
    # --- end extract ---
    save(total)

# Steps 2-5: Extract
def calculate_total(items, tax_rate):
    subtotal = sum(i.price for i in items)
    return subtotal * (1 + tax_rate)

def process(items, tax_rate):
    total = calculate_total(items, tax_rate)
    save(total)
```

### Post-conditions
- [ ] Tests still pass
- [ ] The new function has no side effects that differ from the original block
- [ ] The parent function produces identical results

---

## Inline Variable

### Pre-conditions
- [ ] The variable is assigned once and used once
- [ ] The variable name does not add meaningful clarity over the expression itself
- [ ] The expression has no side effects (calling it once vs. zero times must be equivalent)

### Steps

1. **Verify** the variable is used exactly once after assignment.
2. **Replace** the variable reference with the expression.
3. **Remove** the variable assignment.
4. **Run tests.**

```typescript
// Before
const isEligible = user.age >= 18 && user.hasVerifiedEmail;
if (isEligible) { ... }

// After (only if isEligible doesn't add clarity)
if (user.age >= 18 && user.hasVerifiedEmail) { ... }
```

### Post-conditions
- [ ] Tests still pass
- [ ] No change in behavior (expression was pure)

---

## Replace Conditional with Polymorphism

### Pre-conditions
- [ ] A switch/if-chain selects behavior based on a type indicator
- [ ] The type indicator has a stable set of values (not unbounded user input)
- [ ] Each branch has enough logic to justify its own method/class

### Steps

1. **Create** a base class or interface with the polymorphic method.
2. **Create** a subclass for each branch of the conditional.
3. **Move** the branch logic into the corresponding subclass method.
4. **Replace** the conditional with a method call on the object.
5. **Update** object creation to instantiate the correct subclass.
6. **Run tests.**

```python
# Before
def calculate_pay(employee):
    if employee.type == "hourly":
        return employee.hours * employee.rate
    elif employee.type == "salaried":
        return employee.annual_salary / 26
    elif employee.type == "contractor":
        return employee.hours * employee.rate * 1.2

# After
class HourlyEmployee:
    def calculate_pay(self):
        return self.hours * self.rate

class SalariedEmployee:
    def calculate_pay(self):
        return self.annual_salary / 26

class Contractor:
    def calculate_pay(self):
        return self.hours * self.rate * 1.2
```

### Post-conditions
- [ ] Tests still pass
- [ ] Adding a new type requires adding a new class, not modifying existing code
- [ ] The conditional is completely removed

---

## Introduce Parameter Object

### Pre-conditions
- [ ] 3+ parameters appear together in multiple function signatures
- [ ] The parameters have a logical relationship (they represent a concept)

### Steps

1. **Create** a class/dataclass/type with the grouped parameters as fields.
2. **Add** the new type as a parameter to ONE function.
3. **Update** callers of that function to construct the object.
4. **Run tests.**
5. **Repeat** for the remaining functions, one at a time.
6. **Move** any logic that operates on the grouped parameters into the new class.

```python
from dataclasses import dataclass
from datetime import datetime

# Step 1: Create the type
@dataclass
class DateRange:
    start: datetime
    end: datetime

    def contains(self, dt: datetime) -> bool:
        return self.start <= dt <= self.end

    def days(self) -> int:
        return (self.end - self.start).days

# Steps 2-5: Update functions one at a time
def query_logs(date_range: DateRange, level: str) -> list[dict]: ...
def generate_report(date_range: DateRange, format: str) -> str: ...
```

### Post-conditions
- [ ] Tests still pass
- [ ] Each function that previously took the scattered parameters now takes the object
- [ ] Behavior that belongs to the grouped parameters has migrated into the new class

---

## Move Method

### Pre-conditions
- [ ] A method accesses more data from another class than its own (Feature Envy)
- [ ] Moving the method would reduce coupling between the two classes

### Steps

1. **Copy** the method to the target class.
2. **Adjust** the method to use `self` for the target class's data.
3. **Add** parameters for any data it still needs from the source class.
4. **Update** callers to call the method on the target object.
5. **Remove** the method from the source class (or delegate to the target).
6. **Run tests.**

### Post-conditions
- [ ] Tests still pass
- [ ] The method no longer envies another class's data

---

## Pull Up Method

### Pre-conditions
- [ ] Two or more subclasses have identical (or near-identical) methods
- [ ] The method uses only fields/methods available in the parent class

### Steps

1. **Verify** the methods are semantically identical (not just textually similar).
2. **Ensure** any referenced fields exist in the parent class (move them up if needed).
3. **Copy** the method to the parent class.
4. **Remove** the method from all subclasses.
5. **Run tests.**

### Post-conditions
- [ ] Tests still pass
- [ ] No duplication of the method across subclasses

---

## Push Down Method

### Pre-conditions
- [ ] A method in the parent class is only relevant to one subclass
- [ ] Other subclasses don't call or override the method

### Steps

1. **Copy** the method to the relevant subclass.
2. **Remove** the method from the parent class.
3. **Run tests.** If other subclasses call the method, compilation/runtime will fail -- that's a signal this transformation is wrong.

### Post-conditions
- [ ] Tests still pass
- [ ] The parent class is simpler with one fewer responsibility

---

## Rollback Protocol

If tests fail after any transformation:

1. **Do not debug.** The transformation was incorrect or incomplete.
2. **Revert immediately:** `git checkout -- .` (if uncommitted) or `git revert HEAD` (if committed).
3. **Analyze** why it failed: missing parameter, side effect, implicit dependency.
4. **Retry** with a smaller transformation or different approach.

The cost of reverting is zero. The cost of debugging a broken refactoring compounds with every additional change.
