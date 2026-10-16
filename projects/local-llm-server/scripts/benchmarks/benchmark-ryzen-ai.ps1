param(
    [int]$Tokens = 50,
    [int]$Runs = 3,
    [string]$TestName = "Baseline"
)

Write-Host "Ryzen AI 300 Baseline Benchmark" -ForegroundColor Cyan
Write-Host "Test: $TestName" -ForegroundColor Yellow
Write-Host "Tokens per test: $Tokens" -ForegroundColor Yellow
Write-Host "Number of runs: $Runs" -ForegroundColor Yellow

# Test prompts
$testPrompts = @(
    "Generate a fantasy tavern scene:",
    "Write a dialogue between characters:",
    "Describe a mysterious encounter:"
)

$results = @()

for ($i = 0; $i -lt $Runs; $i++) {
    $prompt = $testPrompts[$i % $testPrompts.Length]
    Write-Host "Run $($i+1)/$Runs - $prompt" -ForegroundColor Gray

    $startTime = Get-Date
    try {
        $jsonBody = @{
            prompt = $prompt
            max_length = $Tokens
            temperature = 0.7
            top_p = 0.9
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "http://127.0.0.1:5001/api/v1/generate" `
            -Method Post `
            -Body $jsonBody `
            -ContentType "application/json" `
            -TimeoutSec 60

        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalSeconds

        # Check if response has text or data
        $outputLength = 0
        if ($response.text) {
            $outputLength = $response.text.Length
        } elseif ($response.data) {
            $outputLength = $response.data.Length
        }

        $tps = if ($duration -gt 0) { $Tokens / $duration } else { 0 }

        $results += @{
            Run = $i + 1
            TPS = $tps
            Duration = $duration
            OutputLength = $outputLength
            Success = $true
        }

        Write-Host "  Success: $($tps.ToString('F2')) TPS ($($duration.ToString('F2'))s)" -ForegroundColor Green
    }
    catch {
        $results += @{
            Run = $i + 1
            TPS = 0
            Duration = 0
            Success = $false
            Error = $_.Exception.Message
        }
        Write-Host "  Failed: $($_.Exception.Message)" -ForegroundColor Red
    }

    Start-Sleep -Seconds 1
}

# Calculate results
$successfulRuns = $results | Where-Object { $_.Success }
$avgTPS = 0
if ($successfulRuns.Count -gt 0) {
    $avgTPS = ($successfulRuns | Measure-Object -Property TPS -Average).Average
}

Write-Host ""
Write-Host "Results:" -ForegroundColor Cyan
if ($successfulRuns.Count -gt 0) {
    Write-Host "Average TPS: $($avgTPS.ToString('F2'))" -ForegroundColor Yellow
} else {
    Write-Host "No successful runs" -ForegroundColor Red
}

# Save results
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$result = @{
    TestName = $TestName
    AverageTPS = $avgTPS
    Results = $results
}

$filename = "performance\$($TestName.ToLower() -replace ' ', '_')_$timestamp.json"
$result | ConvertTo-Json -Depth 3 | Out-File $filename

Write-Host "Saved to: $filename" -ForegroundColor Green

return $result