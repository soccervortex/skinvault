# PowerShell script to test chat API performance
# Usage: .\test-chat-api.ps1

$baseUrl = "https://www.skinvaults.online"

Write-Host "Testing Chat API Performance..." -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Global chat messages
Write-Host "1. Testing Global Chat Messages..." -ForegroundColor Yellow
$startTime = Get-Date
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/chat/messages?limit=50" -Method GET -UseBasicParsing -TimeoutSec 10
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalMilliseconds
    Write-Host "  Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "  Time: $([math]::Round($duration, 2))ms" -ForegroundColor Green
} catch {
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: DM messages endpoint (will fail without auth, but tests endpoint)
Write-Host "2. Testing DM Messages endpoint..." -ForegroundColor Yellow
$startTime = Get-Date
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/chat/dms?steamId1=test1&steamId2=test2&currentUserId=test1" -Method GET -UseBasicParsing -TimeoutSec 10
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalMilliseconds
    Write-Host "  Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "  Time: $([math]::Round($duration, 2))ms" -ForegroundColor Green
} catch {
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalMilliseconds
    if ($_.Exception.Response.StatusCode -eq 400 -or $_.Exception.Response.StatusCode -eq 403) {
        Write-Host "  Status: $($_.Exception.Response.StatusCode) (Expected - auth required)" -ForegroundColor Yellow
        Write-Host "  Time: $([math]::Round($duration, 2))ms" -ForegroundColor Green
    } else {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

# Test 3: DM list
Write-Host "3. Testing DM List endpoint..." -ForegroundColor Yellow
$startTime = Get-Date
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/chat/dms/list?steamId=test" -Method GET -UseBasicParsing -TimeoutSec 10
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalMilliseconds
    Write-Host "  Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "  Time: $([math]::Round($duration, 2))ms" -ForegroundColor Green
} catch {
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalMilliseconds
    if ($_.Exception.Response.StatusCode -eq 400 -or $_.Exception.Response.StatusCode -eq 403) {
        Write-Host "  Status: $($_.Exception.Response.StatusCode) (Expected - auth required)" -ForegroundColor Yellow
        Write-Host "  Time: $([math]::Round($duration, 2))ms" -ForegroundColor Green
    } else {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "Performance test complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Expected results:" -ForegroundColor Cyan
Write-Host "- Response times should be < 1000ms for most requests" -ForegroundColor White
Write-Host "- Connection pooling should make subsequent requests faster" -ForegroundColor White
Write-Host "- Status codes: 200 (success) or 400/403 (auth required)" -ForegroundColor White

