# Pydantic v2 Models -- Deep Dive

## 1. Computed Fields

Computed fields are derived from other model fields at serialization time. They appear in JSON output but are not accepted in input:

```python
from pydantic import BaseModel, computed_field

class Product(BaseModel):
    price: float
    tax_rate: float = 0.08

    @computed_field
    @property
    def total(self) -> float:
        return self.price * (1 + self.tax_rate)
```

```python
p = Product(price=100)
p.model_dump()
# {"price": 100.0, "tax_rate": 0.08, "total": 108.0}
```

Computed fields participate in JSON Schema generation, appearing in OpenAPI docs with their return type.

---

## 2. Model Inheritance

### Shared Base Models

Factor common fields into a base class. Input and output models inherit from the base and add their specific fields:

```python
class UserBase(BaseModel):
    email: str
    display_name: str | None = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: str | None = None
    display_name: str | None = None

class UserResponse(UserBase):
    model_config = {"from_attributes": True}

    id: int
    created_at: datetime
```

### Partial Models for PATCH

Create update models where all fields are optional. This supports partial updates without requiring the client to send the full object:

```python
from pydantic import BaseModel

class ItemBase(BaseModel):
    name: str
    description: str
    price: float

class ItemUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: float | None = None
```

Use `model.model_dump(exclude_unset=True)` to get only the fields the client explicitly provided:

```python
@router.patch("/{item_id}")
async def update_item(item_id: int, updates: ItemUpdate, db: DB):
    update_data = updates.model_dump(exclude_unset=True)
    await db.execute(
        update(Item).where(Item.id == item_id).values(**update_data)
    )
```

---

## 3. Custom JSON Encoders

Pydantic v2 uses `model_serializer` and `field_serializer` for custom encoding:

```python
from pydantic import BaseModel, field_serializer
from datetime import datetime

class Event(BaseModel):
    name: str
    timestamp: datetime

    @field_serializer("timestamp")
    def serialize_timestamp(self, dt: datetime, _info) -> str:
        return dt.isoformat()
```

For model-wide custom serialization:

```python
from pydantic import model_serializer

class Point(BaseModel):
    x: float
    y: float

    @model_serializer
    def serialize_model(self) -> dict:
        return {"coordinates": [self.x, self.y]}
```

---

## 4. Discriminated Unions

Use a literal discriminator field to enable efficient parsing of polymorphic types. Pydantic checks the discriminator value first, then validates against the matching model:

```python
from typing import Literal, Union, Annotated
from pydantic import BaseModel, Field

class TextBlock(BaseModel):
    type: Literal["text"] = "text"
    content: str

class ImageBlock(BaseModel):
    type: Literal["image"] = "image"
    url: str
    alt_text: str | None = None

class CodeBlock(BaseModel):
    type: Literal["code"] = "code"
    language: str
    source: str

Block = Annotated[
    Union[TextBlock, ImageBlock, CodeBlock],
    Field(discriminator="type"),
]

class Document(BaseModel):
    title: str
    blocks: list[Block]
```

Benefits of discriminated unions:
- Validation errors reference the specific model variant, not a generic union failure.
- Performance is constant-time (dict lookup by discriminator), not linear (try each variant).
- OpenAPI schema uses `oneOf` with `discriminator`, enabling typed client generation.

---

## 5. Validators and Constraints

### Field-Level Validators

```python
from pydantic import field_validator

class Registration(BaseModel):
    username: str
    age: int

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.isalnum():
            raise ValueError("must be alphanumeric")
        return v

    @field_validator("age")
    @classmethod
    def age_range(cls, v: int) -> int:
        if v < 13 or v > 120:
            raise ValueError("must be between 13 and 120")
        return v
```

### Model-Level Validators

Validate relationships between fields using `model_validator`:

```python
from pydantic import model_validator

class DateRange(BaseModel):
    start: datetime
    end: datetime

    @model_validator(mode="after")
    def validate_range(self) -> "DateRange":
        if self.end <= self.start:
            raise ValueError("end must be after start")
        return self
```

### Field Constraints

```python
from pydantic import Field

class Product(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(gt=0, description="Price in USD")
    sku: str = Field(pattern=r"^[A-Z]{2}-\d{4}$")
    tags: list[str] = Field(default_factory=list, max_length=10)
```

---

## 6. BaseSettings for Configuration

`BaseSettings` reads values from environment variables, `.env` files, and constructor arguments with a defined priority:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_prefix": "APP_"}

    database_url: str
    redis_url: str = "redis://localhost:6379"
    debug: bool = False
    allowed_origins: list[str] = ["http://localhost:3000"]
```

```python
# Usage in FastAPI
from functools import lru_cache

@lru_cache
def get_settings() -> Settings:
    return Settings()

@app.get("/info")
async def info(settings: Settings = Depends(get_settings)):
    return {"debug": settings.debug}
```

Priority order (highest to lowest): constructor arguments, environment variables, `.env` file, field defaults. Use `lru_cache` to parse settings once rather than on every request.
