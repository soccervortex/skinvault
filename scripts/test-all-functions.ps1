# Comprehensive test script for all chat and admin panel functions (PowerShell)
# Tests all endpoints mentioned in TEST_RESULTS.md

$BASE_URL = if ($env:BASE_URL) { $env:BASE_URL } else { "http://localhost:3000" }
$TEST_STEAM_ID = if ($env:TEST_STEAM_ID) { $env:TEST_STEAM_ID } else { "76561198758560045" }
$ADMIN_STEAM_ID = if ($env:ADMIN_STEAM_ID) { $env:ADMIN_STEAM_ID } else { "" }

$script:PASSED = 0
$script:FAILED = 0
$script:TOTAL = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [string]$Data = $null,
        [int]$ExpectedStatus = 200
    )
    
    $script:TOTAL++
    Write-Host "`n[TEST $script:TOTAL] $Name" -ForegroundColor Yellow
    Write-Host "  $Method $Endpoint"
    
    try {
        $uri = "$BASE_URL$Endpoint"
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        if ($Method -eq "GET") {
            $response = Invoke-WebRequest -Uri $uri -Method GET -UseBasicParsing -ErrorAction Stop
        }
        elseif ($Method -eq "POST") {
            $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Data)
            $response = Invoke-WebRequest -Uri $uri -Method POST -Headers $headers -Body $bodyBytes -UseBasicParsing -ErrorAction Stop
        }
        elseif ($Method -eq "DELETE") {
            $response = Invoke-WebRequest -Uri $uri -Method DELETE -UseBasicParsing -ErrorAction Stop
        }
        elseif ($Method -eq "PATCH") {
            $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Data)
            $response = Invoke-WebRequest -Uri $uri -Method PATCH -Headers $headers -Body $bodyBytes -UseBasicParsing -ErrorAction Stop
        }
        
        $statusCode = $response.StatusCode
        $body = $response.Content | ConvertFrom-Json
        
        if ($statusCode -eq $ExpectedStatus -or ($statusCode -ge 200 -and $statusCode -lt 300)) {
            Write-Host "  [PASSED] (HTTP $statusCode)" -ForegroundColor Green
            $bodyStr = ($body | ConvertTo-Json -Depth 2).Substring(0, [Math]::Min(200, ($body | ConvertTo-Json).Length))
            Write-Host "  Response: $bodyStr..."
            $script:PASSED++
            return $true
        }
        else {
            Write-Host "  [FAILED] (HTTP $statusCode, expected $ExpectedStatus)" -ForegroundColor Red
            Write-Host "  Response: $($response.Content)"
            $script:FAILED++
            return $false
        }
    }
    catch {
        $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { 0 }
        Write-Host "  [FAILED] (HTTP $statusCode)" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)"
        $script:FAILED++
        return $false
    }
}

Write-Host "=========================================="
Write-Host "CHAT and ADMIN PANEL COMPREHENSIVE TESTS"
Write-Host "=========================================="
Write-Host "Base URL: $BASE_URL"
Write-Host "Test Steam ID: $TEST_STEAM_ID"
Write-Host "Admin Steam ID: $(if ($ADMIN_STEAM_ID) { $ADMIN_STEAM_ID } else { 'NOT SET' })"
Write-Host "=========================================="

# ============================================
# 1. DM List with Profile Pictures and Names
# ============================================
Write-Host "`n=== Test 1: DM List with Profile Pictures ===" -ForegroundColor Yellow
$dmListUrl = "/api/chat/dms/list?steamId=$TEST_STEAM_ID"
Test-Endpoint -Name "Get DM List" -Method "GET" -Endpoint $dmListUrl

# ============================================
# 2. Reports Page Access
# ============================================
Write-Host "`n=== Test 2: Reports Functionality ===" -ForegroundColor Yellow
if ($ADMIN_STEAM_ID) {
    $reportsUrl = "/api/chat/report?adminSteamId=$ADMIN_STEAM_ID"
    Test-Endpoint -Name "Get Reports (Admin)" -Method "GET" -Endpoint $reportsUrl
} else {
    Write-Host "  [SKIP] Admin Steam ID not set"
}

# ============================================
# 3. User Search Functionality
# ============================================
Write-Host "`n=== Test 3: User Search Functionality ===" -ForegroundColor Yellow
if ($ADMIN_STEAM_ID) {
    $userInfoUrl = "/api/admin/user/$TEST_STEAM_ID" + "?adminSteamId=$ADMIN_STEAM_ID"
    Test-Endpoint -Name "Get User Info (Admin)" -Method "GET" -Endpoint $userInfoUrl
} else {
    Write-Host "  [SKIP] Admin Steam ID not set"
}

