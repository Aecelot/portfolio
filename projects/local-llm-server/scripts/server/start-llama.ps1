# Start llama.cpp with auto-detected hardware optimization
# This script runs the llama-cli tool with optimal settings for your hardware

# Get script directory (project root)
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $SCRIPT_DIR

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  LlamaCPP Auto-Optimized Startup" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Run hardware detection and optimization
Write-Host "[1/5] Detecting hardware and optimizing configuration..." -ForegroundColor Yellow
& "$SCRIPT_DIR\scripts\detect-hardware.ps1" | Out-Null
Write-Host "      [OK] Hardware detected and optimized" -ForegroundColor Green
Write-Host ""

# Step 2: Detect GPU type to select best binary (prioritize NVIDIA)
Write-Host "[2/5] Detecting GPU type for binary selection..." -ForegroundColor Yellow
$allGPUs = Get-CimInstance -ClassName Win32_VideoController | Where-Object { $_.Name -notlike "*Microsoft*" }

$binaryType = "cpu"
$selectedGPU = $null

# First, check for NVIDIA GPU (highest priority for CUDA)
$nvidiaGPU = $allGPUs | Where-Object { $_.Name -like "*NVIDIA*" -or $_.Name -like "*RTX*" -or $_.Name -like "*GTX*" } | Select-Object -First 1
if ($nvidiaGPU) {
    $binaryType = "cuda"
    $selectedGPU = $nvidiaGPU.Name
    Write-Host "      [OK] NVIDIA GPU detected: $selectedGPU" -ForegroundColor Green
    Write-Host "      [OK] Using CUDA-accelerated binary" -ForegroundColor Green
}
# Then check for AMD GPU (Vulkan)
elseif ($amdGPU = $allGPUs | Where-Object { $_.Name -like "*Radeon*" -or $_.Name -like "*AMD*" } | Select-Object -First 1) {
    $binaryType = "vulkan"
    $selectedGPU = $amdGPU.Name
    Write-Host "      [OK] AMD GPU detected: $selectedGPU" -ForegroundColor Green
    Write-Host "      [OK] Using Vulkan-accelerated binary" -ForegroundColor Green
}
else {
    Write-Host "      [WARN] No dedicated GPU detected, using CPU binary" -ForegroundColor Yellow
}

# Display all detected GPUs
if ($allGPUs.Count -gt 1) {
    Write-Host "      [INFO] Multiple GPUs detected:" -ForegroundColor Cyan
    $allGPUs | ForEach-Object { Write-Host "             - $($_.Name)" -ForegroundColor Gray }
}
Write-Host ""

# Step 3: Load auto-detected configuration
Write-Host "[3/5] Loading auto-detected configuration..." -ForegroundColor Yellow
$configPath = "$SCRIPT_DIR\config\env.auto"
if (-not (Test-Path $configPath)) {
    Write-Host "      [ERROR] Auto-config not found at: $configPath" -ForegroundColor Red
    Write-Host "      [INFO] Falling back to config\env.local" -ForegroundColor Yellow
    $configPath = "$SCRIPT_DIR\config\env.local"
    if (-not (Test-Path $configPath)) {
        Write-Host "      [ERROR] No configuration file found!" -ForegroundColor Red
        exit 1
    }
}

$config = @{}
Get-Content $configPath | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $config[$matches[1]] = $matches[2]
    }
}
Write-Host "      [OK] Configuration loaded from: $configPath" -ForegroundColor Green
Write-Host ""

# Step 4: Select and verify binary path
Write-Host "[4/5] Selecting optimal binary..." -ForegroundColor Yellow

# Binary selection priority: CUDA > Vulkan > CPU
$LLAMA_BIN = $null
if ($binaryType -eq "cuda") {
    $cudaPath = "$SCRIPT_DIR\llamacpp\bin\llama-b6829-bin-win-cuda-12.4-x64"
    if (Test-Path "$cudaPath\llama-cli.exe") {
        $LLAMA_BIN = $cudaPath
    }
}

