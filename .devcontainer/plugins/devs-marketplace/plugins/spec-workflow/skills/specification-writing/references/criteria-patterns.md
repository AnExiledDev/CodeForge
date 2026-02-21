# Acceptance Criteria Patterns by Domain

Examples of acceptance criteria organized by common feature domains.

## Contents

- [Authentication](#authentication)
- [Payments](#payments)
- [File Upload](#file-upload)
- [Search](#search)
- [Notifications](#notifications)
- [Data Import](#data-import)
- [Cross-Domain Edge Cases](#cross-domain-edge-cases)

---

## Authentication

### Login Flow

```gherkin
Feature: User Login

  Scenario: Successful login with email and password
    Given a verified user with email "alice@example.com"
    When the user submits the login form with correct credentials
    Then the system returns a 200 response with an auth token
    And the token expires in 24 hours
    And a "login_success" event is logged with the user ID

  Scenario: Login with unverified email
    Given a user with email "bob@example.com" who has not verified their email
    When the user submits the login form with correct credentials
    Then the system returns a 403 response
    And the response body contains "Please verify your email address"
    And a new verification email is sent

  Scenario: Login with invalid credentials
    Given no user exists with email "unknown@example.com"
    When the user submits the login form with email "unknown@example.com"
    Then the system returns a 401 response
    And the response body contains "Invalid email or password"
    And the response time is similar to a valid-email failure (timing-safe)

  Scenario: Account lockout after repeated failures
    Given a user with email "alice@example.com"
    When the user submits 5 incorrect passwords within 10 minutes
    Then the account is locked for 15 minutes
    And subsequent login attempts return "Account temporarily locked"
    And a security alert email is sent to the user
```

### Password Reset

**Checklist format:**

- [ ] Reset email sent within 60 seconds of request
- [ ] Reset token is a cryptographically random 32-byte value
- [ ] Token expires after 1 hour
- [ ] Token is single-use (invalidated after first use)
- [ ] Using an expired or used token shows "This link has expired" with option to request a new one
- [ ] New password must meet strength requirements
- [ ] All existing sessions invalidated after successful reset
- [ ] Reset request for non-existent email returns success (no enumeration)
- [ ] Rate limited to 3 reset requests per email per hour

---

## Payments

### Checkout Flow

```gherkin
Feature: Order Checkout

  Scenario: Successful payment
    Given a cart with items totaling $49.99
    And the user has a valid payment method on file
    When the user confirms the checkout
    Then the payment is authorized for $49.99
    And the order status changes to "confirmed"
    And a confirmation email is sent with the order details
    And inventory is decremented for each item

  Scenario: Payment declined
    Given a cart with items totaling $49.99
    When the payment gateway returns "card_declined"
    Then the order status remains "pending"
    And the user sees "Your card was declined. Please try another payment method."
    And inventory is NOT decremented
    And no confirmation email is sent

  Scenario: Payment gateway timeout
    Given a cart with items totaling $49.99
    When the payment gateway does not respond within 10 seconds
    Then the system retries once after 3 seconds
    And if the retry also fails, shows "Payment processing is delayed"
    And the order enters "payment_pending" status
    And a background job checks payment status every 60 seconds for 30 minutes
```

### Discount Rules

**Table-driven format:**

| Customer Type | Order Total | Coupon | Expected Discount | Final Price |
|---------------|-------------|--------|-------------------|-------------|
| Standard      | $30.00      | None   | 0%                | $30.00      |
| Standard      | $30.00      | SAVE10 | 10%               | $27.00      |
| Premium       | $30.00      | None   | 5%                | $28.50      |
| Premium       | $30.00      | SAVE10 | 10% (higher wins) | $27.00      |
| Premium       | $100.00     | SAVE10 | 15% (premium tier) | $85.00     |
| Any           | $0.00       | SAVE10 | 0%                | $0.00       |
| Standard      | $30.00      | EXPIRED| 0% + error shown  | $30.00      |

---

## File Upload

### Image Upload

```gherkin
Feature: Profile Image Upload

  Scenario: Successful image upload
    Given the user is on the profile settings page
    When the user uploads a valid JPEG image under 5MB
    Then the image is resized to 256x256 pixels
    And the image is stored in the CDN
    And the user's profile displays the new image within 5 seconds

  Scenario: File too large
    When the user uploads an image larger than 5MB
    Then the upload is rejected before the file is fully transferred
    And the error message reads "Image must be under 5MB. Your file is [X]MB."

  Scenario: Invalid file type
    When the user uploads a .exe file renamed to .jpg
    Then the system validates the file's MIME type (not just extension)
    And rejects the upload with "Supported formats: JPEG, PNG, WebP"

  Scenario: Concurrent uploads
    When the user uploads two images simultaneously
    Then only the last uploaded image is saved as the profile picture
    And both uploads complete without errors
```

---

## Search

### Full-Text Search

**Checklist format:**

- [ ] Empty search query returns validation error, not all results
- [ ] Search results appear within 500ms for queries across 1M documents
- [ ] Results are ranked by relevance (BM25 or equivalent)
- [ ] Search highlights matching terms in results with `<mark>` tags
- [ ] Queries with no results show "No results found" with spelling suggestions
- [ ] Special characters in queries are escaped (no injection)
- [ ] Results are paginated with 20 items per page
- [ ] Search query is preserved in the URL for shareability
- [ ] Minimum query length: 2 characters
- [ ] Maximum query length: 200 characters

---

## Notifications

### Email Notifications

```gherkin
Feature: Notification Preferences

  Scenario: User opts out of marketing emails
    Given a user subscribed to all notification types
    When the user unchecks "Marketing updates" in notification preferences
    Then marketing emails stop within 24 hours
    And transactional emails (receipts, password resets) continue normally
    And the preference change is logged for compliance

  Scenario: Notification delivery failure
    Given a notification is queued for delivery
    When the email provider returns a 5xx error
    Then the system retries after 1 minute, 5 minutes, and 30 minutes
    And after 3 failures, marks the notification as "failed"
    And does NOT send further retries for this notification
    And the failure is recorded in the admin dashboard
```

---

## Data Import

### CSV Import

```gherkin
Feature: User Data Import

  Scenario: Valid CSV import
    Given an admin uploads a CSV with 500 valid user records
    When the import is processed
    Then all 500 users are created with correct field mapping
    And the admin sees a summary: "500 created, 0 skipped, 0 errors"
    And each user receives a welcome email

  Scenario: CSV with validation errors
    Given a CSV where row 3 has an invalid email and row 7 has a duplicate email
    When the import is processed
    Then valid rows (498) are imported successfully
    And invalid rows are skipped with error details:
      | Row | Field | Error |
      | 3   | email | "not.valid" is not a valid email format |
      | 7   | email | "alice@example.com" already exists |
    And the admin can download an error report CSV

  Scenario: Large file import
    Given a CSV with 100,000 records
    When the import is initiated
    Then the import runs asynchronously (not blocking the UI)
    And the admin sees a progress indicator
    And the import completes within 5 minutes
    And the system sends an email when import finishes
```

---

## Cross-Domain Edge Cases

These edge cases apply to most features and should be checked:

```markdown
## Universal Edge Cases

- [ ] Empty input: What happens when required fields are blank?
- [ ] Maximum length: What happens at the field's max length? At max + 1?
- [ ] Unicode: Does the feature handle emoji, CJK characters, RTL text?
- [ ] Concurrent access: What if two users edit the same resource simultaneously?
- [ ] Network interruption: What if connectivity drops mid-operation?
- [ ] Timezone: Do date-dependent features work correctly across timezones?
- [ ] Pagination boundary: What happens when viewing the last page as items are deleted?
- [ ] Authorization: Can the feature be accessed without authentication? With wrong role?
- [ ] Idempotency: What happens if the same request is sent twice?
```
