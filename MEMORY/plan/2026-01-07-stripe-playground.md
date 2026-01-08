# Stripe Playground Plan

> Verified January 6, 2026. Uses Stripe Test Mode (requires free account).

---

## Environment Setup

### Prerequisites
- Free Stripe account (no payment info required)
- Docker (optional, for cleanup)
- `jq` command-line tool

### Step 1: Create Stripe Account
1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Sign up (email + password, no credit card needed)
3. Verify email

### Step 2: Get Test API Key
1. In Dashboard, go to **Developers → API keys**
2. Copy your **Secret key** (starts with `sk_test_`)
3. Store in environment variable:
   ```bash
   export STRIPE_SECRET_KEY="sk_test_..."
   ```

### Step 3: Verify Setup
```bash
curl https://api.stripe.com/v1/customers \
  -u $STRIPE_SECRET_KEY: \
  -d email=test@example.com
```
Should return JSON with `"id": "cus_..."`.

### Setup Script: `playground/stripe/setup.sh`

```bash
#!/bin/bash
set -e

echo "=== Stripe Playground Setup ==="

# Check for API key
if [ -z "$STRIPE_SECRET_KEY" ]; then
    echo "Error: STRIPE_SECRET_KEY not set"
    echo ""
    echo "Get your test key from: https://dashboard.stripe.com/test/apikeys"
    echo "Then run: export STRIPE_SECRET_KEY=\"sk_test_...\""
    exit 1
fi

# Verify connection
echo "Verifying Stripe connection..."
RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/stripe_test.json \
    https://api.stripe.com/v1/customers \
    -u $STRIPE_SECRET_KEY: \
    -d email=setup_test@example.com)

if [ "$RESPONSE" = "200" ]; then
    echo "✓ Connected to Stripe test mode"
    # Cleanup test customer
    CUS_ID=$(jq -r '.id' /tmp/stripe_test.json)
    curl -s -X DELETE https://api.stripe.com/v1/customers/$CUS_ID \
        -u $STRIPE_SECRET_KEY: > /dev/null
else
    echo "✗ Failed to connect (HTTP $RESPONSE)"
    cat /tmp/stripe_test.json
    exit 1
fi

echo ""
echo "=== Setup Complete ==="
echo "Stripe API: https://api.stripe.com"
echo "Test cards: https://docs.stripe.com/testing#cards"
```

---

## Code Change Required

**File:** `src/lib/tools/skill-commands.ts` (line 12)

Add `jq` for JSON parsing:
```typescript
const ALLOWED_SHELL_COMMANDS = ['curl', 'cat', 'ls', 'head', 'tail', 'find', 'tree', 'jq'];
```

---

## Task 1: End-to-End Subscription Flow (Hard)

**File:** `playground/stripe-subscription-flow.md`

```markdown
---
name: stripe-subscription-flow
description: Create an end-to-end subscription with product, price, customer, and payment
---

Create a monthly $29/month subscription for a new customer using the Stripe API.

API Base: https://api.stripe.com
Authentication: Use -u $STRIPE_SECRET_KEY: (note the trailing colon)

Requirements:
1. Create a Product called "Pro Plan"
2. Create a recurring Price of $29/month linked to that product
3. Create a Customer with email "subscriber@example.com"
4. Attach a test payment method (pm_card_visa) to the customer
5. Create a Subscription linking customer + price + default payment method
6. Verify the subscription status is "active"

You must chain these operations - each step requires IDs from previous steps.
Extract IDs using: curl ... | jq -r '.id'

The task is complete when you can show a subscription with status "active".
```

### Dependency Chain

```
Product (prod_xxx)
    ↓
Price (price_xxx) ← requires product ID
    ↓
Customer (cus_xxx)
    ↓
PaymentMethod attached ← requires customer ID
    ↓
Subscription (sub_xxx) ← requires customer ID + price ID + default_payment_method
```

### Gotchas That Will Trip the Agent

| Step | Gotcha | Error Message |
|------|--------|---------------|
| Auth | Missing colon after key | `Invalid API Key provided` |
| Auth | Using key without -u | `No API key provided` |
| 2. Price | Missing `product` param | `Missing required param: product` |
| 2. Price | Wrong interval format | `Invalid recurring[interval]` |
| 2. Price | Amount not in cents | Creates $0.29 not $29.00 |
| 2. Price | Using `recurring.interval` | Must use `recurring[interval]` |
| 4. Attach PM | Wrong endpoint | Must use `/v1/payment_methods/:id/attach` |
| 4. Attach PM | Missing customer | `Missing required param: customer` |
| 5. Subscription | Missing items array | `Missing required param: items` |
| 5. Subscription | Wrong items format | Must use `items[0][price]=price_xxx` |
| 5. Subscription | No default payment | Status = `incomplete` not `active` |

