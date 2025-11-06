#!/bin/bash

# Script to configure VAPI webhook
# This will prompt you for your ngrok URL

echo "🔧 VAPI Webhook Configuration"
echo "=============================="
echo ""

# Check if ngrok is running
if ! curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
    echo "⚠️  ngrok doesn't seem to be running."
    echo ""
    echo "Please start ngrok in a separate terminal:"
    echo "  ngrok http 3000"
    echo ""
    echo "Then copy the HTTPS URL (e.g., https://abc123.ngrok.io)"
    echo ""
    read -p "Enter your ngrok HTTPS URL (or deployed URL): " WEBHOOK_BASE
else
    # Try to get ngrok URL automatically
    WEBHOOK_BASE=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -z "$WEBHOOK_BASE" ]; then
        echo "Could not auto-detect ngrok URL."
        read -p "Enter your webhook base URL (e.g., https://abc123.ngrok.io): " WEBHOOK_BASE
    else
        echo "✅ Found ngrok URL: $WEBHOOK_BASE"
    fi
fi

if [ -z "$WEBHOOK_BASE" ]; then
    echo "❌ No URL provided. Exiting."
    exit 1
fi

# Remove trailing slash if present
WEBHOOK_BASE=${WEBHOOK_BASE%/}
WEBHOOK_URL="${WEBHOOK_BASE}/api/vapi/webhook"

echo ""
echo "📝 Configuring webhook..."
echo "   URL: $WEBHOOK_URL"
echo ""

# Load environment variables
export $(grep -v '^#' .env.local | xargs)

VAPI_PRIVATE_KEY=${VAPI_PRIVATE_KEY:-$VAPI_API_KEY}
ASSISTANT_ID=${VAPI_ASSISTANT_ID:-"3573b8dd-f031-4338-8cef-f8cc548dc415"}

if [ -z "$VAPI_PRIVATE_KEY" ]; then
    echo "❌ VAPI_PRIVATE_KEY not found in .env.local"
    exit 1
fi

# Configure webhook via VAPI API
echo "Sending request to VAPI API..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH https://api.vapi.ai/assistant \
  -H "Authorization: Bearer $VAPI_PRIVATE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$ASSISTANT_ID\",
    \"serverUrl\": \"$WEBHOOK_URL\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo ""
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "✅ Webhook configured successfully!"
    echo ""
    echo "📋 Summary:"
    echo "   Assistant ID: $ASSISTANT_ID"
    echo "   Webhook URL: $WEBHOOK_URL"
    echo ""
    echo "🎉 Done! Future calls will automatically sync transcriptions and notes."
else
    echo "❌ Failed to configure webhook"
    echo "   HTTP Code: $HTTP_CODE"
    echo "   Response: $BODY"
    echo ""
    echo "💡 Try running the setup script instead:"
    echo "   npx tsx scripts/setup-vapi-webhook.ts $WEBHOOK_URL"
    exit 1
fi

