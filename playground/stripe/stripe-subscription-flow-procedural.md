---
name: stripe-subscription-flow
description: Create an end-to-end subscription with product, price, customer, and payment (procedure enclosed)
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
The access key to stripe is stored in .env.playground as STRIPE_SECRET_KEY