### Expected Trial-and-Error Trajectory (Run 1)

1. Agent tries to create subscription directly → fails (no customer)
2. Creates customer, tries subscription → fails (no price)
3. Creates price without product → fails (`product is required`)
4. Creates product, then price → price created but amount wrong ($0.29)
5. Recreates price with correct cents → success
6. Creates subscription → status "incomplete" (no payment method)
7. Tries to add payment method wrong way → fails
8. Discovers `/attach` endpoint → attaches payment method
9. Creates subscription again → still "incomplete"
10. Discovers `default_payment_method` param → finally "active"

**Expected: 8-12 attempts over 10-15 minutes**

### Working Solution (What Skill Should Capture)

```bash
# 1. Create Product
PRODUCT_ID=$(curl -s https://api.stripe.com/v1/products \
  -u $STRIPE_SECRET_KEY: \
  -d name="Pro Plan" | jq -r '.id')

# 2. Create Price (NOTE: amount in cents, recurring[interval] format)
PRICE_ID=$(curl -s https://api.stripe.com/v1/prices \
  -u $STRIPE_SECRET_KEY: \
  -d product=$PRODUCT_ID \
  -d unit_amount=2900 \
  -d currency=usd \
  -d "recurring[interval]=month" | jq -r '.id')

# 3. Create Customer
CUSTOMER_ID=$(curl -s https://api.stripe.com/v1/customers \
  -u $STRIPE_SECRET_KEY: \
  -d email="subscriber@example.com" | jq -r '.id')

# 4. Attach Payment Method (NOTE: /attach endpoint, not create)
curl -s https://api.stripe.com/v1/payment_methods/pm_card_visa/attach \
  -u $STRIPE_SECRET_KEY: \
  -d customer=$CUSTOMER_ID

# 5. Create Subscription (NOTE: items[0][price] format, default_payment_method)
curl -s https://api.stripe.com/v1/subscriptions \
  -u $STRIPE_SECRET_KEY: \
  -d customer=$CUSTOMER_ID \
  -d "items[0][price]=$PRICE_ID" \
  -d default_payment_method=pm_card_visa | jq '.status'
# Should output: "active"
```

---

## Task 2: Charge and Partial Refund (Medium)

**File:** `playground/stripe-charge-refund.md`

```markdown
---
name: stripe-charge-refund
description: Create a charge and issue a partial refund
---

Using the Stripe API at https://api.stripe.com:

1. Create a $100 charge using test card token tok_visa
2. Issue a $25 partial refund on that charge
3. Verify the refund was processed

You must use the charge ID from step 1 in step 2.
Extract IDs using: curl ... | jq -r '.id'

The task is complete when you can show a refund of $25 (2500 cents).
```

### Gotchas

| Step | Gotcha | Error |
|------|--------|-------|
| 1. Charge | Wrong source format | Must use `source=tok_visa` |
| 1. Charge | Amount not in cents | $100 = 10000, not 100 |
| 1. Charge | Missing currency | `Missing required param: currency` |
| 2. Refund | Using wrong charge ID | `No such charge: 'ch_xxx'` |
| 2. Refund | Refund amount > charge | `Refund amount exceeds charge amount` |
| 2. Refund | Amount not in cents | $25 = 2500, not 25 |

**Expected: 3-5 attempts over 3-5 minutes**

### Working Solution

```bash
# 1. Create charge (amount in cents!)
CHARGE_ID=$(curl -s https://api.stripe.com/v1/charges \
  -u $STRIPE_SECRET_KEY: \
  -d amount=10000 \
  -d currency=usd \
  -d source=tok_visa | jq -r '.id')

# 2. Partial refund (amount in cents!)
curl -s https://api.stripe.com/v1/refunds \
  -u $STRIPE_SECRET_KEY: \
  -d charge=$CHARGE_ID \
  -d amount=2500 | jq '{id, amount, status}'
```

---

## Expected Skill Output

After completing tasks, the agent should produce a skill like:

