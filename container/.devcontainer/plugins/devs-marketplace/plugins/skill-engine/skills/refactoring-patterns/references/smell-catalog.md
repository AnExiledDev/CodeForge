# Code Smell Catalog

Complete catalog of code smells with detection heuristics and before/after examples.

## Contents

- [Long Method](#long-method)
- [Feature Envy](#feature-envy)
- [Data Clump](#data-clump)
- [Primitive Obsession](#primitive-obsession)
- [God Class](#god-class)
- [Shotgun Surgery](#shotgun-surgery)
- [Divergent Change and Message Chain](#divergent-change-and-message-chain)

---

## Long Method

**Detection heuristics:**
- Method body exceeds ~20 lines
- You need to scroll to see the entire function
- Comments separate logical sections within the method
- Multiple levels of indentation (3+ nesting levels)

### Before

```python
def process_order(order, db, mailer):
    # Validate order
    if not order.items:
        raise ValueError("Order has no items")
    if order.total <= 0:
        raise ValueError("Order total must be positive")
    for item in order.items:
        stock = db.get_stock(item.product_id)
        if stock < item.quantity:
            raise ValueError(f"Insufficient stock for {item.product_id}")

    # Calculate totals
    subtotal = sum(item.price * item.quantity for item in order.items)
    tax = subtotal * 0.08
    if order.customer.is_tax_exempt:
        tax = 0
    shipping = 5.99 if subtotal < 50 else 0
    total = subtotal + tax + shipping

    # Save to database
    order.subtotal = subtotal
    order.tax = tax
    order.shipping = shipping
    order.total = total
    order.status = "confirmed"
    db.save_order(order)

    # Send confirmation
    subject = f"Order #{order.id} Confirmed"
    body = f"Your order total is ${total:.2f}"
    mailer.send(order.customer.email, subject, body)

    return order
```

### After

```python
def process_order(order, db, mailer):
    validate_order(order, db)
    totals = calculate_totals(order)
    save_order(order, totals, db)
    send_confirmation(order, totals, mailer)
    return order

def validate_order(order, db):
    if not order.items:
        raise ValueError("Order has no items")
    if order.total <= 0:
        raise ValueError("Order total must be positive")
    for item in order.items:
        stock = db.get_stock(item.product_id)
        if stock < item.quantity:
            raise ValueError(f"Insufficient stock for {item.product_id}")

def calculate_totals(order):
    subtotal = sum(item.price * item.quantity for item in order.items)
    tax = 0 if order.customer.is_tax_exempt else subtotal * 0.08
    shipping = 5.99 if subtotal < 50 else 0
    return {"subtotal": subtotal, "tax": tax, "shipping": shipping, "total": subtotal + tax + shipping}

def save_order(order, totals, db):
    order.subtotal = totals["subtotal"]
    order.tax = totals["tax"]
    order.shipping = totals["shipping"]
    order.total = totals["total"]
    order.status = "confirmed"
    db.save_order(order)

def send_confirmation(order, totals, mailer):
    subject = f"Order #{order.id} Confirmed"
    body = f"Your order total is ${totals['total']:.2f}"
    mailer.send(order.customer.email, subject, body)
```

---

## Feature Envy

**Detection heuristics:**
- A method accesses more fields/methods from another object than from its own
- Multiple chained attribute accesses (`obj.a.b.c`)
- The method could be moved to the other class and would need fewer parameters

### Before

```python
class Order:
    def calculate_shipping(self):
        # Envies Customer's data
        if self.customer.address.country == "US":
            if self.customer.address.state in ("AK", "HI"):
                return self.total * 0.15
            return self.total * 0.05
        elif self.customer.address.country == "CA":
            return self.total * 0.10
        return self.total * 0.20
```

### After

```python
class Address:
    def shipping_rate(self):
        if self.country == "US":
            if self.state in ("AK", "HI"):
                return 0.15
            return 0.05
        elif self.country == "CA":
            return 0.10
        return 0.20

class Order:
    def calculate_shipping(self):
        return self.total * self.customer.address.shipping_rate()
```

---

## Data Clump

**Detection heuristics:**
- The same 3+ parameters appear together in multiple function signatures
- You find yourself passing the same group of variables through several functions
- Parameters have a logical relationship (e.g., `start_date, end_date` or `host, port, protocol`)

### Before

```python
def connect(host: str, port: int, protocol: str, timeout: int): ...
def health_check(host: str, port: int, protocol: str): ...
def send_request(host: str, port: int, protocol: str, payload: bytes): ...
```

### After

```python
from dataclasses import dataclass

@dataclass
class ServerConfig:
    host: str
    port: int
    protocol: str = "https"
    timeout: int = 30

def connect(config: ServerConfig): ...
def health_check(config: ServerConfig): ...
def send_request(config: ServerConfig, payload: bytes): ...
```

---

## Primitive Obsession

**Detection heuristics:**
- Business validation logic scattered across multiple call sites
- `str` used for structured values (emails, URLs, phone numbers)
- `int` or `float` used for money, percentages, or quantities with constraints
- `dict` used where a typed structure is needed

### Before

```python
def create_user(email: str, age: int):
    if "@" not in email or "." not in email.split("@")[1]:
        raise ValueError("Invalid email")
    if age < 0 or age > 150:
        raise ValueError("Invalid age")
    # ... same validation repeated in update_user, send_invite, etc.
```

### After

```python
class Email:
    def __init__(self, value: str):
        if "@" not in value or "." not in value.split("@")[1]:
            raise ValueError(f"Invalid email: {value}")
        self.value = value

    def __str__(self):
        return self.value

class Age:
    def __init__(self, value: int):
        if value < 0 or value > 150:
            raise ValueError(f"Invalid age: {value}")
        self.value = value

def create_user(email: Email, age: Age):
    # Validation is guaranteed by construction
    ...
```

---

## God Class

**Detection heuristics:**
- Class has 500+ lines or 20+ methods
- Class name is vague: `Manager`, `Handler`, `Processor`, `Utils`, `Helper`
- Class imports from many unrelated modules
- Methods cluster into groups that don't share instance state

### Before

```python
class UserManager:
    def create_user(self, ...): ...
    def update_user(self, ...): ...
    def delete_user(self, ...): ...
    def authenticate(self, ...): ...
    def reset_password(self, ...): ...
    def send_welcome_email(self, ...): ...
    def send_password_reset_email(self, ...): ...
    def generate_report(self, ...): ...
    def export_to_csv(self, ...): ...
```

### After

```python
class UserRepository:
    def create(self, ...): ...
    def update(self, ...): ...
    def delete(self, ...): ...

class AuthService:
    def authenticate(self, ...): ...
    def reset_password(self, ...): ...

class UserNotifier:
    def send_welcome_email(self, ...): ...
    def send_password_reset_email(self, ...): ...

class UserReporter:
    def generate_report(self, ...): ...
    def export_to_csv(self, ...): ...
```

---

## Shotgun Surgery

**Detection heuristics:**
- Adding a new enum value requires changes in 5+ files
- A conceptual change (e.g., "add a new user role") touches model, serializer, validator, template, and tests in a scattered pattern
- Developers frequently forget to update one of the locations

### Before

```python
# models.py
STATUSES = ["draft", "published", "archived"]

# serializer.py
if status not in ["draft", "published", "archived"]:
    raise ValidationError("Invalid status")

# template.html
# {% if article.status == "draft" or article.status == "published" or ... %}

# admin.py
list_filter = ["draft", "published", "archived"]
```

### After

```python
import enum

# models.py — single source of truth
class ArticleStatus(enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"

# All other files reference ArticleStatus
# serializer.py
if status not in ArticleStatus.__members__: ...

# admin.py
list_filter = [s.value for s in ArticleStatus]
```

---

## Divergent Change and Message Chain

**Divergent Change:** One class changes for unrelated reasons. Split responsibilities.

**Message Chain:** Long chains like `a.getB().getC().getD()`. Introduce delegate methods:

```python
# Before
city = order.customer.address.city

# After — Order provides the method
class Order:
    def shipping_city(self):
        return self.customer.address.city
```

Each of these smells is a signal, not a verdict. Investigate the context before applying transformations mechanically.
