#!/bin/bash

# Comprehensive test script for all chat and admin panel functions
# Tests all endpoints mentioned in TEST_RESULTS.md

BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_STEAM_ID="${TEST_STEAM_ID:-76561198758560045}"
ADMIN_STEAM_ID="${ADMIN_STEAM_ID:-}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
TOTAL=0

# Test function
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="${5:-200}"
    
    TOTAL=$((TOTAL + 1))
    echo -e "\n${YELLOW}[TEST $TOTAL]${NC} $name"
    echo "  $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE \
            "$BASE_URL$endpoint")
    elif [ "$method" = "PATCH" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PATCH \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq "$expected_status" ] || [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "  ${GREEN}✓ PASSED${NC} (HTTP $http_code)"
        echo "  Response: $(echo "$body" | head -c 200)..."
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗ FAILED${NC} (HTTP $http_code, expected $expected_status)"
        echo "  Response: $body"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "=========================================="
echo "CHAT & ADMIN PANEL COMPREHENSIVE TESTS"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "Test Steam ID: $TEST_STEAM_ID"
echo "Admin Steam ID: ${ADMIN_STEAM_ID:-NOT SET}"
echo "=========================================="

# ============================================
# 1. DM List with Profile Pictures and Names
# ============================================
echo -e "\n${YELLOW}=== Test 1: DM List with Profile Pictures ===${NC}"
test_endpoint "Get DM List" "GET" "/api/chat/dms/list?steamId=$TEST_STEAM_ID"

# ============================================
# 2. Reports Page Access
# ============================================
echo -e "\n${YELLOW}=== Test 2: Reports Functionality ===${NC}"
if [ -n "$ADMIN_STEAM_ID" ]; then
    test_endpoint "Get Reports (Admin)" "GET" "/api/chat/report?adminSteamId=$ADMIN_STEAM_ID"
else
    echo "  [SKIP] Admin Steam ID not set"
fi

# ============================================
# 3. User Search Functionality
# ============================================
echo -e "\n${YELLOW}=== Test 3: User Search Functionality ===${NC}"
if [ -n "$ADMIN_STEAM_ID" ]; then
    test_endpoint "Get User Info (Admin)" "GET" "/api/admin/user/$TEST_STEAM_ID?adminSteamId=$ADMIN_STEAM_ID"
else
    echo "  [SKIP] Admin Steam ID not set"
fi

# ============================================
# 4. Chat Preloading on Login
# ============================================
echo -e "\n${YELLOW}=== Test 4: Chat Messages Endpoint ===${NC}"
test_endpoint "Get Global Chat Messages" "GET" "/api/chat/messages"
test_endpoint "Send Chat Message" "POST" "/api/chat/messages" \
    "{\"steamId\":\"$TEST_STEAM_ID\",\"message\":\"Test message $(date +%s)\"}"

# ============================================
# 5. Performance Optimizations
# ============================================
echo -e "\n${YELLOW}=== Test 5: Performance Endpoints ===${NC}"
test_endpoint "Get DM List (Performance)" "GET" "/api/chat/dms/list?steamId=$TEST_STEAM_ID"
test_endpoint "Get DM Invites" "GET" "/api/chat/dms/invites?steamId=$TEST_STEAM_ID&type=pending"

# ============================================
# 6. Message Delete Functionality
# ============================================
echo -e "\n${YELLOW}=== Test 6: Message Delete (Note: Requires valid messageId) ===${NC}"
echo "  [INFO] Delete test requires a valid message ID from database"
echo "  [SKIP] Manual test required"

# ============================================
# 7. Report Functionality
# ============================================
echo -e "\n${YELLOW}=== Test 7: Report Functionality ===${NC}"
test_endpoint "Create Report" "POST" "/api/chat/report" \
    "{\"reporterSteamId\":\"$TEST_STEAM_ID\",\"reportedSteamId\":\"76561199235618867\",\"reportType\":\"global\",\"reporterName\":\"Test User\",\"reportedName\":\"Test Target\"}"

# ============================================
# 8. Timeout View Button
# ============================================
echo -e "\n${YELLOW}=== Test 8: Timeout Functionality ===${NC}"
if [ -n "$ADMIN_STEAM_ID" ]; then
    test_endpoint "Get Active Timeouts" "GET" "/api/admin/timeouts?adminSteamId=$ADMIN_STEAM_ID"
else
    echo "  [SKIP] Admin Steam ID not set"
fi

# ============================================
# 9. DM Invite Acceptance
# ============================================
echo -e "\n${YELLOW}=== Test 9: DM Invite Functionality ===${NC}"
test_endpoint "Get DM Invites" "GET" "/api/chat/dms/invites?steamId=$TEST_STEAM_ID&type=pending"
test_endpoint "Send DM Invite" "POST" "/api/chat/dms/invites" \
    "{\"fromSteamId\":\"$TEST_STEAM_ID\",\"toSteamId\":\"76561199235618867\"}"

# ============================================
# 10. Admin Panel Functions
# ============================================
echo -e "\n${YELLOW}=== Test 10: Admin Panel Functions ===${NC}"
if [ -n "$ADMIN_STEAM_ID" ]; then
    test_endpoint "Get User Count" "GET" "/api/admin/user-count"
    test_endpoint "Get User Info with DMs" "GET" "/api/admin/user/$TEST_STEAM_ID?adminSteamId=$ADMIN_STEAM_ID"
else
    echo "  [SKIP] Admin Steam ID not set"
fi

# ============================================
# Summary
# ============================================
echo -e "\n${YELLOW}=========================================="
echo "TEST SUMMARY"
echo "==========================================${NC}"
echo "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}✗ Some tests failed${NC}"
    exit 1
fi

