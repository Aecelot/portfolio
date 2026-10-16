# Start llama.cpp with Llama-3.2-1B-Instruct model (CPU version)
# This script runs the llama-cli tool with CPU-only inference

$LLAMA_BIN = $env:LLAMA_BIN_DIR  # folder containing llama-cli.exe
$MODEL_PATH = $env:LLAMA_MODEL_PATH  # path to a .gguf model

Write-Host "Starting llama.cpp with CPU-only inference..." -ForegroundColor Cyan
Write-Host "Binary: $LLAMA_BIN\llama-cli.exe" -ForegroundColor Gray
Write-Host "Model: $MODEL_PATH" -ForegroundColor Gray
Write-Host ""

# Run llama-cli in interactive conversation mode (CPU only)
& "$LLAMA_BIN\llama-cli.exe" -m $MODEL_PATH -cnv

Write-Host ""
Write-Host "llama.cpp session ended." -ForegroundColor Cyan