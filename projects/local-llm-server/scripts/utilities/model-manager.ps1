# Model Manager - Graceful model hot-swapping for llama-server
# Manages llama-server lifecycle and enables model swaps without full restart

param(
    [string]$Model,              # Initial model to load (optional, uses config default)
    [int]$AdminPort = 8081,      # Port for admin API (model swap requests)
    [switch]$SkipDetection,      # Skip hardware detection on startup
    [switch]$WithMetrics,        # Start metrics collector alongside
    [int]$MetricsPort = 8082,    # Port for metrics endpoint
    [switch]$Speculative,        # Enable speculative decoding with draft model
    [string]$DraftModel,         # Custom draft model path
    [int]$DraftMax = 16,         # Max tokens to draft ahead
    [int]$DraftMin = 4           # Min tokens to draft
)

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $SCRIPT_DIR

# Global state
$script:llamaProcess = $null
$script:metricsProcess = $null
$script:currentModel = $null
$script:isSwapping = $false
$script:shutdownRequested = $false

# Speculative decoding state (from params)
$script:useSpeculative = $Speculative
$script:draftModelPath = if ($DraftModel) {
    if ([System.IO.Path]::IsPathRooted($DraftModel)) { $DraftModel }
    else { Join-Path $SCRIPT_DIR $DraftModel }
} else { $null }
$script:draftMax = $DraftMax
$script:draftMin = $DraftMin

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  LLM Model Manager" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Load configuration
function Get-Config {
    $configPath = "$SCRIPT_DIR\config\env.auto"
    if (-not (Test-Path $configPath)) {
        Write-Host "[ERROR] Config not found. Running hardware detection..." -ForegroundColor Red
        & "$SCRIPT_DIR\scripts\detect-hardware.ps1" | Out-Null
    }

    $config = @{}
    Get-Content $configPath | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $config[$matches[1]] = $matches[2]
        }
    }
    return $config
}

# Get available models
function Get-AvailableModels {
    $modelsDir = "$SCRIPT_DIR\models"
    $models = @()

    if (Test-Path $modelsDir) {
        Get-ChildItem "$modelsDir\*.gguf" | ForEach-Object {
            $sizeGB = [Math]::Round($_.Length / 1GB, 2)
            $models += @{
                name = $_.BaseName
                path = $_.FullName
                relativePath = "models\$($_.Name)"
                sizeGB = $sizeGB
            }
        }
    }

    # Also check parent directory for models
    $parentModels = "$SCRIPT_DIR\..\models"
    if (Test-Path $parentModels) {
        Get-ChildItem "$parentModels\*.gguf" | ForEach-Object {
            $sizeGB = [Math]::Round($_.Length / 1GB, 2)
            $models += @{
                name = $_.BaseName
                path = $_.FullName
                relativePath = "..\models\$($_.Name)"
                sizeGB = $sizeGB
            }
        }
    }

    return $models
}

# Select binary based on GPU
function Get-LlamaBinary {
    $allGPUs = Get-CimInstance -ClassName Win32_VideoController | Where-Object { $_.Name -notlike "*Microsoft*" }

    # Check for NVIDIA GPU first
    $nvidiaGPU = $allGPUs | Where-Object { $_.Name -like "*NVIDIA*" -or $_.Name -like "*RTX*" -or $_.Name -like "*GTX*" } | Select-Object -First 1
    if ($nvidiaGPU) {
        $path = "$SCRIPT_DIR\llamacpp\bin\llama-b6829-bin-win-cuda-12.4-x64"
        if (Test-Path "$path\llama-server.exe") { return $path }
    }

    # Check for AMD GPU
    $amdGPU = $allGPUs | Where-Object { $_.Name -like "*Radeon*" -or $_.Name -like "*AMD*" } | Select-Object -First 1
    if ($amdGPU) {
        $path = "$SCRIPT_DIR\llamacpp\bin\llama-b6829-bin-win-vulkan-x64"
        if (Test-Path "$path\llama-server.exe") { return $path }
    }

    # Fallback to CPU
    return "$SCRIPT_DIR\llamacpp\bin\llama-b6829-bin-win-cpu-x64"
}

