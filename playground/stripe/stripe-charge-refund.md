---
name: stripe-refund-hard
description: Process a partial refund using Stripe API
---

Charge $210 and then refund 1/3 of it.

API: use Stripe API
Auth: Bearer token from STRIPE_SECRET_KEY in .env.playground

Success criteria: Show a completed refund receipt.