# Docstring Format Reference

Complete templates for inline documentation across languages. Detect the project's existing style before adding new docstrings.

---

## Python

### Google-Style (Recommended Default)

Detection pattern: `Grep: "Args:"` or `Grep: "Returns:"` in `.py` files.

```python
def process_payment(amount: float, currency: str, customer_id: str) -> PaymentResult:
    """Process a payment for the given customer.

    Validates the amount, charges the customer's default payment method,
    and records the transaction in the payment ledger.

    Args:
        amount: Payment amount in the smallest currency unit (e.g., cents).
            Must be positive.
        currency: ISO 4217 currency code (e.g., "usd", "eur").
        customer_id: The unique customer identifier from the auth system.

    Returns:
        PaymentResult with transaction ID, status, and timestamp.

    Raises:
        InvalidAmountError: If amount is negative or zero.
        CustomerNotFoundError: If customer_id doesn't match any customer.
        PaymentGatewayError: If the external payment provider is unreachable.

    Example:
        >>> result = process_payment(1500, "usd", "cust_abc123")
        >>> result.status
        'completed'
    """
```

### NumPy-Style

Detection pattern: `Grep: "Parameters\n----------"` (multiline) or `Grep: "----------"` in docstrings.

```python
def interpolate(x, y, method="linear"):
    """Interpolate data points using the specified method.

    Parameters
    ----------
    x : array_like
        The x-coordinates of the data points.
    y : array_like
        The y-coordinates of the data points. Must have the same length as `x`.
    method : str, optional
        Interpolation method. One of 'linear', 'cubic', 'nearest'.
        Default is 'linear'.

    Returns
    -------
    callable
        An interpolation function that accepts x values and returns
        interpolated y values.

    Raises
    ------
    ValueError
        If `x` and `y` have different lengths.

    Examples
    --------
    >>> f = interpolate([0, 1, 2], [0, 1, 4], method='cubic')
    >>> f(1.5)
    2.25
    """
```

### Sphinx / reStructuredText

Detection pattern: `Grep: ":param "` or `Grep: ":type "` in `.py` files.

```python
def connect(host, port, timeout=30):
    """Connect to the remote server.

    Establishes a TCP connection with configurable timeout.

    :param host: Server hostname or IP address.
    :type host: str
    :param port: Server port number (1-65535).
    :type port: int
    :param timeout: Connection timeout in seconds. Defaults to 30.
    :type timeout: int
    :returns: Active connection handle.
    :rtype: Connection
    :raises ConnectionError: If the server is unreachable.
    :raises ValueError: If port is out of valid range.
    """
```

### Module and Class Docstrings

```python
"""Payment processing module.

Handles payment creation, validation, and gateway communication.
Supports Stripe and PayPal providers via the adapter pattern.

See `src/payments/adapters/` for provider implementations.
"""


class PaymentProcessor:
    """Orchestrates payment workflows across multiple providers.

    Manages provider selection, retry logic, and transaction recording.
    Uses the strategy pattern to delegate provider-specific logic.

    Attributes:
        default_provider: Name of the fallback payment provider.
        max_retries: Maximum retry attempts for failed transactions.
    """
```

---

## TypeScript / JavaScript

### JSDoc

Detection pattern: `Grep: "@param "` or `Grep: "@returns"` in `.ts` or `.js` files.

```typescript
/**
 * Process a payment for the given customer.
 *
 * Validates the amount, charges the customer's default payment method,
 * and records the transaction.
 *
 * @param amount - Payment amount in cents (must be positive)
 * @param currency - ISO 4217 currency code (e.g., "usd", "eur")
 * @param customerId - The unique customer identifier
 * @returns Payment result with transaction ID and status
 * @throws {InvalidAmountError} If amount is negative or zero
 * @throws {CustomerNotFoundError} If customerId doesn't match any customer
 *
 * @example
 * ```typescript
 * const result = await processPayment(1500, "usd", "cust_abc123");
 * console.log(result.status); // "completed"
 * ```
 */
async function processPayment(
  amount: number,
  currency: string,
  customerId: string
): Promise<PaymentResult> {
```