# Start llama-server with specified model
function Start-LlamaServer {
    param([string]$ModelPath)

    $config = Get-Config
    $LLAMA_BIN = Get-LlamaBinary

    # Resolve model path
    if (-not [System.IO.Path]::IsPathRooted($ModelPath)) {
        $ModelPath = Join-Path $SCRIPT_DIR $ModelPath
    }

    if (-not (Test-Path $ModelPath)) {
        Write-Host "[ERROR] Model not found: $ModelPath" -ForegroundColor Red
        return $false
    }

    $script:currentModel = $ModelPath

    # Build arguments
    $PORT = $config['LLM_PORT']
    if (-not $PORT) { $PORT = "5001" }

    $PARALLEL_SLOTS = if ($config['LLM_PARALLEL_SLOTS']) { $config['LLM_PARALLEL_SLOTS'] } else { "2" }
    $CONT_BATCHING = if ($config['LLM_CONT_BATCHING']) { $config['LLM_CONT_BATCHING'] } else { "1" }
    $BATCH_SIZE = if ($config['LLM_BATCH_SIZE']) { $config['LLM_BATCH_SIZE'] } else { "1024" }
    $UBATCH_SIZE = if ($config['LLM_UBATCH_SIZE']) { $config['LLM_UBATCH_SIZE'] } else { "512" }

    $llamaArgs = @(
        "-m", $ModelPath,
        "-ngl", $config['LLM_GPULAYERS'],
        "-c", $config['LLM_CTX'],
        "-t", $config['LLM_THREADS'],
        "--host", "127.0.0.1",
        "--port", $PORT,
        "-b", $BATCH_SIZE,
        "-ub", $UBATCH_SIZE,
        "--parallel", $PARALLEL_SLOTS,
        "--cache-prompt"
    )

    if ($CONT_BATCHING -eq "1") { $llamaArgs += "--cont-batching" }
    if ($config['LLM_USEMLock'] -eq "1") { $llamaArgs += "--mlock" }
    if ($config['LLM_FLASH_ATTENTION'] -eq "1") { $llamaArgs += @("--flash-attn", "on") }

    # Speculative decoding (only when -Speculative flag is passed)
    $speculativeEnabled = $false
    if ($script:useSpeculative) {
        $draftPath = if ($script:draftModelPath) {
            $script:draftModelPath
        } elseif ($config['LLM_DRAFT_MODEL']) {
            "$SCRIPT_DIR\$($config['LLM_DRAFT_MODEL'])"
        } else {
            "$SCRIPT_DIR\models\Llama-3.2-1B-Instruct-Q4_K_M.gguf"
        }

        if (Test-Path $draftPath) {
            $draftGpuLayers = if ($config['LLM_DRAFT_GPULAYERS']) { $config['LLM_DRAFT_GPULAYERS'] } else { $config['LLM_GPULAYERS'] }
            $llamaArgs += @(
                "-md", $draftPath,
                "--draft-max", $script:draftMax.ToString(),
                "--draft-min", $script:draftMin.ToString(),
                "--draft-p-min", "0.9",
                "-ngld", $draftGpuLayers
            )
            $speculativeEnabled = $true
        }
    }

    Write-Host "[Manager] Starting llama-server..." -ForegroundColor Yellow
    Write-Host "          Model: $(Split-Path $ModelPath -Leaf)" -ForegroundColor Gray
    Write-Host "          Port: $PORT" -ForegroundColor Gray
    if ($speculativeEnabled) {
        Write-Host "          Speculative: ENABLED (draft: $(Split-Path $draftPath -Leaf))" -ForegroundColor Magenta
    }

    # Start as background process
    $script:llamaProcess = Start-Process -FilePath "$LLAMA_BIN\llama-server.exe" `
        -ArgumentList $llamaArgs `
        -PassThru `
        -NoNewWindow `
        -RedirectStandardOutput "$SCRIPT_DIR\logs\llama-server.log" `
        -RedirectStandardError "$SCRIPT_DIR\logs\llama-server-error.log"

    # Wait for server to be ready
    $config = Get-Config
    $PORT = if ($config['LLM_PORT']) { $config['LLM_PORT'] } else { "5001" }
    $maxWait = 60
    $waited = 0

    Write-Host "[Manager] Waiting for server to be ready..." -ForegroundColor Yellow
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 1
        $waited++

        try {
            $response = Invoke-RestMethod -Uri "http://127.0.0.1:$PORT/health" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response) {
                Write-Host "[Manager] Server ready! (took ${waited}s)" -ForegroundColor Green
                return $true
            }
        } catch {
            # Server not ready yet
        }

        # Check if process died
        if ($script:llamaProcess.HasExited) {
            Write-Host "[ERROR] llama-server process died unexpectedly" -ForegroundColor Red
            return $false
        }
    }

    Write-Host "[ERROR] Server failed to start within ${maxWait}s" -ForegroundColor Red
    return $false
}

# Stop llama-server gracefully
function Stop-LlamaServer {
    if ($script:llamaProcess -and -not $script:llamaProcess.HasExited) {
        Write-Host "[Manager] Stopping llama-server (PID: $($script:llamaProcess.Id))..." -ForegroundColor Yellow

        # Try graceful shutdown first
        $script:llamaProcess.CloseMainWindow() | Out-Null

        # Wait up to 10 seconds for graceful shutdown
        $waited = 0
        while (-not $script:llamaProcess.HasExited -and $waited -lt 10) {
            Start-Sleep -Milliseconds 500
            $waited += 0.5
        }

        # Force kill if still running
        if (-not $script:llamaProcess.HasExited) {
            Write-Host "[Manager] Force killing process..." -ForegroundColor Yellow
            $script:llamaProcess.Kill()
            $script:llamaProcess.WaitForExit(5000)
        }

        Write-Host "[Manager] Server stopped" -ForegroundColor Green
    }
    $script:llamaProcess = $null
}

# Swap model (graceful restart)
function Invoke-ModelSwap {
    param([string]$NewModelPath)

    if ($script:isSwapping) {
        return @{ success = $false; error = "Swap already in progress" }
    }

    $script:isSwapping = $true
    $startTime = Get-Date

    try {
        Write-Host "" -ForegroundColor Cyan
        Write-Host "=====================================================" -ForegroundColor Cyan
        Write-Host "  Model Swap Initiated" -ForegroundColor Cyan
        Write-Host "=====================================================" -ForegroundColor Cyan
        Write-Host "[Swap] New model: $NewModelPath" -ForegroundColor Yellow

        # Resolve path
        if (-not [System.IO.Path]::IsPathRooted($NewModelPath)) {
            $NewModelPath = Join-Path $SCRIPT_DIR $NewModelPath
        }

        if (-not (Test-Path $NewModelPath)) {
            return @{ success = $false; error = "Model not found: $NewModelPath" }
        }

        $oldModel = $script:currentModel

        # Stop current server
        Write-Host "[Swap] Draining requests and stopping server..." -ForegroundColor Yellow
        Stop-LlamaServer

        # Brief pause to ensure clean shutdown
        Start-Sleep -Seconds 1

        # Start with new model
        Write-Host "[Swap] Starting server with new model..." -ForegroundColor Yellow
        $success = Start-LlamaServer -ModelPath $NewModelPath

        $duration = ((Get-Date) - $startTime).TotalSeconds

        if ($success) {
            Write-Host "[Swap] Model swap completed in $([Math]::Round($duration, 1))s" -ForegroundColor Green
            Write-Host "=====================================================" -ForegroundColor Cyan
            Write-Host ""
            return @{
                success = $true
                oldModel = $oldModel
                newModel = $script:currentModel
                durationSeconds = [Math]::Round($duration, 2)
            }
        } else {
            # Try to rollback to old model
            Write-Host "[Swap] Failed! Attempting rollback..." -ForegroundColor Red
            $rollback = Start-LlamaServer -ModelPath $oldModel
            return @{
                success = $false
                error = "Failed to start new model"
                rollback = $rollback
            }
        }
    } finally {
        $script:isSwapping = $false
    }
}

# Simple HTTP listener for admin API
function Start-AdminServer {
    param([int]$Port)

    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://127.0.0.1:$Port/")

    try {
        $listener.Start()
        Write-Host "[Admin] Admin API listening on http://127.0.0.1:$Port" -ForegroundColor Green
        Write-Host "        POST /swap-model   - Swap to a different model" -ForegroundColor Gray
        Write-Host "        GET  /status       - Get current status" -ForegroundColor Gray
        Write-Host "        GET  /models       - List available models" -ForegroundColor Gray
        Write-Host "        POST /shutdown     - Shutdown manager" -ForegroundColor Gray
        Write-Host ""
    } catch {
        Write-Host "[ERROR] Failed to start admin server on port $Port" -ForegroundColor Red
        Write-Host "        Try a different port with -AdminPort" -ForegroundColor Yellow
        return $null
    }

    return $listener
}

function Handle-AdminRequest {
    param($context)

    $request = $context.Request
    $response = $context.Response
    $path = $request.Url.LocalPath
    $method = $request.HttpMethod

    $responseBody = ""
    $statusCode = 200

    try {
        switch -Regex ("$method $path") {
            "GET /status" {
                $config = Get-Config
                $responseBody = @{
                    status = if ($script:llamaProcess -and -not $script:llamaProcess.HasExited) { "running" } else { "stopped" }
                    currentModel = $script:currentModel
                    modelName = if ($script:currentModel) { Split-Path $script:currentModel -Leaf } else { $null }
                    isSwapping = $script:isSwapping
                    pid = if ($script:llamaProcess) { $script:llamaProcess.Id } else { $null }
                    port = $config['LLM_PORT']
                } | ConvertTo-Json
            }

            "GET /models" {
                $models = Get-AvailableModels
                $responseBody = @{
                    models = $models
                    currentModel = if ($script:currentModel) { Split-Path $script:currentModel -Leaf } else { $null }
                } | ConvertTo-Json -Depth 3
            }

            "POST /swap-model" {
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $body = $reader.ReadToEnd()
                $reader.Close()

                try {
                    $data = $body | ConvertFrom-Json
                    $modelPath = $data.model

                    if (-not $modelPath) {
                        $statusCode = 400
                        $responseBody = @{ error = "Missing 'model' field" } | ConvertTo-Json
                    } else {
                        $result = Invoke-ModelSwap -NewModelPath $modelPath
                        if ($result.success) {
                            $responseBody = $result | ConvertTo-Json
                        } else {
                            $statusCode = 500
                            $responseBody = $result | ConvertTo-Json
                        }
                    }
                } catch {
                    $statusCode = 400
                    $responseBody = @{ error = "Invalid JSON: $_" } | ConvertTo-Json
                }
            }

            "POST /shutdown" {
                $script:shutdownRequested = $true
                $responseBody = @{ message = "Shutdown initiated" } | ConvertTo-Json
            }

            default {
                $statusCode = 404
                $responseBody = @{ error = "Not found" } | ConvertTo-Json
            }
        }
    } catch {
        $statusCode = 500
        $responseBody = @{ error = $_.Exception.Message } | ConvertTo-Json
    }

    $response.StatusCode = $statusCode
    $response.ContentType = "application/json"
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseBody)
    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.Close()
}

# Ensure logs directory exists
if (-not (Test-Path "$SCRIPT_DIR\logs")) {
    New-Item -ItemType Directory -Path "$SCRIPT_DIR\logs" | Out-Null
}

# Run hardware detection if needed
if (-not $SkipDetection) {
    Write-Host "[Manager] Running hardware detection..." -ForegroundColor Yellow
    & "$SCRIPT_DIR\scripts\detect-hardware.ps1" | Out-Null
    Write-Host "[Manager] Hardware detection complete" -ForegroundColor Green
    Write-Host ""
}

# Determine initial model
$config = Get-Config
$initialModel = if ($Model) { $Model } else { $config['LLM_MODEL_PATH'] }

Write-Host "[Manager] Available models:" -ForegroundColor Yellow
$models = Get-AvailableModels
foreach ($m in $models) {
    $marker = if ($m.relativePath -eq $initialModel -or $m.path -eq $initialModel) { " <-- current" } else { "" }
    Write-Host "          - $($m.name) ($($m.sizeGB) GB)$marker" -ForegroundColor Gray
}
Write-Host ""

# Start admin server
$adminListener = Start-AdminServer -Port $AdminPort
if (-not $adminListener) {
    exit 1
}

# Start llama-server
if (-not (Start-LlamaServer -ModelPath $initialModel)) {
    Write-Host "[ERROR] Failed to start initial model" -ForegroundColor Red
    $adminListener.Stop()
    exit 1
}

# Start metrics collector if requested
if ($WithMetrics) {
    Write-Host "[Manager] Starting metrics collector..." -ForegroundColor Yellow
    $metricsScript = "$SCRIPT_DIR\scripts\metrics-collector.ps1"
    if (Test-Path $metricsScript) {
        $script:metricsProcess = Start-Process -FilePath "powershell.exe" `
            -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $metricsScript, "-MetricsPort", $MetricsPort, "-LlamaPort", $config['LLM_PORT'] `
            -PassThru `
            -NoNewWindow `
            -RedirectStandardOutput "$SCRIPT_DIR\logs\metrics-collector.log" `
            -RedirectStandardError "$SCRIPT_DIR\logs\metrics-collector-error.log"
        Write-Host "[Manager] Metrics collector started (PID: $($script:metricsProcess.Id))" -ForegroundColor Green
    } else {
        Write-Host "[Manager] Warning: metrics-collector.ps1 not found" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  Model Manager Running" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  LLM API:   http://127.0.0.1:$($config['LLM_PORT'])/v1/chat/completions" -ForegroundColor Cyan
Write-Host "  Admin API: http://127.0.0.1:$AdminPort" -ForegroundColor Cyan
if ($WithMetrics) {
    Write-Host "  Metrics:   http://127.0.0.1:$MetricsPort/metrics" -ForegroundColor Cyan
}
if ($Speculative) {
    Write-Host "  Speculative: ENABLED (draft $DraftMin-$DraftMax tokens)" -ForegroundColor Magenta
}
Write-Host ""
Write-Host "  Press Ctrl+C to shutdown" -ForegroundColor Yellow
Write-Host ""

# Handle Ctrl+C
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    $script:shutdownRequested = $true
}

# Main loop - handle admin requests
try {
    while (-not $script:shutdownRequested) {
        $context = $adminListener.GetContext()
        Handle-AdminRequest -context $context
    }
} catch {
    if (-not $script:shutdownRequested) {
        Write-Host "[ERROR] Admin server error: $_" -ForegroundColor Red
    }
} finally {
    Write-Host ""
    Write-Host "[Manager] Shutting down..." -ForegroundColor Yellow
    Stop-LlamaServer

    # Stop metrics collector if running
    if ($script:metricsProcess -and -not $script:metricsProcess.HasExited) {
        Write-Host "[Manager] Stopping metrics collector..." -ForegroundColor Yellow
        $script:metricsProcess.Kill()
        $script:metricsProcess.WaitForExit(5000)
    }

    $adminListener.Stop()
    Write-Host "[Manager] Goodbye!" -ForegroundColor Green
}
