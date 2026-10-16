# Start llama.cpp server with auto-detected hardware optimization
# This script runs llama-server with OpenAI-compatible API

param(
    [switch]$SkipDetection,  # Skip hardware detection and use existing config
    [string]$Config,         # Use a specific config file instead of env.auto
    [switch]$Speculative,    # Enable speculative decoding with draft model
    [string]$DraftModel,     # Custom draft model path (default: auto-detect compatible model)
    [int]$DraftMax = 16,     # Max tokens to draft ahead (default: 16)
    [int]$DraftMin = 4       # Min tokens to draft (default: 4)
)

# Get script directory (project root)
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $SCRIPT_DIR

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  llama-server Auto-Optimized Startup" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Run adaptive hardware detection (unless skipped or using custom config)
$configPath = "$SCRIPT_DIR\config\env.auto"
if ($Config) {
    $configPath = $Config
    Write-Host "[1/4] Using custom config: $configPath" -ForegroundColor Yellow
} elseif ($SkipDetection) {
    Write-Host "[1/4] Skipping hardware detection (using cached config)" -ForegroundColor Yellow
} else {
    Write-Host "[1/4] Running adaptive hardware detection..." -ForegroundColor Yellow
    $detectScript = "$SCRIPT_DIR\scripts\detect-hardware.ps1"
    if (Test-Path $detectScript) {
        # Capture output but don't display verbose detection logs
        $null = & $detectScript 2>&1
        Write-Host "      [OK] Hardware detected and config optimized" -ForegroundColor Green
    } else {
        Write-Host "      [WARN] detect-hardware.ps1 not found, using existing config" -ForegroundColor Yellow
    }
}
Write-Host ""

# Load configuration
if (-not (Test-Path $configPath)) {
    Write-Host "ERROR: Config not found at $configPath" -ForegroundColor Red
    Write-Host "Run hardware detection first: .\scripts\detect-hardware.ps1" -ForegroundColor Yellow
    exit 1
}

$config = @{}
Get-Content $configPath | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $config[$matches[1]] = $matches[2]
    }
}

# Detect GPU and select binary
Write-Host "[2/4] Detecting GPU type for binary selection..." -ForegroundColor Yellow
$allGPUs = Get-CimInstance -ClassName Win32_VideoController | Where-Object { $_.Name -notlike "*Microsoft*" }

$binaryType = "cpu"
$selectedGPU = $null

# First, check for NVIDIA GPU (highest priority for CUDA)
$nvidiaGPU = $allGPUs | Where-Object { $_.Name -like "*NVIDIA*" -or $_.Name -like "*RTX*" -or $_.Name -like "*GTX*" } | Select-Object -First 1
if ($nvidiaGPU) {
    $binaryType = "cuda"
    $selectedGPU = $nvidiaGPU.Name
    $LLAMA_BIN = "$SCRIPT_DIR\llamacpp\bin\llama-b6829-bin-win-cuda-12.4-x64"
    Write-Host "      [OK] NVIDIA GPU detected: $selectedGPU" -ForegroundColor Green
    Write-Host "      [OK] Using CUDA-accelerated binary" -ForegroundColor Green
}
# Then check for AMD GPU (Vulkan)
elseif ($amdGPU = $allGPUs | Where-Object { $_.Name -like "*Radeon*" -or $_.Name -like "*AMD*" } | Select-Object -First 1) {
    $binaryType = "vulkan"
    $selectedGPU = $amdGPU.Name
    $LLAMA_BIN = "$SCRIPT_DIR\llamacpp\bin\llama-b6829-bin-win-vulkan-x64"
    Write-Host "      [OK] AMD GPU detected: $selectedGPU" -ForegroundColor Green
    Write-Host "      [OK] Using Vulkan-accelerated binary" -ForegroundColor Green
}
else {
    $LLAMA_BIN = "$SCRIPT_DIR\llamacpp\bin\llama-b6829-bin-win-cpu-x64"
    Write-Host "      [WARN] No dedicated GPU detected, using CPU binary" -ForegroundColor Yellow
}
Write-Host ""

# Verify binary exists
if (-not (Test-Path "$LLAMA_BIN\llama-server.exe")) {
    Write-Host "ERROR: llama-server.exe not found in $LLAMA_BIN" -ForegroundColor Red
    exit 1
}

$MODEL_PATH = "$SCRIPT_DIR\$($config['LLM_MODEL_PATH'])"
if (-not (Test-Path $MODEL_PATH)) {
    Write-Host "ERROR: Model not found at $MODEL_PATH" -ForegroundColor Red
    exit 1
}

$PORT = $config['LLM_PORT']
$SERVER_HOST = $config['LLM_HOST']

# Get multi-slot settings from config (with defaults)
$PARALLEL_SLOTS = if ($config['LLM_PARALLEL_SLOTS']) { $config['LLM_PARALLEL_SLOTS'] } else { "2" }
$CONT_BATCHING = if ($config['LLM_CONT_BATCHING']) { $config['LLM_CONT_BATCHING'] } else { "1" }
$BATCH_SIZE = if ($config['LLM_BATCH_SIZE']) { $config['LLM_BATCH_SIZE'] } else { "1024" }
$UBATCH_SIZE = if ($config['LLM_UBATCH_SIZE']) { $config['LLM_UBATCH_SIZE'] } else { "512" }

Write-Host "[3/4] Configuration loaded:" -ForegroundColor Yellow
Write-Host "      Binary: $binaryType ($LLAMA_BIN)" -ForegroundColor Gray
Write-Host "      Model: $MODEL_PATH" -ForegroundColor Gray
Write-Host "      GPU Layers: $($config['LLM_GPULAYERS'])" -ForegroundColor Gray
Write-Host "      Flash Attention: $(if ($config['LLM_FLASH_ATTENTION'] -eq '1') { 'enabled' } else { 'disabled' })" -ForegroundColor Gray
Write-Host "      Context: $($config['LLM_CTX']) per slot" -ForegroundColor Gray
Write-Host "      Threads: $($config['LLM_THREADS'])" -ForegroundColor Gray
Write-Host "      Batch Size: $BATCH_SIZE (micro-batch: $UBATCH_SIZE)" -ForegroundColor Gray
Write-Host "      Parallel Slots: $PARALLEL_SLOTS (continuous batching: $(if ($CONT_BATCHING -eq '1') { 'enabled' } else { 'disabled' }))" -ForegroundColor Cyan
Write-Host "      Speculative: $(if ($Speculative) { 'enabled (use -Speculative flag)' } else { 'disabled' })" -ForegroundColor $(if ($Speculative) { 'Magenta' } else { 'Gray' })
Write-Host "      Host: $SERVER_HOST" -ForegroundColor Gray
Write-Host "      Port: $PORT" -ForegroundColor Gray
Write-Host ""

Write-Host "[4/4] Starting llama-server..." -ForegroundColor Yellow
Write-Host "      Web UI: http://$($SERVER_HOST):$PORT" -ForegroundColor Green
Write-Host "      API endpoint: http://$($SERVER_HOST):$PORT/v1/chat/completions" -ForegroundColor Green
Write-Host "      Completion endpoint: http://$($SERVER_HOST):$PORT/completion" -ForegroundColor Green
Write-Host ""

# Build command arguments
$llamaArgs = @(
    "-m", $MODEL_PATH,
    "-ngl", $config['LLM_GPULAYERS'],
    "-c", $config['LLM_CTX'],
    "-t", $config['LLM_THREADS'],
    "--host", $SERVER_HOST,
    "--port", $PORT,
    "-b", $BATCH_SIZE,
    "-ub", $UBATCH_SIZE,
    "--parallel", $PARALLEL_SLOTS,
    "--cache-prompt"                                                # Enable prompt caching for KV reuse
)

# Add continuous batching if enabled
if ($CONT_BATCHING -eq "1") { $llamaArgs += "--cont-batching" }

# Speculative decoding with draft model (only when -Speculative flag is passed)
if ($Speculative) {
    # Determine draft model path
    $draftModelPath = if ($DraftModel) {
        if ([System.IO.Path]::IsPathRooted($DraftModel)) { $DraftModel }
        else { "$SCRIPT_DIR\$DraftModel" }
    } elseif ($config['LLM_DRAFT_MODEL']) {
        "$SCRIPT_DIR\$($config['LLM_DRAFT_MODEL'])"
    } else {
        # Default: look for a small model with compatible tokenizer
        "$SCRIPT_DIR\models\Llama-3.2-1B-Instruct-Q4_K_M.gguf"
    }

    if (Test-Path $draftModelPath) {
        # Get draft GPU layers from config or use same as main model
        $draftGpuLayers = if ($config['LLM_DRAFT_GPULAYERS']) { $config['LLM_DRAFT_GPULAYERS'] } else { $config['LLM_GPULAYERS'] }

        $llamaArgs += @(
            "-md", $draftModelPath,                                 # Draft model (must have same tokenizer)
            "--draft-max", $DraftMax.ToString(),                    # Max tokens to predict ahead
            "--draft-min", $DraftMin.ToString(),                    # Min tokens before verification
            "--draft-p-min", "0.9",                                 # 90% confidence threshold
            "-ngld", $draftGpuLayers                                # GPU layers for draft model
        )
        Write-Host "      [OK] Speculative decoding ENABLED" -ForegroundColor Magenta
        Write-Host "          Draft model: $(Split-Path $draftModelPath -Leaf)" -ForegroundColor Magenta
        Write-Host "          Draft tokens: $DraftMin-$DraftMax ahead" -ForegroundColor Magenta
    } else {
        Write-Host "      [WARN] Draft model not found: $draftModelPath" -ForegroundColor Yellow
        Write-Host "            Speculative decoding disabled" -ForegroundColor Yellow
    }
}

# Add optional flags
if ($config['LLM_USEMLock'] -eq "1") { $llamaArgs += "--mlock" }
if ($config['LLM_FLASH_ATTENTION'] -eq "1") { $llamaArgs += @("--flash-attn", "on") }

Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  llama-server Started" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start the server with GPU acceleration
& "$LLAMA_BIN\llama-server.exe" @llamaArgs

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  llama-server Stopped" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan