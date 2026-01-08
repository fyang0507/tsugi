---
name: stripe-charge-refund
description: Create a charge and issue a partial refund (procedure enclosed)
---

Using the Stripe API at https://api.stripe.com:

1. Create a $100 charge using test card token tok_visa
2. Issue a $25 partial refund on that charge
3. Verify the refund was processed

You must use the charge ID from step 1 in step 2.
Extract IDs using: curl ... | jq -r '.id'

The task is complete when you can show a refund of $25 (2500 cents).
The access key to stripe is stored in .env.playground as STRIPE_SECRET_KEY
