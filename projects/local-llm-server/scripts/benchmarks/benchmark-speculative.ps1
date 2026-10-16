# Benchmark Speculative Decoding
# Compares generation speed with and without speculative decoding
# Uses question/answer pairs from a dataset folder as test prompts.
# Set LLAMA_MAIN_MODEL and LLAMA_DRAFT_MODEL (paths to .gguf files), or pass the parameters.
# BENCHMARK_DATASET_PATH is optional; the default is examples/benchmark-dataset.

param(
    [string]$MainModel = $env:LLAMA_MAIN_MODEL,
    [string]$DraftModel = $env:LLAMA_DRAFT_MODEL,
    [string]$DatasetPath = $(if ($env:BENCHMARK_DATASET_PATH) { $env:BENCHMARK_DATASET_PATH } else { Join-Path $PSScriptRoot "../../examples/benchmark-dataset" }),
    [int]$NumSamples = 20,
    [int]$MaxTokens = 256,
    [int]$Port = 5001,
    [switch]$SkipBaseline,
    [switch]$SkipSpeculative
)

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Speculative Decoding Benchmark" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Main Model:  $(Split-Path $MainModel -Leaf)" -ForegroundColor Gray
Write-Host "  Draft Model: $(Split-Path $DraftModel -Leaf)" -ForegroundColor Gray
Write-Host "  Samples:     $NumSamples" -ForegroundColor Gray
Write-Host "  Max Tokens:  $MaxTokens" -ForegroundColor Gray
Write-Host ""

# Verify models exist
if (-not (Test-Path $MainModel)) {
    Write-Host "[ERROR] Main model not found: $MainModel" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $DraftModel)) {
    Write-Host "[ERROR] Draft model not found: $DraftModel" -ForegroundColor Red
    exit 1
}

# Load QA prompts from dataset
Write-Host "[1/5] Loading QA prompts from dataset..." -ForegroundColor Yellow
$qaFiles = Get-ChildItem "$DatasetPath\*.json" | Sort-Object Name | Select-Object -First $NumSamples

$prompts = @()
foreach ($file in $qaFiles) {
    try {
        $qa = Get-Content $file.FullName -Raw | ConvertFrom-Json

        # Build prompt from context
        $context = $qa.input.context
        $character = $context.character
        $environment = $context.environment
        $intent = $qa.input.intent

        $prompt = @"
You are an AI game master for an RPG. Given the following context, provide a response.

SITUATION: $($context.situation)

CHARACTER:
- Name: $($character.name)
- Location: $($character.location)
- Personality: $($character.personality.traits -join ", ")
- Values: $($character.personality.values -join ", ")
- Background: $($character.background)

ENVIRONMENT: $($environment.name) - $($environment.description)
Conditions: Lighting=$($environment.conditions.lighting), Crowd=$($environment.conditions.crowd), Danger=$($environment.conditions.danger)

QUESTION: $intent

Provide your reasoning and decision in JSON format with 'reasoning' and 'updated_parameters' fields.
"@

        $prompts += @{
            name = $file.BaseName
            prompt = $prompt
            expected = $qa.output
        }
    } catch {
        Write-Host "  [WARN] Skipping $($file.Name): $_" -ForegroundColor Yellow
    }
}

Write-Host "  Loaded $($prompts.Count) prompts" -ForegroundColor Green
Write-Host ""

# Function to run inference and measure performance
function Invoke-Benchmark {
    param(
        [string]$Name,
        [array]$Prompts,
        [int]$MaxTokens,
        [int]$Port
    )

    $results = @{
        name = $Name
        samples = @()
        total_prompt_tokens = 0
        total_generation_tokens = 0
        total_prompt_time_ms = 0
        total_generation_time_ms = 0
        errors = 0
    }

    $apiUrl = "http://127.0.0.1:$Port/completion"

    foreach ($p in $Prompts) {
        Write-Host "    Testing: $($p.name)..." -NoNewline

        $stopTokens = @('```', '<|eot_id|>')
        $body = @{
            prompt = $p.prompt
            n_predict = $MaxTokens
            temperature = 0.7
            stop = $stopTokens
            cache_prompt = $true
        } | ConvertTo-Json -Depth 3

        try {
            $startTime = Get-Date
            $response = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $body -ContentType "application/json" -TimeoutSec 120
            $endTime = Get-Date

            $totalTime = ($endTime - $startTime).TotalMilliseconds

            # Extract metrics from response
            $promptTokens = if ($response.tokens_evaluated) { $response.tokens_evaluated } else { 0 }
            $genTokens = if ($response.tokens_predicted) { $response.tokens_predicted } else { 0 }
            $promptTps = if ($response.timings.prompt_per_second) { $response.timings.prompt_per_second } else { 0 }
            $genTps = if ($response.timings.predicted_per_second) { $response.timings.predicted_per_second } else { 0 }

            $results.samples += @{
                name = $p.name
                prompt_tokens = $promptTokens
                generation_tokens = $genTokens
                prompt_tps = [Math]::Round($promptTps, 2)
                generation_tps = [Math]::Round($genTps, 2)
                total_time_ms = [Math]::Round($totalTime, 0)
            }

            $results.total_prompt_tokens += $promptTokens
            $results.total_generation_tokens += $genTokens

            $tpsRounded = [Math]::Round($genTps, 1)
            Write-Host " $genTokens tok @ $tpsRounded t/s" -ForegroundColor Green

        } catch {
            Write-Host " ERROR: $_" -ForegroundColor Red
            $results.errors++
        }
    }

    return $results
}

# Function to start llama-server
function Start-TestServer {
    param(
        [string]$Model,
        [string]$DraftModel = $null,
        [int]$Port,
        [bool]$Speculative = $false
    )

    # Kill any existing server
    Get-Process -Name "llama-server" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2

    # Detect GPU and select binary
    $allGPUs = Get-CimInstance -ClassName Win32_VideoController | Where-Object { $_.Name -notlike "*Microsoft*" }
    $nvidiaGPU = $allGPUs | Where-Object { $_.Name -like "*NVIDIA*" -or $_.Name -like "*RTX*" -or $_.Name -like "*GTX*" } | Select-Object -First 1

    if ($nvidiaGPU) {
        $LLAMA_BIN = "$SCRIPT_DIR\llamacpp\bin\llama-b6829-bin-win-cuda-12.4-x64"
    } else {
        $amdGPU = $allGPUs | Where-Object { $_.Name -like "*Radeon*" -or $_.Name -like "*AMD*" } | Select-Object -First 1
        if ($amdGPU) {
            $LLAMA_BIN = "$SCRIPT_DIR\llamacpp\bin\llama-b6829-bin-win-vulkan-x64"
        } else {
            $LLAMA_BIN = "$SCRIPT_DIR\llamacpp\bin\llama-b6829-bin-win-cpu-x64"
        }
    }

    # Build arguments
    $llamaArgs = @(
        "-m", $Model,
        "-ngl", "99",
        "-c", "4096",
        "-t", "8",
        "--host", "127.0.0.1",
        "--port", $Port.ToString(),
        "-b", "1024",
        "-ub", "512",
        "--parallel", "1"
    )

    # Add speculative decoding if enabled
    if ($Speculative -and $DraftModel) {
        $llamaArgs += @(
            "-md", $DraftModel,
            "--draft-max", "16",
            "--draft-min", "4",
            "--draft-p-min", "0.9",
            "-ngld", "99"
        )
    }

    # Ensure logs directory
    if (-not (Test-Path "$SCRIPT_DIR\logs")) {
        New-Item -ItemType Directory -Path "$SCRIPT_DIR\logs" | Out-Null
    }

    # Start server
    $process = Start-Process -FilePath "$LLAMA_BIN\llama-server.exe" `
        -ArgumentList $llamaArgs `
        -PassThru `
        -NoNewWindow `
        -RedirectStandardOutput "$SCRIPT_DIR\logs\benchmark-server.log" `
        -RedirectStandardError "$SCRIPT_DIR\logs\benchmark-server-error.log"

    # Wait for server to be ready
    $maxWait = 120
    $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 1
        $waited++

        try {
            $null = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
            return $process
        } catch {
            # Not ready yet
        }

        if ($process.HasExited) {
            Write-Host "[ERROR] Server process died" -ForegroundColor Red
            return $null
        }

        if ($waited % 10 -eq 0) {
            Write-Host ("  Waiting for server... (" + $waited + "s)") -ForegroundColor Gray
        }
    }

    Write-Host ("[ERROR] Server failed to start within " + $maxWait + "s") -ForegroundColor Red
    return $null
}

# Results storage
$baselineResults = $null
$speculativeResults = $null

# Run baseline benchmark (without speculative decoding)
if (-not $SkipBaseline) {
    Write-Host "[2/5] Starting baseline benchmark (no speculative decoding)..." -ForegroundColor Yellow
    Write-Host "  Starting server with main model only..." -ForegroundColor Gray

    $serverProcess = Start-TestServer -Model $MainModel -Port $Port -Speculative $false
    if (-not $serverProcess) {
        Write-Host "[ERROR] Failed to start baseline server" -ForegroundColor Red
        exit 1
    }

    Write-Host "  Server ready! Running benchmark..." -ForegroundColor Green
    $baselineResults = Invoke-Benchmark -Name "Baseline (no draft)" -Prompts $prompts -MaxTokens $MaxTokens -Port $Port

    # Stop server
    $serverProcess | Stop-Process -Force
    Start-Sleep -Seconds 3

    Write-Host ""
}

# Run speculative benchmark
if (-not $SkipSpeculative) {
    Write-Host "[3/5] Starting speculative decoding benchmark..." -ForegroundColor Yellow
    Write-Host "  Starting server with main + draft model..." -ForegroundColor Gray

    $serverProcess = Start-TestServer -Model $MainModel -DraftModel $DraftModel -Port $Port -Speculative $true
    if (-not $serverProcess) {
        Write-Host "[ERROR] Failed to start speculative server" -ForegroundColor Red
        exit 1
    }

    Write-Host "  Server ready! Running benchmark..." -ForegroundColor Green
    $speculativeResults = Invoke-Benchmark -Name "Speculative (draft)" -Prompts $prompts -MaxTokens $MaxTokens -Port $Port

    # Stop server
    $serverProcess | Stop-Process -Force
    Write-Host ""
}

# Calculate and display results
Write-Host "[4/5] Calculating results..." -ForegroundColor Yellow
Write-Host ""

function Show-Results {
    param($results)

    if (-not $results -or $results.samples.Count -eq 0) { return }

    $avgPromptTps = ($results.samples | Measure-Object -Property prompt_tps -Average).Average
    $avgGenTps = ($results.samples | Measure-Object -Property generation_tps -Average).Average
    $avgTime = ($results.samples | Measure-Object -Property total_time_ms -Average).Average

    Write-Host "  $($results.name):" -ForegroundColor Cyan
    Write-Host "    Samples:           $($results.samples.Count)"
    Write-Host "    Total Gen Tokens:  $($results.total_generation_tokens)"
    Write-Host "    Avg Prompt TPS:    $([Math]::Round($avgPromptTps, 1)) t/s"
    Write-Host "    Avg Generation TPS: $([Math]::Round($avgGenTps, 1)) t/s" -ForegroundColor $(if ($avgGenTps -gt 30) { "Green" } else { "Yellow" })
    Write-Host "    Avg Request Time:  $([Math]::Round($avgTime, 0)) ms"
    Write-Host "    Errors:            $($results.errors)"
    Write-Host ""

    return @{
        avg_prompt_tps = $avgPromptTps
        avg_gen_tps = $avgGenTps
        avg_time = $avgTime
    }
}

$baselineStats = Show-Results -results $baselineResults
$speculativeStats = Show-Results -results $speculativeResults

# Comparison
Write-Host "[5/5] Comparison Summary" -ForegroundColor Yellow
Write-Host "=====================================================" -ForegroundColor Cyan

if ($baselineStats -and $speculativeStats) {
    $speedup = $speculativeStats.avg_gen_tps / $baselineStats.avg_gen_tps
    $timeSaved = (1 - ($speculativeStats.avg_time / $baselineStats.avg_time)) * 100

    Write-Host ""
    Write-Host "  Generation TPS Comparison:" -ForegroundColor White
    Write-Host "    Baseline:    $([Math]::Round($baselineStats.avg_gen_tps, 1)) t/s"
    Write-Host "    Speculative: $([Math]::Round($speculativeStats.avg_gen_tps, 1)) t/s"
    Write-Host ""

    if ($speedup -gt 1) {
        Write-Host "    SPEEDUP: $([Math]::Round($speedup, 2))x faster" -ForegroundColor Green
        Write-Host "    Time saved: $([Math]::Round($timeSaved, 1))%" -ForegroundColor Green
    } else {
        Write-Host "    SLOWDOWN: $([Math]::Round(1/$speedup, 2))x slower" -ForegroundColor Red
        Write-Host "    (Draft model overhead exceeds benefit)" -ForegroundColor Yellow
    }
} elseif ($baselineStats) {
    Write-Host "  Baseline only: $([Math]::Round($baselineStats.avg_gen_tps, 1)) t/s"
} elseif ($speculativeStats) {
    Write-Host "  Speculative only: $([Math]::Round($speculativeStats.avg_gen_tps, 1)) t/s"
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan

# Save results
$resultsPath = "$SCRIPT_DIR\logs\benchmark-speculative-results.json"
$allResults = @{
    timestamp = (Get-Date).ToString("o")
    main_model = $MainModel
    draft_model = $DraftModel
    num_samples = $prompts.Count
    max_tokens = $MaxTokens
    baseline = $baselineResults
    speculative = $speculativeResults
}
$allResults | ConvertTo-Json -Depth 5 | Set-Content $resultsPath
Write-Host "Results saved to: $resultsPath" -ForegroundColor Gray
