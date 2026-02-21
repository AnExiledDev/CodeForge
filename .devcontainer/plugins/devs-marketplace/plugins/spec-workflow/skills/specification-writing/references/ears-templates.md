# EARS Requirement Templates

Templates and filled examples for each EARS (Easy Approach to Requirements Syntax) pattern type.

## Contents

- [Ubiquitous Requirements](#ubiquitous-requirements)
- [Event-Driven Requirements](#event-driven-requirements)
- [State-Driven Requirements](#state-driven-requirements)
- [Unwanted Behavior Requirements](#unwanted-behavior-requirements)
- [Optional Feature Requirements](#optional-feature-requirements)
- [Compound Requirements](#compound-requirements)
- [Writing Tips](#writing-tips)

---

## Ubiquitous Requirements

**Template:**
```
The <system> shall <action>.
```

Requirements that are always active, with no trigger condition. These define invariant behaviors.

### Examples

```
The API shall return responses in JSON format with UTF-8 encoding.

The system shall log all authentication events with timestamp, user ID, and outcome.

The application shall enforce HTTPS for all client-server communication.

The database shall store timestamps in UTC.

The API shall include a request-id header in every response.
```

### Anti-patterns

```
❌ The system should be fast.
   → Not testable. How fast? Measured how?

❌ The system shall be user-friendly.
   → Not testable. Define specific interaction requirements.

✅ The API shall respond to health check requests within 50ms (p99).
✅ The login form shall support keyboard navigation (tab order: email → password → submit).
```

---

## Event-Driven Requirements

**Template:**
```
When <event>, the <system> shall <action>.
```

Requirements triggered by a specific, detectable event. The event is the precondition.

### Examples

```
When a user submits a registration form, the system shall validate all fields
and return validation errors within 200ms.

When a payment transaction fails, the system shall:
  1. Log the failure with transaction ID, error code, and timestamp.
  2. Send a failure notification to the user within 60 seconds.
  3. Release the reserved inventory.

When a file upload exceeds 50MB, the system shall reject the upload with
HTTP 413 and a message indicating the maximum file size.

When a user's session has been inactive for 30 minutes, the system shall
invalidate the session and redirect to the login page.

When the system receives a webhook event with an unrecognized event type,
the system shall log the event payload and return HTTP 200 (acknowledge but ignore).
```

### Anti-patterns

```
❌ When the user does something wrong, show an error.
   → What action? What error? How displayed?

✅ When the user submits a form with an invalid email format,
   the system shall display an inline error message below the email field
   stating "Please enter a valid email address".
```

---

## State-Driven Requirements

**Template:**
```
While <state>, the <system> shall <action>.
```

Requirements that apply continuously while the system is in a specific state.

### Examples

```
While the system is in maintenance mode, the API shall return HTTP 503
with a "Retry-After" header for all endpoints except /health.

While a user account is locked, the system shall reject all login attempts
and display a message with the unlock time.

While the message queue depth exceeds 10,000 messages, the system shall
activate the secondary consumer group.

While the database is performing a backup, the system shall serve read
requests from the read replica and queue write requests.

While the system is operating in degraded mode, the dashboard shall display
a banner indicating limited functionality and estimated recovery time.
```

---

## Unwanted Behavior Requirements

**Template:**
```
If <unwanted condition>, then the <system> shall <action>.
```

Requirements for handling errors, failures, and edge cases. These cover what happens when things go wrong.

### Examples

```
If the external payment gateway does not respond within 5 seconds,
then the system shall retry once after 2 seconds, and if the retry
also fails, return a "payment processing delayed" message to the user.

If the database connection pool is exhausted, then the system shall
queue incoming requests for up to 30 seconds before returning HTTP 503.

If a user attempts to access a resource they do not own, then the system
shall return HTTP 403, log the access attempt with the user ID and resource ID,
and increment the security audit counter.

If the uploaded file contains an unsupported MIME type, then the system shall
reject the file with a message listing the supported types.

If the disk usage exceeds 90%, then the system shall send an alert to the
operations team and begin purging temporary files older than 24 hours.
```

---

## Optional Feature Requirements

**Template:**
```
Where <feature is enabled>, the <system> shall <action>.
```

Requirements that depend on a configurable feature flag or setting.

### Examples

```
Where two-factor authentication is enabled, the system shall require
a TOTP code after successful password verification.

Where the audit log feature is enabled, the system shall record all
CRUD operations with the actor, action, resource, and timestamp.

Where dark mode is enabled, the system shall render all pages using
the dark color palette defined in the theme configuration.

Where rate limiting is configured, the system shall enforce the configured
request limit per API key per minute and return HTTP 429 when exceeded.

Where email notifications are enabled for a user, the system shall send
a daily digest of unread notifications at the user's configured time.
```

---

## Compound Requirements

Complex requirements often combine multiple EARS patterns:

### Event + Unwanted Behavior

```
When a user submits a password reset request:
  - The system shall send a reset email within 60 seconds.
  - If the email address is not associated with an account, then the system
    shall still return a success message (to prevent email enumeration).
  - If the email service is unavailable, then the system shall queue the
    email for retry and inform the user that the email may be delayed.
```

### State + Event

```
While the system is in read-only mode:
  - When a user attempts a write operation, the system shall return HTTP 503
    with a message indicating when write access will be restored.
  - When an admin issues a "restore write access" command, the system shall
    exit read-only mode and process any queued write operations in order.
```

### Requirement Hierarchies

For complex features, use parent-child numbering:

```
FR-1: User Registration
  FR-1.1: When a user submits the registration form, the system shall
          create an account and send a verification email.
  FR-1.2: If the email is already registered, then the system shall
          display "An account with this email already exists".
  FR-1.3: The system shall require passwords of at least 12 characters
          with at least one uppercase letter and one digit.
  FR-1.4: Where CAPTCHA is enabled, the registration form shall include
          a CAPTCHA challenge before submission.
```

---

## Writing Tips

1. **One requirement per statement.** Don't combine multiple behaviors in one sentence.
2. **Use "shall" for requirements, "should" for recommendations, "may" for optional.** This is standard requirement language (RFC 2119).
3. **Be specific about quantities.** Not "quickly" but "within 200ms". Not "many" but "up to 1000".
4. **Name the actor.** "The system shall..." or "The user shall..." -- never the passive "It should be done".
5. **State the observable behavior.** Requirements describe what the system does, not how it does it internally.
