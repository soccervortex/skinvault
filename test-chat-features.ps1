# Chat System Test Script
# Tests all new chat features with curl/API calls

$baseUrl = "https://www.skinvaults.online"
$testSteamId1 = "76561198758560045"
$testSteamId2 = "76561199235618867"
$adminKey = $env:ADMIN_PRO_TOKEN

Write-Host "=== Chat System Feature Tests ===" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl" -ForegroundColor Gray
Write-Host ""

$passed = 0
$failed = 0
$skipped = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [int]$ExpectedStatus = 200
    )
    
    Write-Host "Testing: $Name" -ForegroundColor Yellow
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            ContentType = "application/json"
        }
        
        if ($Body) {
            $params.Body = $Body
        }
        
        $response = Invoke-WebRequest @params -UseBasicParsing -ErrorAction Stop
        $statusCode = $response.StatusCode
        
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "  PASSED (HTTP $statusCode)" -ForegroundColor Green
            $script:passed++
            return $true
        } else {
            Write-Host "  FAILED (Expected $ExpectedStatus, got $statusCode)" -ForegroundColor Red
            $script:failed++
            return $false
        }
    } catch {
        $statusCode = $null
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
        }
        
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "  PASSED (HTTP $statusCode)" -ForegroundColor Green
            $script:passed++
            return $true
        } else {
            if ($statusCode) {
                Write-Host "  FAILED (Expected $ExpectedStatus, got $statusCode)" -ForegroundColor Red
            } else {
                Write-Host "  FAILED (Expected $ExpectedStatus, connection error)" -ForegroundColor Red
            }
            Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
            $script:failed++
            return $false
        }
    }
}

# Test 1: Get Global Chat Messages
Test-Endpoint -Name "Get Global Chat Messages" -Method "GET" -Url "$baseUrl/api/chat/messages"

# Test 2: Send Global Chat Message
$testMessage = "Test message $(Get-Date -Format 'HH:mm:ss')"
$body1 = @{steamId = $testSteamId1; message = $testMessage} | ConvertTo-Json
Test-Endpoint -Name "Send Global Chat Message" -Method "POST" -Url "$baseUrl/api/chat/messages" -Body $body1 -ExpectedStatus 200

# Test 3: Get DM List
Test-Endpoint -Name "Get DM List" -Method "GET" -Url "$baseUrl/api/chat/dms/list?steamId=$testSteamId1"

# Test 4: Get DM Invites
Test-Endpoint -Name "Get DM Invites" -Method "GET" -Url "$baseUrl/api/chat/dms/invites?steamId=$testSteamId1&type=pending"

# Test 5: Send DM Invite
$body2 = @{fromSteamId = $testSteamId1; toSteamId = $testSteamId2} | ConvertTo-Json
Test-Endpoint -Name "Send DM Invite" -Method "POST" -Url "$baseUrl/api/chat/dms/invites" -Body $body2 -ExpectedStatus 200

# Test 6: Check Ban Status
$headers1 = @{"x-admin-key" = $adminKey}
Test-Endpoint -Name "Check Ban Status" -Method "GET" -Url "$baseUrl/api/admin/ban?steamId=$testSteamId1" -Headers $headers1

# Test 7: Get Chat Control Status
Test-Endpoint -Name "Get Chat Control Status" -Method "GET" -Url "$baseUrl/api/admin/chat-control?adminSteamId=$testSteamId2"

# Test 8: Toggle Global Chat Disable
$body3 = @{globalChatDisabled = $false} | ConvertTo-Json
$headers2 = @{"Content-Type" = "application/json"}
Test-Endpoint -Name "Toggle Global Chat Disable" -Method "POST" -Url "$baseUrl/api/admin/chat-control?adminSteamId=$testSteamId2" -Body $body3 -Headers $headers2

# Test 9: Toggle DM Chat Disable
$body4 = @{dmChatDisabled = $false} | ConvertTo-Json
Test-Endpoint -Name "Toggle DM Chat Disable" -Method "POST" -Url "$baseUrl/api/admin/chat-control?adminSteamId=$testSteamId2" -Body $body4 -Headers $headers2

# Test 10: Get Reports
Test-Endpoint -Name "Get Reports" -Method "GET" -Url "$baseUrl/api/chat/report?adminSteamId=$testSteamId2"

# Test 11: Create Report
$body5 = @{
    reporterSteamId = $testSteamId1
    reporterName = "Test User"
    reportedSteamId = $testSteamId2
    reportedName = "Test Admin"
    reportType = "global"
} | ConvertTo-Json
Test-Endpoint -Name "Create Report" -Method "POST" -Url "$baseUrl/api/chat/report" -Body $body5 -Headers $headers2

# Test 12: Get User Count
Test-Endpoint -Name "Get User Count" -Method "GET" -Url "$baseUrl/api/admin/user-count" -Headers $headers1

# Test 13: Get Timeouts
Test-Endpoint -Name "Get Timeouts" -Method "GET" -Url "$baseUrl/api/admin/timeouts?adminSteamId=$testSteamId2"

Write-Host ""
Write-Host "=== Test Results ===" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
if ($failed -eq 0) {
    Write-Host "Failed: $failed" -ForegroundColor Green
} else {
    Write-Host "Failed: $failed" -ForegroundColor Red
}
Write-Host "Skipped: $skipped" -ForegroundColor Yellow
Write-Host ""

if ($failed -eq 0) {
    Write-Host "All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests failed. Please review the errors above." -ForegroundColor Red
    exit 1
}