```markdown
---
name: stripe-api
description: Stripe API patterns via curl - subscriptions, charges, refunds
---

# Stripe API Integration

## Authentication
Always use `-u $STRIPE_SECRET_KEY:` (trailing colon required!)

## Critical: Amounts in Cents
- $29.00 = 2900
- $100.00 = 10000
- $25.00 = 2500

## Nested Parameter Format
Use brackets, not dots:
- ✓ `recurring[interval]=month`
- ✗ `recurring.interval=month`
- ✓ `items[0][price]=price_xxx`
- ✗ `items.0.price=price_xxx`

## Subscription Flow (Order Matters!)
1. Product → 2. Price (needs product) → 3. Customer → 4. Attach PaymentMethod → 5. Subscription

### Create Product
curl https://api.stripe.com/v1/products -u $STRIPE_SECRET_KEY: -d name="Plan Name"

### Create Recurring Price
curl https://api.stripe.com/v1/prices -u $STRIPE_SECRET_KEY: \
  -d product=prod_xxx \
  -d unit_amount=2900 \
  -d currency=usd \
  -d "recurring[interval]=month"

### Attach Payment Method (Special Endpoint!)
curl https://api.stripe.com/v1/payment_methods/pm_card_visa/attach \
  -u $STRIPE_SECRET_KEY: \
  -d customer=cus_xxx

### Create Subscription
curl https://api.stripe.com/v1/subscriptions -u $STRIPE_SECRET_KEY: \
  -d customer=cus_xxx \
  -d "items[0][price]=price_xxx" \
  -d default_payment_method=pm_card_visa

## Test Tokens
- Card: tok_visa, tok_mastercard
- Payment methods: pm_card_visa, pm_card_mastercard
- Declining: tok_chargeDeclined

## Common Errors
| Error | Cause | Fix |
|-------|-------|-----|
| `Invalid API Key` | Missing colon | Add `:` after key |
| `Missing required param: product` | Price without product | Create product first |
| `Invalid recurring[interval]` | Wrong format | Use brackets not dots |
| Status `incomplete` | No payment method | Add default_payment_method |
```

---

## Metrics: Run 1 vs Run 2

| Metric | Run 1 (No Skill) | Run 2 (With Skill) |
|--------|------------------|-------------------|
| **Subscription Task** |||
| API calls | 15-25 | 5-6 |
| Errors hit | 8-12 | 0-1 |
| Research lookups | 5+ | 0 |
| Time | 10-15 min | 1-2 min |
| **Charge/Refund Task** |||
| API calls | 5-8 | 2 |
| Errors hit | 3-5 | 0 |
| Time | 3-5 min | < 1 min |

---

## Files to Create

| File | Purpose |
|------|---------|
| `playground/stripe/setup.sh` | Verifies Stripe connection |
| `playground/stripe-subscription-flow.md` | Main hard task |
| `playground/stripe-charge-refund.md` | Warm-up task |

---

## Implementation Checklist

- [ ] Create `playground/stripe/` directory
- [ ] Write `setup.sh` with connection verification
- [ ] Add `jq` to `ALLOWED_SHELL_COMMANDS` in `skill-commands.ts`
- [ ] Create `stripe-subscription-flow.md` task
- [ ] Create `stripe-charge-refund.md` task
- [ ] Test both tasks manually to verify gotchas trigger
- [ ] Document cleanup steps (delete test products/customers)

---

## Cleanup Script (Optional)

```bash
#!/bin/bash
# playground/stripe/cleanup.sh
# Delete test data created during playground runs

echo "Listing recent test customers..."
curl -s https://api.stripe.com/v1/customers?limit=10 \
  -u $STRIPE_SECRET_KEY: | jq '.data[] | {id, email}'

echo ""
echo "To delete a customer: curl -X DELETE https://api.stripe.com/v1/customers/cus_xxx -u \$STRIPE_SECRET_KEY:"
```

---

## Sources

- [Stripe API Keys](https://docs.stripe.com/keys)
- [Stripe Subscriptions API](https://docs.stripe.com/api/subscriptions/create)
- [Build Subscriptions Integration](https://docs.stripe.com/billing/subscriptions/build-subscriptions)
- [Stripe Testing](https://docs.stripe.com/testing)
- [Common Stripe Mistakes](https://moldstud.com/articles/p-common-mistakes-developers-make-when-using-stripe-payment-processing-avoid-these-pitfalls)