if (-not $LLAMA_BIN -and $binaryType -eq "vulkan") {
    $vulkanPath = "$SCRIPT_DIR\llamacpp\bin\llama-b6829-bin-win-vulkan-x64"
    if (Test-Path "$vulkanPath\llama-cli.exe") {
        $LLAMA_BIN = $vulkanPath
    }
}

# Fallback to CPU
if (-not $LLAMA_BIN) {
    $cpuPath = "$SCRIPT_DIR\llamacpp\bin\llama-b6829-bin-win-cpu-x64"
    if (Test-Path "$cpuPath\llama-cli.exe") {
        $LLAMA_BIN = $cpuPath
        Write-Host "      [WARN] Falling back to CPU binary" -ForegroundColor Yellow
    }
}

# Final verification
if (-not $LLAMA_BIN) {
    Write-Host "      [ERROR] No llama-cli.exe found in any binary directory!" -ForegroundColor Red
    Write-Host "      [INFO] Please download llama.cpp binaries to llamacpp\bin\" -ForegroundColor Yellow
    exit 1
}

$MODEL_PATH = "$SCRIPT_DIR\$($config['LLM_MODEL_PATH'])"

# Verify model exists
if (-not (Test-Path $MODEL_PATH)) {
    Write-Host "      [ERROR] Model not found at: $MODEL_PATH" -ForegroundColor Red
    Write-Host "      [INFO] Available models:" -ForegroundColor Yellow
    Get-ChildItem "$SCRIPT_DIR\models\*.gguf" | ForEach-Object { Write-Host "             - $($_.Name)" -ForegroundColor Gray }
    exit 1
}

Write-Host "      [OK] Binary: $LLAMA_BIN\llama-cli.exe" -ForegroundColor Green
Write-Host "      [OK] Model: $MODEL_PATH" -ForegroundColor Green
Write-Host ""

# Get batch settings from config (with defaults)
$BATCH_SIZE = if ($config['LLM_BATCH_SIZE']) { $config['LLM_BATCH_SIZE'] } else { "512" }
$UBATCH_SIZE = if ($config['LLM_UBATCH_SIZE']) { $config['LLM_UBATCH_SIZE'] } else { "256" }

# Step 5: Display configuration and start
Write-Host "[5/5] Starting LlamaCPP with optimized settings..." -ForegroundColor Yellow
Write-Host "      GPU Layers: $($config['LLM_GPULAYERS'])" -ForegroundColor Gray
Write-Host "      Context: $($config['LLM_CTX'])" -ForegroundColor Gray
Write-Host "      Threads: $($config['LLM_THREADS'])" -ForegroundColor Gray
Write-Host "      Batch Size: $BATCH_SIZE (micro-batch: $UBATCH_SIZE)" -ForegroundColor Gray
Write-Host "      Host: $($config['LLM_HOST']):$($config['LLM_PORT'])" -ForegroundColor Gray
Write-Host ""

# Build command arguments
$llamaArgs = @(
    "-m", $MODEL_PATH,
    "-ngl", $config['LLM_GPULAYERS'],
    "-c", $config['LLM_CTX'],
    "-t", $config['LLM_THREADS'],
    "-b", $BATCH_SIZE,
    "-ub", $UBATCH_SIZE,
    "-cnv",
    "--cache-prompt"  # Enable prompt caching for KV cache reuse
)

# Add optional flags (removed --mmap as it's not supported in this version)
if ($config['LLM_USEMLock'] -eq "1") { $llamaArgs += "--mlock" }
if ($config['LLM_FLASH_ATTENTION'] -eq "1") { $llamaArgs += "--flash-attn" }

Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  LlamaCPP Session Started" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""

# Run llama-cli with optimized settings
& "$LLAMA_BIN\llama-cli.exe" @llamaArgs

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  LlamaCPP Session Ended" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan