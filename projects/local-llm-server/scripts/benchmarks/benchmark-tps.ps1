# Quick TPS Benchmark for llama-server API
# Measures prompt processing and generation speed via HTTP API

param(
    [int]$NumTests = 3,
    [int]$GenerateTokens = 100,
    [string]$ServerHost = "127.0.0.1",
    [int]$Port = 5001
)

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  llama-server API TPS Benchmark" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory (project root)
$SCRIPT_DIR = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $SCRIPT_DIR

# Load configuration for display
$configPath = "$SCRIPT_DIR\config\env.auto"
if (Test-Path $configPath) {
    $config = @{}
    Get-Content $configPath | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $config[$matches[1]] = $matches[2]
        }
    }
    
    # Override host/port from config if not specified
    if ($ServerHost -eq "127.0.0.1" -and $config['LLM_HOST']) {
        $ServerHost = $config['LLM_HOST']
    }
    if ($Port -eq 5001 -and $config['LLM_PORT']) {
        $Port = $config['LLM_PORT']
    }
}

$apiUrl = "http://$($ServerHost):$($Port)"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  API Endpoint: $apiUrl" -ForegroundColor Gray
Write-Host "  Max Tokens: $GenerateTokens" -ForegroundColor Gray
Write-Host ""

# Check if server is running
Write-Host "Checking server status..." -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$apiUrl/health" -Method Get -TimeoutSec 5 -ErrorAction Stop | Out-Null
    Write-Host "  [OK] Server is running" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Cannot connect to llama-server at $apiUrl" -ForegroundColor Red
    Write-Host "  [INFO] Please start the server first using:" -ForegroundColor Yellow
    Write-Host "         .\start-llama-server.ps1" -ForegroundColor Gray
    exit 1
}
Write-Host ""

# Test prompts
$testPrompts = @(
    "Write a short story about a robot:",
    "Explain quantum computing in simple terms:",
    "Describe a beautiful sunset:"
)

$results = @()

Write-Host "Running $NumTests benchmark tests..." -ForegroundColor Yellow
Write-Host ""

for ($i = 0; $i -lt $NumTests; $i++) {
    $prompt = $testPrompts[$i % $testPrompts.Length]
    Write-Host "Test $($i+1)/$NumTests : $prompt" -ForegroundColor Cyan
    
    # Prepare API request
    $requestBody = @{
        prompt = $prompt
        n_predict = $GenerateTokens
        temperature = 0.8
        top_p = 0.9
        stream = $false
    } | ConvertTo-Json
    
    # Measure request time
    $startTime = Get-Date
    
    try {
        # Send completion request
        $response = Invoke-RestMethod -Uri "$apiUrl/completion" -Method Post -Body $requestBody -ContentType "application/json" -TimeoutSec 120
        
        $endTime = Get-Date
        $totalTime = ($endTime - $startTime).TotalSeconds
        
        # Parse response metrics
        $promptTokens = if ($response.tokens_evaluated) { $response.tokens_evaluated } else { 0 }
        $generatedTokens = if ($response.tokens_predicted) { $response.tokens_predicted } else { 0 }
        
        # Calculate rates
        $promptEvalTime = if ($response.timings.prompt_ms) { $response.timings.prompt_ms / 1000 } else { 0 }
        $genTime = if ($response.timings.predicted_ms) { $response.timings.predicted_ms / 1000 } else { $totalTime }
        
        $promptEvalRate = if ($promptEvalTime -gt 0) { $promptTokens / $promptEvalTime } else { 0 }
        $evalRate = if ($genTime -gt 0) { $generatedTokens / $genTime } else { 0 }
        
        # Debug: Show response for first test
        if ($i -eq 0) {
            Write-Host "  [DEBUG] Response timings:" -ForegroundColor Magenta
            Write-Host "    Prompt eval: $($response.timings.prompt_ms) ms" -ForegroundColor DarkGray
            Write-Host "    Generation: $($response.timings.predicted_ms) ms" -ForegroundColor DarkGray
            Write-Host "    Total: $($response.timings.total_ms) ms" -ForegroundColor DarkGray
        }
        
        $results += [PSCustomObject]@{
            Test = $i + 1
            Prompt = $prompt
            PromptTokens = $promptTokens
            PromptEvalRate = $promptEvalRate
            GeneratedTokens = $generatedTokens
            EvalRate = $evalRate
            TotalTime = $totalTime
        }
        
        Write-Host "  Prompt Processing: $($promptEvalRate.ToString('F1')) tokens/s ($promptTokens tokens)" -ForegroundColor Green
        Write-Host "  Generation: $($evalRate.ToString('F1')) tokens/s ($generatedTokens tokens)" -ForegroundColor Green
        Write-Host "  Total Time: $($totalTime.ToString('F2')) seconds" -ForegroundColor Green
        
    } catch {
        Write-Host "  [ERROR] Request failed: $($_.Exception.Message)" -ForegroundColor Red
        $results += [PSCustomObject]@{
            Test = $i + 1
            Prompt = $prompt
            PromptTokens = 0
            PromptEvalRate = 0
            GeneratedTokens = 0
            EvalRate = 0
            TotalTime = 0
            Error = $_.Exception.Message
        }
    }
    
    Write-Host ""
}

# Calculate averages (only for successful tests)
$successfulResults = $results | Where-Object { $_.EvalRate -gt 0 }

