# llama.cpp Setup Guide

This guide explains how to use llama.cpp to run LLM models locally with GPU acceleration.

## Prerequisites

- Windows 11 x64
- Downloaded llama.cpp binaries (Vulkan GPU version)
- GGUF format model file
- AMD Radeon 890M iGPU (16GB VRAM)

## Installation

### 1. Binary Locations

**GPU Version (Vulkan) - RECOMMENDED:**
```
<llama.cpp-install-dir>\llama-b6829-bin-win-vulkan-x64\
```

**CPU Version (Fallback):**
```
<llama.cpp-install-dir>\llama-b6829-bin-win-cpu-x64\
```

### 2. Model Location

Your models should be placed in:
```
<models-dir>\
```

Current model: `Llama-3.2-1B-Instruct-Q4_K_M.gguf`

## Usage

### Quick Start Scripts

**GPU-Accelerated (Recommended):**
```powershell
.\start-llama.ps1
```
This launches llama.cpp with Vulkan GPU acceleration (10-20x faster than CPU).

**CPU-Only:**
```powershell
.\start-llama-cpu.ps1
```
This launches llama.cpp with CPU-only inference.

**API Server:**
```powershell
.\start-llama-server.ps1
```
This starts an OpenAI-compatible API server with GPU acceleration on port 8080.

### Manual Commands

**GPU-Accelerated (Vulkan):**
```powershell
& "llamacpp\bin\llama-b6829-bin-win-vulkan-x64\llama-cli.exe" `
  -m "models\Llama-3.2-1B-Instruct-Q4_K_M.gguf" `
  -ngl 99 `
  -cnv
```

**CPU-Only:**
```powershell
& "llamacpp\bin\llama-b6829-bin-win-cpu-x64\llama-cli.exe" `
  -m "models\Llama-3.2-1B-Instruct-Q4_K_M.gguf" `
  -cnv
```

### Command-Line Options

Common options for `llama-cli.exe`:

- `-m <path>` - Path to the model file (required)
- `-ngl <number>` - Number of layers to offload to GPU (use 99 for all layers) **IMPORTANT FOR GPU**
- `-cnv` - Enable conversation mode (interactive chat)
- `-p "<prompt>"` - Provide a single prompt
- `-n <number>` - Maximum number of tokens to generate (default: -1 for unlimited)
- `-c <number>` - Context size (default: 4096)
- `-t <number>` - Number of threads to use (CPU only)
- `--temp <float>` - Temperature for sampling (default: 0.8)
- `--top-p <float>` - Top-p sampling (default: 0.9)
- `--top-k <int>` - Top-k sampling (default: 40)

**GPU-Specific Options:**
- `-ngl 99` - Offload all layers to GPU (recommended for best performance)
- `-ngl 0` - Disable GPU acceleration (CPU only)
- `--device none` - Completely disable GPU

### Example: Single Prompt with GPU

Generate a response to a single prompt using GPU:
```powershell
& "llamacpp\bin\llama-b6829-bin-win-vulkan-x64\llama-cli.exe" `
  -m "models\Llama-3.2-1B-Instruct-Q4_K_M.gguf" `
  -p "What is the capital of France?" `
  -n 100 `
  -ngl 99
```

### Example: API Server with GPU

Start llama.cpp as an OpenAI-compatible API server with GPU acceleration:
```powershell
& "llamacpp\bin\llama-b6829-bin-win-vulkan-x64\llama-server.exe" `
  -m "models\Llama-3.2-1B-Instruct-Q4_K_M.gguf" `
  -ngl 99 `
  -c 4096 `
  --port 8080
```

Then access:
- Web UI: `http://localhost:8080`
- API endpoint: `http://localhost:8080/v1/chat/completions`

## Available Tools

The llama.cpp package includes several tools:

- **llama-cli.exe** - Command-line interface for running models
- **llama-server.exe** - HTTP API server (OpenAI-compatible)
- **llama-bench.exe** - Performance benchmarking tool
- **llama-quantize.exe** - Model quantization tool
- **llama-perplexity.exe** - Perplexity testing
- **llama-run.exe** - Comprehensive example runner

## Performance Notes

### GPU Version (Vulkan) - CURRENT SETUP ⭐
- **GPU:** AMD Radeon 890M iGPU
- **VRAM:** 16GB available
- **Model loading time:** ~3-5 seconds
- **Inference speed:** 20-100+ tokens/second (estimated 10-20x faster than CPU)
- **Layers offloaded:** All (99 layers with `-ngl 99`)
- **Backend:** Vulkan (cross-platform GPU support)

### CPU Version (Fallback)
- **Performance:** 2-10 tokens/second
- **Use case:** When GPU is unavailable or for testing
- **Script:** `start-llama-cpu.ps1`

### Performance Comparison

| Backend | Speed (tokens/sec) | Best For |
|---------|-------------------|----------|
| GPU (Vulkan) | 20-100+ | Production use, fast inference |
| CPU | 2-10 | Fallback, compatibility |

### VRAM Usage
- **Model size:** ~700 MB (Q4_K_M quantization)
- **Context (4096):** ~500 MB
- **Total VRAM used:** ~1.2-1.5 GB
- **Available VRAM:** 16 GB (plenty of headroom for larger models or contexts)

## Troubleshooting

### Model Not Loading
- Verify the model file path is correct
- Ensure the model file is in GGUF format
- Check available RAM (model requires ~1-2GB)

### Slow Performance
- Consider reducing context size with `-c 2048`
- Use GPU-accelerated version if available
- Close other applications to free up resources

### Out of Memory
- Reduce context size: `-c 2048` or `-c 1024`
- Close other applications
- Use a smaller quantized model (e.g., Q4 or Q3)

## Model Information

**Current Model:** Llama-3.2-1B-Instruct-Q4_K_M
- **Size:** ~1 billion parameters
- **Quantization:** Q4_K_M (4-bit quantization, medium quality)
- **File Size:** ~700 MB
- **RAM Required:** ~1-2 GB
- **Best For:** Fast inference, limited resources

## Additional Resources

- llama.cpp GitHub: https://github.com/ggml-org/llama.cpp
- Model Downloads: https://huggingface.co/models?library=gguf
- Documentation: https://github.com/ggml-org/llama.cpp/tree/master/docs

## Version Information

- **llama.cpp Version:** b6829
- **Build Type:** win-vulkan-x64
- **Backend:** Vulkan GPU acceleration
- **GPU:** AMD Radeon 890M (16GB VRAM)
- **Release Date:** 2025-01-24

## System Specifications

- **OS:** Windows 11 x64
- **CPU:** (with integrated GPU)
- **iGPU:** AMD Radeon 890M
- **VRAM:** 16 GB (shared)
- **Recommended for:** Small to medium models (1B-7B parameters)