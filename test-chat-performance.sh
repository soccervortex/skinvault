#!/bin/bash

# Test script to check chat API performance
# Usage: ./test-chat-performance.sh

BASE_URL="${1:-https://www.skinvaults.online}"

echo "Testing Chat API Performance..."
echo "================================"
echo ""

# Test 1: Global chat messages
echo "1. Testing Global Chat Messages..."
time curl -s "${BASE_URL}/api/chat/messages?limit=50" -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s\n"
echo ""

# Test 2: DM messages (requires auth, so just test endpoint exists)
echo "2. Testing DM Messages endpoint..."
time curl -s "${BASE_URL}/api/chat/dms?steamId1=test1&steamId2=test2&currentUserId=test1" -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s\n"
echo ""

# Test 3: DM list
echo "3. Testing DM List endpoint..."
time curl -s "${BASE_URL}/api/chat/dms/list?steamId=test" -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s\n"
echo ""

echo "Performance test complete!"
echo ""
echo "Expected results:"
echo "- Status codes should be 200 or 400/403 (auth required)"
echo "- Response times should be < 1s for most requests"
echo "- Connection pooling should make subsequent requests faster"

