$secret = "2a6d54a2cd2e12e5835412b9685fee46d751d4533c04ca5a6d002fdd3ab7bf51"

$base = "https://www.skinvaults.online"



$limit = 80

$requestsPerCurrency = 120

$sleepBetweenRequestsSeconds = 30



function Invoke-CronSafe {

    param(

        [Parameter(Mandatory = $true)][string]$Url

    )



    $maxAttempts = 30

    $attempt = 0

    $delay = 2



    while ($attempt -lt $maxAttempts) {

        $attempt++

        try {

            return Invoke-RestMethod -Headers @{ Authorization = "Bearer $secret" } -Uri $Url -Method GET -TimeoutSec 30

        } catch {

            $msg = $_.Exception.Message

            $body = $null

            try {

                if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {

                    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())

                    $body = $reader.ReadToEnd()

                }

            } catch { }



            $combined = "$msg $body"

            $isTimeout = $combined -match "FUNCTION_INVOCATION_TIMEOUT" -or $combined -match "deployment" -or $combined -match "timeout"



            if ($attempt -ge $maxAttempts) {

                Write-Host "Request failed after $attempt attempts: $Url" -ForegroundColor Red

                if ($body) { Write-Host $body }

                return $null

            }



            if ($isTimeout) {

                Write-Host "Transient timeout/deployment error (attempt $attempt/$maxAttempts). Backing off ${delay}s..." -ForegroundColor Yellow

            } else {

                Write-Host "Request error (attempt $attempt/$maxAttempts). Backing off ${delay}s..." -ForegroundColor Yellow

            }

            Start-Sleep -Seconds $delay

            $delay = [Math]::Min($delay * 2, 30)

        }

    }



    return $null

}



while ($true) {

    Write-Host "Starting update cycle at $(Get-Date)" -ForegroundColor Cyan



    # EUR

    Write-Host "Processing EUR..."

    for ($i = 0; $i -lt $requestsPerCurrency; $i++) {

        $url = "$base/api/cron/market-prices?currency=3&limit=$limit"

        $res = Invoke-CronSafe -Url $url

        if ($res) {

            Write-Host ("EUR: start={0} processed={1} ok={2} failed={3} nextStart={4} finished={5}" -f $res.start, $res.processed, $res.ok, $res.failed, $res.nextStart, $res.finished)

        }

        Start-Sleep -Seconds $sleepBetweenRequestsSeconds

    }



    # USD

    Write-Host "Processing USD..."

    for ($i = 0; $i -lt $requestsPerCurrency; $i++) {

        $url = "$base/api/cron/market-prices?currency=1&limit=$limit"

        $res = Invoke-CronSafe -Url $url

        if ($res) {

            Write-Host ("USD: start={0} processed={1} ok={2} failed={3} nextStart={4} finished={5}" -f $res.start, $res.processed, $res.ok, $res.failed, $res.nextStart, $res.finished)

        }

        Start-Sleep -Seconds $sleepBetweenRequestsSeconds

    }



    Write-Host "Cycle complete. Sleeping for 5 minutes..." -ForegroundColor Green

    Start-Sleep -Seconds 300

}