# Python Migration Patterns

## Python Version Upgrades (3.8 → 3.12)

### Typing Modernization

| Old Pattern (3.8) | New Pattern (3.10+) | Search Pattern |
|-------------------|---------------------|----------------|
| `Optional[X]` | `X \| None` | `from typing import Optional` |
| `Union[X, Y]` | `X \| Y` | `from typing import Union` |
| `List[str]` | `list[str]` | `from typing import List` |
| `Dict[str, int]` | `dict[str, int]` | `from typing import Dict` |
| `Tuple[int, ...]` | `tuple[int, ...]` | `from typing import Tuple` |
| `Set[str]` | `set[str]` | `from typing import Set` |
| `FrozenSet[str]` | `frozenset[str]` | `from typing import FrozenSet` |
| `Type[X]` | `type[X]` | `from typing import Type` |

**Migration step**: Replace all `typing` imports of built-in generics with lowercase equivalents. Remove unused `typing` imports after replacement.

### Deprecated / Removed Modules

| Module | Removed In | Replacement |
|--------|-----------|-------------|
| `distutils` | 3.12 | `setuptools`, `shutil` |
| `imp` | 3.12 | `importlib` |
| `lib2to3` | 3.13 | `libcst` or manual |
| `aifc` | 3.13 | Third-party audio libraries |
| `cgi` | 3.13 | `urllib.parse`, `email.message` |
| `cgitb` | 3.13 | `traceback` |

### collections.abc Migration

```python
# Old (deprecated in 3.9, removed warning in 3.10+)
from collections import MutableMapping, Sequence, Iterable

# New
from collections.abc import MutableMapping, Sequence, Iterable
```

Search for: `from collections import` and check if any imported names are ABCs.

### asyncio Changes

| Old Pattern | New Pattern (3.10+) | Version |
|------------|---------------------|---------|
| `asyncio.get_event_loop()` | `asyncio.get_running_loop()` (in async context) | 3.10 |
| `@asyncio.coroutine` / `yield from` | `async def` / `await` | 3.8 (removed 3.11) |
| `loop.create_task()` | `asyncio.create_task()` | 3.7 |
| `asyncio.wait(tasks)` | `asyncio.wait(tasks)` (must pass set) | 3.11 |

---

## Pydantic v1 → v2

### Complete API Mapping

| Pydantic v1 | Pydantic v2 | Notes |
|-------------|-------------|-------|
| `@validator('field')` | `@field_validator('field')` | Import from `pydantic` |
| `@validator('field', pre=True)` | `@field_validator('field', mode='before')` | `mode='before'` replaces `pre=True` |
| `@validator('field', always=True)` | `@field_validator('field')` + `@model_validator` | `always` removed; use model validator for defaults |
| `@root_validator` | `@model_validator` | Import from `pydantic` |
| `@root_validator(pre=True)` | `@model_validator(mode='before')` | Mode parameter |
| `.dict()` | `.model_dump()` | Method renamed |
| `.json()` | `.model_dump_json()` | Method renamed |
| `.parse_obj(data)` | `.model_validate(data)` | Class method renamed |
| `.parse_raw(json_str)` | `.model_validate_json(json_str)` | Class method renamed |
| `.schema()` | `.model_json_schema()` | Class method renamed |
| `.construct()` | `.model_construct()` | Class method renamed |
| `.copy()` | `.model_copy()` | Method renamed |
| `class Config:` | `model_config = ConfigDict(...)` | Inline config dict |
| `Config.schema_extra` | `model_config = ConfigDict(json_schema_extra=...)` | Renamed field |
| `Config.orm_mode = True` | `model_config = ConfigDict(from_attributes=True)` | Renamed field |
| `Config.allow_population_by_field_name` | `model_config = ConfigDict(populate_by_name=True)` | Renamed field |
| `Field(regex=...)` | `Field(pattern=...)` | Parameter renamed |

### Migration Steps

1. Update `pydantic` version in manifest: `pydantic>=2.0`
2. Convert `class Config:` blocks to `model_config = ConfigDict(...)` — add `from pydantic import ConfigDict`
3. Convert `@validator` to `@field_validator` — update signatures (first arg is now `cls`, values accessed differently)
4. Convert `@root_validator` to `@model_validator` — update mode parameter
5. Replace `.dict()` → `.model_dump()`, `.json()` → `.model_dump_json()`
6. Replace `.parse_obj()` → `.model_validate()`, `.parse_raw()` → `.model_validate_json()`
7. Run `pytest` after each step

### Validator Signature Change

```python
# v1
@validator('name')
def validate_name(cls, v, values):
    return v.strip()

# v2
@field_validator('name')
@classmethod
def validate_name(cls, v: str, info: ValidationInfo) -> str:
    return v.strip()
```

Note: In v2, `info.data` replaces `values` for accessing other fields.

---

## Django Version Upgrades

### Common Breaking Changes by Version

| Version | Key Changes |
|---------|------------|
| 3.2 → 4.0 | `default_app_config` removed, `USE_L10N` default changed to True |
| 4.0 → 4.1 | Async view support expanded, `assertFormError` signature changed |
| 4.1 → 4.2 | `CSRF_TRUSTED_ORIGINS` requires scheme, psycopg3 support |
| 4.2 → 5.0 | `DEFAULT_AUTO_FIELD` required, `logout()` changed to POST-only |
| 5.0 → 5.1 | `LoginRequiredMiddleware` added, `HttpResponse.content` stricter |

### Migration Steps

1. Run `python -m django check --deploy` to identify deprecation warnings.
2. Read the release notes for each version between current and target.
3. Upgrade one minor version at a time (4.0→4.1→4.2, not 4.0→4.2).
4. Run `python manage.py migrate` and `python manage.py test` after each version bump.

---

## SQLAlchemy 1.x → 2.x

### Key Changes

| SQLAlchemy 1.x | SQLAlchemy 2.x | Notes |
|----------------|----------------|-------|
| `session.query(Model)` | `select(Model)` + `session.execute()` | New select() style |
| `query.filter()` | `select().where()` | Method renamed |
| `query.all()` | `session.execute(stmt).scalars().all()` | Execution separated from query building |
| `Column(Integer)` | `mapped_column(Integer)` | New declarative style |
| `relationship()` | `relationship()` | Mostly compatible |
| `engine.execute()` | Removed | Use `with engine.connect() as conn: conn.execute()` |

Run with `SQLALCHEMY_WARN_20=1` environment variable to get deprecation warnings for 1.x patterns before migrating.
