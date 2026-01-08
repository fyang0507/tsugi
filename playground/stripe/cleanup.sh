#!/bin/bash
# playground/stripe/cleanup.sh
# Comprehensive cleanup for Stripe playground tasks

set -e

# Load env if exists
if [ -f "$(dirname "$0")/../../.env.playground" ]; then
    export $(grep -v '^#' "$(dirname "$0")/../../.env.playground" | xargs)
fi

if [ -z "$STRIPE_SECRET_KEY" ]; then
    echo "Error: STRIPE_SECRET_KEY not set"
    exit 1
fi

echo "=== Stripe Playground Cleanup ==="
echo ""

# 1. Cancel active subscriptions
echo "Canceling active subscriptions..."
SUBS=$(curl -s "https://api.stripe.com/v1/subscriptions?status=active&limit=100" \
    -u "$STRIPE_SECRET_KEY:" | jq -r '.data[].id')

for SUB_ID in $SUBS; do
    echo "  Canceling $SUB_ID"
    curl -s -X DELETE "https://api.stripe.com/v1/subscriptions/$SUB_ID" \
        -u "$STRIPE_SECRET_KEY:" > /dev/null
done
echo "  Done."
echo ""

# 2. Delete customers (also removes their payment methods)
echo "Deleting customers..."
CUSTOMERS=$(curl -s "https://api.stripe.com/v1/customers?limit=100" \
    -u "$STRIPE_SECRET_KEY:" | jq -r '.data[].id')

for CUS_ID in $CUSTOMERS; do
    EMAIL=$(curl -s "https://api.stripe.com/v1/customers/$CUS_ID" \
        -u "$STRIPE_SECRET_KEY:" | jq -r '.email // "no email"')
    echo "  Deleting $CUS_ID ($EMAIL)"
    curl -s -X DELETE "https://api.stripe.com/v1/customers/$CUS_ID" \
        -u "$STRIPE_SECRET_KEY:" > /dev/null
done
echo "  Done."
echo ""

# 3. Archive products (Stripe doesn't allow deletion of products with prices)
echo "Archiving products..."
PRODUCTS=$(curl -s "https://api.stripe.com/v1/products?active=true&limit=100" \
    -u "$STRIPE_SECRET_KEY:" | jq -r '.data[].id')

for PROD_ID in $PRODUCTS; do
    NAME=$(curl -s "https://api.stripe.com/v1/products/$PROD_ID" \
        -u "$STRIPE_SECRET_KEY:" | jq -r '.name')
    echo "  Archiving $PROD_ID ($NAME)"
    curl -s "https://api.stripe.com/v1/products/$PROD_ID" \
        -u "$STRIPE_SECRET_KEY:" \
        -d active=false > /dev/null
done
echo "  Done."
echo ""

# 4. Archive prices
echo "Archiving prices..."
PRICES=$(curl -s "https://api.stripe.com/v1/prices?active=true&limit=100" \
    -u "$STRIPE_SECRET_KEY:" | jq -r '.data[].id')

for PRICE_ID in $PRICES; do
    echo "  Archiving $PRICE_ID"
    curl -s "https://api.stripe.com/v1/prices/$PRICE_ID" \
        -u "$STRIPE_SECRET_KEY:" \
        -d active=false > /dev/null
done
echo "  Done."
echo ""

# 5. Show recent charges (can't delete, but show for awareness)
echo "Recent charges (cannot be deleted, only refunded):"
curl -s "https://api.stripe.com/v1/charges?limit=5" \
    -u "$STRIPE_SECRET_KEY:" | jq '.data[] | {id, amount, currency, refunded, created: (.created | todate)}'

echo ""
echo "=== Cleanup Complete ==="