if ($successfulResults.Count -gt 0) {
    $avgPromptRate = ($successfulResults | Measure-Object -Property PromptEvalRate -Average).Average
    $avgGenRate = ($successfulResults | Measure-Object -Property EvalRate -Average).Average
    $avgTotalTime = ($successfulResults | Measure-Object -Property TotalTime -Average).Average
    
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host "  Benchmark Results" -ForegroundColor Cyan
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Successful Tests: $($successfulResults.Count)/$NumTests" -ForegroundColor Yellow
    Write-Host "Average Prompt Processing: $($avgPromptRate.ToString('F1')) tokens/s" -ForegroundColor Yellow
    Write-Host "Average Generation: $($avgGenRate.ToString('F1')) tokens/s" -ForegroundColor Yellow
    Write-Host "Average Total Time: $($avgTotalTime.ToString('F2')) seconds" -ForegroundColor Yellow
    Write-Host ""
    
    # Save results
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $resultData = @{
        Timestamp = $timestamp
        Configuration = @{
            APIEndpoint = $apiUrl
            MaxTokens = $GenerateTokens
            SuccessfulTests = $successfulResults.Count
            TotalTests = $NumTests
        }
        Results = $results
        Averages = @{
            PromptProcessing = $avgPromptRate
            Generation = $avgGenRate
            TotalTime = $avgTotalTime
        }
    }
    
    # Save JSON results
    $jsonFilename = "performance\benchmark_tps_$timestamp.json"
    New-Item -ItemType Directory -Path "performance" -Force | Out-Null
    $resultData | ConvertTo-Json -Depth 4 | Out-File $jsonFilename
    
    # Save Markdown report
    $mdFilename = "tests\benchmarks\benchmark_$timestamp.md"
    New-Item -ItemType Directory -Path "tests\benchmarks" -Force | Out-Null
    
    $dateFormatted = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    $markdownContent = @"
# LLM Benchmark Results

**Date:** $dateFormatted
**API Endpoint:** $apiUrl
**Max Tokens:** $GenerateTokens

## Summary

| Metric | Value |
|--------|-------|
| Successful Tests | $($successfulResults.Count)/$NumTests |
| Average Prompt Processing | $($avgPromptRate.ToString('F1')) tokens/s |
| Average Generation | $($avgGenRate.ToString('F1')) tokens/s |
| Average Total Time | $($avgTotalTime.ToString('F2')) seconds |

## Configuration

| Parameter | Value |
|-----------|-------|
| API Endpoint | $apiUrl |
| Max Tokens per Test | $GenerateTokens |
| Number of Tests | $NumTests |
"@

    if ($config) {
        $markdownContent += @"

| GPU Layers | $($config['LLM_GPULAYERS']) |
| Flash Attention | $($config['LLM_FLASH_ATTENTION']) |
| Context Size | $($config['LLM_CTX']) |
| Threads | $($config['LLM_THREADS']) |
"@
    }

    $markdownContent += @"


## Individual Test Results

| Test | Prompt | Prompt Tokens | Prompt Rate (t/s) | Generated Tokens | Generation Rate (t/s) | Total Time (s) |
|------|--------|---------------|-------------------|------------------|-----------------------|----------------|
"@

    foreach ($result in $results) {
        if ($result.Error) {
            $markdownContent += "`n| $($result.Test) | $($result.Prompt) | ERROR | ERROR | ERROR | ERROR | ERROR |"
        } else {
            $markdownContent += "`n| $($result.Test) | $($result.Prompt) | $($result.PromptTokens) | $($result.PromptEvalRate.ToString('F1')) | $($result.GeneratedTokens) | $($result.EvalRate.ToString('F1')) | $($result.TotalTime.ToString('F2')) |"
        }
    }

    $markdownContent += @"


## Performance Analysis

### Prompt Processing
- **Average Rate:** $($avgPromptRate.ToString('F1')) tokens/s
- **Min Rate:** $(($successfulResults | Measure-Object -Property PromptEvalRate -Minimum).Minimum.ToString('F1')) tokens/s
- **Max Rate:** $(($successfulResults | Measure-Object -Property PromptEvalRate -Maximum).Maximum.ToString('F1')) tokens/s

### Token Generation
- **Average Rate:** $($avgGenRate.ToString('F1')) tokens/s
- **Min Rate:** $(($successfulResults | Measure-Object -Property EvalRate -Minimum).Minimum.ToString('F1')) tokens/s
- **Max Rate:** $(($successfulResults | Measure-Object -Property EvalRate -Maximum).Maximum.ToString('F1')) tokens/s

### Total Time
- **Average:** $($avgTotalTime.ToString('F2')) seconds
- **Min:** $(($successfulResults | Measure-Object -Property TotalTime -Minimum).Minimum.ToString('F2')) seconds
- **Max:** $(($successfulResults | Measure-Object -Property TotalTime -Maximum).Maximum.ToString('F2')) seconds

---
*Generated by benchmark-tps.ps1*
"@

    $markdownContent | Out-File $mdFilename -Encoding UTF8
    
    Write-Host "Results saved to:" -ForegroundColor Green
    Write-Host "  JSON: $jsonFilename" -ForegroundColor Gray
    Write-Host "  Markdown: $mdFilename" -ForegroundColor Gray
    Write-Host ""
    
    return $resultData
} else {
    Write-Host "=====================================================" -ForegroundColor Red
    Write-Host "  Benchmark Failed" -ForegroundColor Red
    Write-Host "=====================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "All tests failed. Please check:" -ForegroundColor Yellow
    Write-Host "  1. Is llama-server running?" -ForegroundColor Gray
    Write-Host "  2. Is the API endpoint correct? ($apiUrl)" -ForegroundColor Gray
    Write-Host "  3. Check server logs for errors" -ForegroundColor Gray
    Write-Host ""
    exit 1
}