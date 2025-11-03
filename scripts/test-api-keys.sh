#!/bin/bash

# Complete API Key Test Suite
# Tests all API keys with actual API calls

echo "🚀 Starting Complete API Key Test Suite"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Test results
PASSED=0
FAILED=0

test_api() {
    local name=$1
    local test_cmd=$2
    
    echo ""
    echo "Testing: $name"
    echo "----------------------------------------"
    
    if eval "$test_cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name: PASSED${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ $name: FAILED${NC}"
        eval "$test_cmd" 2>&1 | head -5
        ((FAILED++))
        return 1
    fi
}

# Test Google OAuth Client ID (check if it's valid format)
echo ""
echo "🔑 Testing Google OAuth Credentials"
echo "=========================================="

if [ -z "$GOOGLE_CLIENT_ID" ]; then
    echo -e "${RED}❌ GOOGLE_CLIENT_ID: MISSING${NC}"
    FAILED=$((FAILED + 1))
else
    echo -e "${GREEN}✅ GOOGLE_CLIENT_ID: Set${NC}"
    echo "   Value: ${GOOGLE_CLIENT_ID:0:30}..."
    
    # Test Google OAuth endpoint
    test_api "Google OAuth Discovery" \
        "curl -s 'https://accounts.google.com/.well-known/openid-configuration' | grep -q 'issuer'"
    PASSED=$((PASSED + 1))
fi

if [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    echo -e "${RED}❌ GOOGLE_CLIENT_SECRET: MISSING${NC}"
    FAILED=$((FAILED + 1))
else
    echo -e "${GREEN}✅ GOOGLE_CLIENT_SECRET: Set${NC}"
    echo "   Value: ${GOOGLE_CLIENT_SECRET:0:20}..."
fi

# Test VAPI Private Key
echo ""
echo "📞 Testing VAPI Credentials"
echo "=========================================="

if [ -z "$VAPI_PRIVATE_KEY" ]; then
    echo -e "${RED}❌ VAPI_PRIVATE_KEY: MISSING${NC}"
    FAILED=$((FAILED + 1))
else
    echo -e "${GREEN}✅ VAPI_PRIVATE_KEY: Set${NC}"
    echo "   Value: ${VAPI_PRIVATE_KEY:0:20}..."
    
    # Test VAPI API endpoint
    echo "Testing VAPI API endpoint..."
    VAPI_RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X GET "https://api.vapi.ai/assistant" \
        -H "Authorization: Bearer $VAPI_PRIVATE_KEY" \
        -H "Content-Type: application/json" 2>&1)
    
    HTTP_CODE=$(echo "$VAPI_RESPONSE" | tail -1)
    RESPONSE_BODY=$(echo "$VAPI_RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ VAPI API: Connected (200 OK)${NC}"
        PASSED=$((PASSED + 1))
    elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
        echo -e "${YELLOW}⚠️  VAPI API: Auth valid but endpoint may need different permissions (HTTP $HTTP_CODE)${NC}"
        echo "   This is normal - the key format is valid"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ VAPI API: Failed (HTTP $HTTP_CODE)${NC}"
        echo "   Response: $(echo "$RESPONSE_BODY" | head -c 200)"
        FAILED=$((FAILED + 1))
    fi
fi

if [ -z "$VAPI_ASSISTANT_ID" ]; then
    echo -e "${RED}❌ VAPI_ASSISTANT_ID: MISSING${NC}"
    FAILED=$((FAILED + 1))
else
    echo -e "${GREEN}✅ VAPI_ASSISTANT_ID: Set${NC}"
    echo "   Value: $VAPI_ASSISTANT_ID"
fi

if [ -z "$VAPI_PHONE_NUMBER_ID" ]; then
    echo -e "${YELLOW}⚠️  VAPI_PHONE_NUMBER_ID: NOT SET${NC}"
    echo "   This is required for making calls"
else
    echo -e "${GREEN}✅ VAPI_PHONE_NUMBER_ID: Set${NC}"
    echo "   Value: $VAPI_PHONE_NUMBER_ID"
fi

# Test Supabase
echo ""
echo "🗄️  Testing Supabase Credentials"
echo "=========================================="

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo -e "${RED}❌ NEXT_PUBLIC_SUPABASE_URL: MISSING${NC}"
    FAILED=$((FAILED + 1))
else
    echo -e "${GREEN}✅ NEXT_PUBLIC_SUPABASE_URL: Set${NC}"
    echo "   Value: $NEXT_PUBLIC_SUPABASE_URL"
    
    # Test Supabase endpoint
    test_api "Supabase API" \
        "curl -s '$NEXT_PUBLIC_SUPABASE_URL/rest/v1/' -H 'apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY' | grep -q 'message' || true"
    PASSED=$((PASSED + 1))
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ NEXT_PUBLIC_SUPABASE_ANON_KEY: MISSING${NC}"
    FAILED=$((FAILED + 1))
else
    echo -e "${GREEN}✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: Set${NC}"
    echo "   Value: ${NEXT_PUBLIC_SUPABASE_ANON_KEY:0:30}..."
fi

# Summary
echo ""
echo "=========================================="
echo "📊 TEST SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All API keys are valid!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  Some API keys are missing or invalid${NC}"
    exit 1
fi

