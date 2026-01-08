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