### TSDoc

TSDoc is a stricter subset of JSDoc used by TypeScript-focused projects.

Key differences from JSDoc:
- Uses `{@link ClassName}` for references (not `{@see}`)
- `@param name -` format (with dash separator)
- `@throws` without type braces (types are in TypeScript)

```typescript
/**
 * Fetches user data from the API.
 *
 * @param userId - The user's unique identifier
 * @param options - Request configuration
 * @returns The user object, or `undefined` if not found
 *
 * @remarks
 * This method caches results for 5 minutes. Use {@link invalidateCache}
 * to force a fresh fetch.
 */
```

### Module / File Headers

```typescript
/**
 * @module payments
 *
 * Payment processing module handling Stripe and PayPal integrations.
 * Entry point: {@link PaymentProcessor.process}
 */
```

---

## Go (godoc)

Detection pattern: Comments starting with the function/type name: `Grep: "^// [A-Z]"` before `func` or `type` declarations.

```go
// ProcessPayment charges the customer's default payment method.
// Amount is in the smallest currency unit (e.g., cents for USD).
// Currency must be a valid ISO 4217 code.
//
// Returns the transaction result or an error if the charge fails.
// Possible errors: ErrInvalidAmount, ErrCustomerNotFound, ErrGatewayUnavailable.
func ProcessPayment(amount int64, currency string, customerID string) (*PaymentResult, error) {
```

### Package Comments

```go
// Package payments provides payment processing across multiple providers.
//
// It supports Stripe and PayPal via pluggable adapters. Use NewProcessor
// to create a processor with the desired provider configuration.
//
// Example:
//
//	p := payments.NewProcessor(payments.WithStripe(apiKey))
//	result, err := p.Process(ctx, 1500, "usd", "cust_123")
package payments
```

### godoc Conventions

- First sentence starts with the name being documented: "ProcessPayment charges..."
- Use complete sentences with proper punctuation.
- Code examples use tab-indented blocks (no triple backticks).
- Document exported (capitalized) identifiers only.

---

## Rust (rustdoc)

Detection pattern: `Grep: "/// "` or `Grep: "//! "` in `.rs` files.

```rust
/// Process a payment for the given customer.
///
/// Validates the amount, charges the customer's default payment method,
/// and records the transaction in the payment ledger.
///
/// # Arguments
///
/// * `amount` - Payment amount in cents (must be positive)
/// * `currency` - ISO 4217 currency code (e.g., "usd", "eur")
/// * `customer_id` - The unique customer identifier
///
/// # Returns
///
/// A `PaymentResult` with transaction ID, status, and timestamp.
///
/// # Errors
///
/// Returns `PaymentError::InvalidAmount` if the amount is zero or negative.
/// Returns `PaymentError::CustomerNotFound` if the customer ID is invalid.
///
/// # Examples
///
/// ```
/// let result = process_payment(1500, "usd", "cust_abc123")?;
/// assert_eq!(result.status, PaymentStatus::Completed);
/// ```
///
/// # Panics
///
/// Panics if the payment gateway client is not initialized. Call
/// `init_gateway()` before using this function.
pub fn process_payment(amount: u64, currency: &str, customer_id: &str) -> Result<PaymentResult, PaymentError> {
```

### Module Documentation

```rust
//! Payment processing module.
//!
//! Handles payment creation, validation, and gateway communication.
//! Supports Stripe and PayPal providers via the adapter pattern.
//!
//! # Overview
//!
//! Use [`PaymentProcessor::new`] to create a processor, then call
//! [`PaymentProcessor::process`] to execute a payment.
```

### Sections Convention

| Section | When to Use |
|---------|------------|
| `# Arguments` | All public functions with parameters |
| `# Returns` | Functions that return non-unit types |
| `# Errors` | Functions that return `Result` |
| `# Panics` | Functions that can panic |
| `# Safety` | Unsafe functions — document invariants |
| `# Examples` | Always for public API |