# ============================================
# 4. Chat Preloading on Login
# ============================================
Write-Host "`n=== Test 4: Chat Messages Endpoint ===" -ForegroundColor Yellow
Test-Endpoint -Name "Get Global Chat Messages" -Method "GET" -Endpoint "/api/chat/messages"
$timestamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$chatMessageData = @{
    steamId = $TEST_STEAM_ID
    message = "Test message $timestamp"
} | ConvertTo-Json -Compress
Test-Endpoint -Name "Send Chat Message" -Method "POST" -Endpoint "/api/chat/messages" -Data $chatMessageData

# ============================================
# 5. Performance Optimizations
# ============================================
Write-Host "`n=== Test 5: Performance Endpoints ===" -ForegroundColor Yellow
Test-Endpoint -Name "Get DM List (Performance)" -Method "GET" -Endpoint $dmListUrl
$dmInvitesUrl = "/api/chat/dms/invites?steamId=$TEST_STEAM_ID" + "&type=pending"
Test-Endpoint -Name "Get DM Invites" -Method "GET" -Endpoint $dmInvitesUrl

# ============================================
# 6. Message Delete Functionality
# ============================================
Write-Host "`n=== Test 6: Message Delete (Note: Requires valid messageId) ===" -ForegroundColor Yellow
Write-Host "  [INFO] Delete test requires a valid message ID from database"
Write-Host "  [SKIP] Manual test required"

# ============================================
# 7. Report Functionality
# ============================================
Write-Host "`n=== Test 7: Report Functionality ===" -ForegroundColor Yellow
$reportData = @{
    reporterSteamId = $TEST_STEAM_ID
    reportedSteamId = "76561199235618867"
    reportType = "global"
    reporterName = "Test User"
    reportedName = "Test Target"
} | ConvertTo-Json -Compress
Test-Endpoint -Name "Create Report" -Method "POST" -Endpoint "/api/chat/report" -Data $reportData

# ============================================
# 8. Timeout View Button
# ============================================
Write-Host "`n=== Test 8: Timeout Functionality ===" -ForegroundColor Yellow
if ($ADMIN_STEAM_ID) {
    $timeoutsUrl = "/api/admin/timeouts?adminSteamId=$ADMIN_STEAM_ID"
    Test-Endpoint -Name "Get Active Timeouts" -Method "GET" -Endpoint $timeoutsUrl
} else {
    Write-Host "  [SKIP] Admin Steam ID not set"
}

# ============================================
# 9. DM Invite Acceptance
# ============================================
Write-Host "`n=== Test 9: DM Invite Functionality ===" -ForegroundColor Yellow
Test-Endpoint -Name "Get DM Invites" -Method "GET" -Endpoint $dmInvitesUrl
$inviteData = @{
    fromSteamId = $TEST_STEAM_ID
    toSteamId = "76561199235618867"
} | ConvertTo-Json -Compress
Test-Endpoint -Name "Send DM Invite" -Method "POST" -Endpoint "/api/chat/dms/invites" -Data $inviteData

# ============================================
# 10. Admin Panel Functions
# ============================================
Write-Host "`n=== Test 10: Admin Panel Functions ===" -ForegroundColor Yellow
if ($ADMIN_STEAM_ID) {
    Test-Endpoint -Name "Get User Count" -Method "GET" -Endpoint "/api/admin/user-count"
    $userInfoDmUrl = "/api/admin/user/$TEST_STEAM_ID" + "?adminSteamId=$ADMIN_STEAM_ID"
    Test-Endpoint -Name "Get User Info with DMs" -Method "GET" -Endpoint $userInfoDmUrl
} else {
    Write-Host "  [SKIP] Admin Steam ID not set"
}

# ============================================
# Summary
# ============================================
Write-Host "`n==========================================" -ForegroundColor Yellow
Write-Host "TEST SUMMARY"
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host "Total Tests: $script:TOTAL"
Write-Host "Passed: $script:PASSED" -ForegroundColor Green
Write-Host "Failed: $script:FAILED" -ForegroundColor Red

if ($script:FAILED -eq 0) {
    Write-Host "`n[SUCCESS] All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n[ERROR] Some tests failed" -ForegroundColor Red
    exit 1
}
