# LlamaCPP Control Tool (kcppctl)

> **Example project, early prototype.** This is a sanitized copy of an early prototype / MVP, published as
> a code sample. It is **not used in production**. The llama.cpp source that the original repository
> vendored is removed; install llama.cpp from [its releases](https://github.com/ggml-org/llama.cpp/releases)
> instead. Source commit: `ca48c7e` plus uncommitted working-tree changes (snapshot of 2026-10-16).
>
> **Status when this copy was made:** configures with vcpkg and builds on Windows (MSVC, CMake 4.1);
> `kcppctl --help` runs. The test target links only `test_simple.cpp`, so it reports 0 tests; the other
> test files in `tests/` are not wired into CMake. Scripts that start llama.cpp read model and binary
> paths from environment variables (`LLAMA_BIN_DIR`, `LLAMA_MODEL_PATH`, `LLAMA_MAIN_MODEL`,
> `LLAMA_DRAFT_MODEL`). Benchmark numbers in `benchmarks/` come from the author's own machine.

A powerful, lightweight C++ command-line interface for managing LlamaCPP processes on Windows with minimal dependencies.

## 🚀 Overview

kcppctl is a standalone CLI tool designed to simplify the management of LlamaCPP processes. It provides a robust interface for controlling, testing, and monitoring LlamaCPP instances with a focus on reliability and ease of use.

### Key Capabilities

- **🔧 Process Management**: Start, stop, and monitor LlamaCPP processes with intelligent lifecycle management
- **🧪 HTTP Testing**: Comprehensive smoke tests and performance benchmarks via REST API
- **⚙️ Environment Configuration**: Flexible configuration loading from environment files
- **📊 Cross-platform Logging**: Structured logging with automatic rotation and multiple output formats
- **🔗 Minimal Dependencies**: Runtime-only dependency on LlamaCPP binary - no external runtime requirements
- **🎯 Hardware Optimization**: Built-in optimization profiles for different hardware configurations

## 📋 Prerequisites

### Hardware Requirements
- **OS**: Windows 11 x64
- **GPU**: NVIDIA RTX 3060 12GB (or compatible CUDA GPU)
- **RAM**: 16GB minimum, 32GB recommended
- **Storage**: ~10GB free space for models and build artifacts

### Software Requirements
- **Build Tools**: Visual Studio 2022 Build Tools (MSVC v143, C++ CMake tools for Windows)
- **Build System**: CMake 3.24 or higher
- **Package Manager**: vcpkg (automatically configured)
- **Runtime Dependency**: LlamaCPP executable

### Model Requirements ⚠️ **IMPORTANT: Model Download Required**
- **GGUF Models**: See [requirements-models.txt](docs/setup/requirements-models.txt) for recommended models
- **Primary Model**: Llama 3.2 1B Instruct (Q4_K_M quantization)
- **Alternative Models**: Various Llama model variants and other GGUF-compatible models available
- **⚠️ NEW USERS MUST DOWNLOAD**: You need to download GGUF model files (~4-5GB) before using this tool. See [Model Setup](#-model-setup) section below for detailed instructions.

## 📁 Project Structure

```
local-llm-server/
├── 📁 benchmarks/              # Benchmark results (JSON)
├── 📁 config/                  # Environment configuration files
│   ├── 📄 env.auto            # Auto-generated config (hardware-detected)
│   ├── 📄 env.high-end        # High-end GPU profile
│   ├── 📄 env.mid-range       # Mid-range GPU profile
│   └── 📄 env.low-end         # CPU-only profile
├── 📁 docs/                    # Documentation
│   ├── 📁 api/                # API documentation
│   ├── 📁 architecture/       # Design & technical docs
│   ├── 📁 dev/                # Development logs & plans
│   ├── 📁 optimization/       # Performance optimization guides
│   └── 📁 setup/              # Setup & installation guides
├── 📁 include/                 # C++ header files
│   └── 📁 kcpp/               # Main library headers
├── 📁 logs/                   # Server and metrics logs
├── 📁 models/                 # GGUF model files
├── 📁 scripts/                # PowerShell scripts
│   ├── 📁 server/             # Server startup scripts
│   ├── 📁 benchmarks/         # Benchmark scripts
│   ├── 📁 diagnostics/        # Hardware detection & validation
│   └── 📁 utilities/          # Model manager, metrics, etc.
├── 📁 src/                    # C++ source files
├── 📁 tests/                  # Test suites
├── 📄 CMakeLists.txt          # CMake build configuration
├── 📄 README.md               # This file
└── 📄 vcpkg.json              # C++ dependencies
```

## 🚀 Quick Start

### 1. Environment Setup
```powershell
# Set execution policy (run once)
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

# Configure vcpkg environment
$env:VCPKG_ROOT="C:\src\vcpkg"
```

### 2. Build the Project
```powershell
# Configure with CMake
$toolchain="$env:VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake"
cmake -S . -B build -DCMAKE_TOOLCHAIN_FILE="$toolchain" -DCMAKE_BUILD_TYPE=Release

# Build the executable
cmake --build build --target kcppctl --config Release
```

### 3. Basic Usage
```powershell
# Display help information
.\build\kcppctl.exe --help

# Start LlamaCPP server with default configuration
.\build\kcppctl.exe start

# Test API connectivity (wait for server to start)
.\build\kcppctl.exe smoke --host 127.0.0.1 --port 8080

# Run performance benchmark (512 tokens)
.\build\kcppctl.exe perf --tokens 512

# Check server status and process information
.\build\kcppctl.exe status

# Gracefully stop the server
.\build\kcppctl.exe stop
```

### 4. Configuration
Copy and customize the environment configuration:
```powershell
# Copy example configuration
Copy-Item scripts\example.env.local config\env.local

# Edit config\env.local with your settings
notepad config\env.local
```

## 🚀 AMD Ryzen AI 300 Optimization (NEW!)

### Hardware Acceleration for Framework 13 Laptops

If you have an **AMD Ryzen AI 9 HX 370** with **Radeon 890M Graphics**, this project includes optimized configurations for **2-4x performance improvement**!

#### Quick Start with GPU Acceleration

```powershell
# Start with Ryzen AI 300 optimizations enabled
.\scripts\server\start-llama-server.ps1 -RyzenAIOptimized

# Validate GPU acceleration is working
.\scripts\diagnostics\validate-gpu-acceleration.ps1

# Run performance benchmark
.\scripts\benchmarks\benchmark-ryzen-ai.ps1
```

#### Expected Performance Gains

| Configuration | TPS | GPU Utilization | Context Size |
|--------------|-----|----------------|--------------|
| **CPU-only (baseline)** | ~35-54 TPS | 0% | 2048 tokens |
| **Ryzen AI Optimized** | ~120-200 TPS | 60-80% | 8192 tokens |
| **Improvement** | **+150-300%** | **Full iGPU usage** | **4x larger** |

#### What's Included

- ✅ **Automatic Hardware Detection**: Detects AMD Ryzen AI 300 + Radeon 890M iGPU
- ✅ **Optimized Configuration**: Pre-configured [`config/env.ryzen-ai-optimized`](config/env.ryzen-ai-optimized) with optimized GPU layers
- ✅ **OpenCL Acceleration**: Proper OpenCL flags for AMD iGPU
- ✅ **Validation Tools**: [`validate-gpu-acceleration.ps1`](scripts/diagnostics/validate-gpu-acceleration.ps1) confirms GPU is active
- ✅ **Performance Benchmarks**: [`benchmark-ryzen-ai.ps1`](scripts/benchmarks/benchmark-ryzen-ai.ps1) measures TPS improvements
- ✅ **Monitoring Scripts**: Real-time GPU/CPU/memory utilization tracking

#### Full Testing Guide

For comprehensive testing and troubleshooting, see **[RYZEN_AI_TESTING_GUIDE.md](RYZEN_AI_TESTING_GUIDE.md)**

#### Requirements for GPU Acceleration

- **AMD GPU Drivers** with OpenCL support (AMD Software: Adrenalin Edition)
- **OpenCL Runtime** (usually included with GPU drivers)
- **95GB+ RAM** (for optimal shared memory usage)

#### Troubleshooting

If GPU acceleration isn't working:

```powershell
# Verify OpenCL is installed
Test-Path "$env:SystemRoot\System32\OpenCL.dll"

# Check hardware detection
.\scripts\diagnostics\detect-hardware.ps1 -Detailed

# Dry-run to see command arguments
.\scripts\server\start-llama-server.ps1 -RyzenAIOptimized -DryRun
```

See **[RYZEN_AI_TESTING_GUIDE.md](RYZEN_AI_TESTING_GUIDE.md)** for detailed troubleshooting steps.

## Model Manager & Hot-Swapping (NEW!)

### Zero-Downtime Model Swapping

Switch between models without restarting your entire server setup:

```powershell
# Start the model manager (replaces start-llama-server.ps1 for production use)
.\scripts\utilities\model-manager.ps1

# With metrics collection enabled
.\scripts\utilities\model-manager.ps1 -WithMetrics

# Swap models while running (from another terminal)
.\scripts\utilities\swap-model.ps1 llama-3.2      # Search by name
.\scripts\utilities\swap-model.ps1 -List          # List available models
.\scripts\utilities\swap-model.ps1 -Status        # Check current status
```

#### Model Manager Features

- **Admin API** on port 8081:
  - `GET /status` - Current model and server status
  - `GET /models` - List available GGUF models
  - `POST /swap-model` - Swap to a different model
  - `POST /shutdown` - Graceful shutdown
- **Automatic hardware detection** on startup
- **Graceful model swapping** - drains requests before restart
- **Automatic rollback** if new model fails to load

## Performance Metrics & Observability (NEW!)

### Full Observability Stack

Monitor your LLM inference with Prometheus-compatible metrics:

```powershell
# Run standalone metrics collector
.\scripts\utilities\metrics-collector.ps1

# Live dashboard mode
.\scripts\utilities\metrics-collector.ps1 -Dashboard

# Or start with model manager
.\scripts\utilities\model-manager.ps1 -WithMetrics
```

#### Available Metrics

| Metric | Description |
|--------|-------------|
| `llm_prompt_tokens_per_second` | Prompt processing speed (TPS) |
| `llm_generation_tokens_per_second` | Token generation speed (TPS) |
| `llm_tokens_generated_total` | Total tokens generated |
| `llm_slots_active` | Active inference slots |
| `llm_gpu_memory_used_bytes` | GPU memory usage |
| `llm_ram_used_bytes` | System RAM usage |

#### Endpoints

- `http://127.0.0.1:8082/metrics` - Prometheus format
- `http://127.0.0.1:8082/json` - JSON format
- `http://127.0.0.1:8082/history` - Historical data
- `http://127.0.0.1:8082/health` - Health check

## Multi-Slot Inference (NEW!)

### Parallel Request Processing

Handle multiple concurrent requests efficiently:

```powershell
# Configuration in config/env.auto (auto-generated)
LLM_PARALLEL_SLOTS=2       # Number of concurrent slots
LLM_CONT_BATCHING=1        # Enable continuous batching
LLM_BATCH_SIZE=1024        # Batch size for prompt processing
LLM_UBATCH_SIZE=512        # Micro-batch size
```

#### How It Works

- **Shared weights**: Model weights load once, shared across all slots
- **Per-slot KV cache**: Only KV cache memory multiplies per slot
- **Continuous batching**: Slots refill immediately when done (no waiting)

#### Memory Impact

| Slots | Weights | KV Cache (8K ctx) | Total Overhead |
|-------|---------|-------------------|----------------|
| 1 | 1x | 1x | Baseline |
| 2 | 1x | 2x | +~500MB |
| 4 | 1x | 4x | +~1.5GB |

## Speculative Decoding (NEW!)

### Faster Generation with Draft Models

Use a small draft model to predict tokens ahead, then verify with your main model in a single forward pass. This can provide 2-4x speedup for generation-heavy workloads.

```powershell
# Enable speculative decoding (opt-in)
.\scripts\server\start-llama-server.ps1 -Speculative

# With custom draft model
.\scripts\server\start-llama-server.ps1 -Speculative -DraftModel "models\my-draft.gguf"

# Tune draft parameters
.\scripts\server\start-llama-server.ps1 -Speculative -DraftMax 16 -DraftMin 4

# With model manager
.\scripts\utilities\model-manager.ps1 -Speculative -WithMetrics
```

#### How It Works

```
Traditional:     Main → tok₁ → Main → tok₂ → Main → tok₃  (3 forward passes)
Speculative:     Draft → [tok₁,tok₂,tok₃] → Main verifies all  (1 forward pass)
```

The main model's forward pass cost is roughly the same whether verifying 1 or 5 tokens.

#### Requirements

| Requirement | Description |
|-------------|-------------|
| Draft model | Small model (1-2B params) with **same tokenizer** as main |
| Main model | Your primary model (7B+ recommended for benefit) |
| Memory | Both models must fit in VRAM/RAM simultaneously |

#### When to Use

| Scenario | Benefit |
|----------|---------|
| Large main models (7B+) | High - draft is much faster |
| Long generations | High - amortizes overhead |
| Structured output (code, JSON) | Very high - predictable tokens |
| Small main models (1-3B) | Low - main model already fast |

#### When NOT to Use

Based on benchmarking, speculative decoding can actually **slow down** generation in these cases:

| Scenario | Issue |
|----------|-------|
| Different tokenizers | Llama 3.1 + Llama 3.2 have incompatible tokenizers - draft predictions rejected |
| iGPU/shared memory | Memory bandwidth contention outweighs benefits |
| Mismatched model families | Must use same base model (e.g., Llama 3.1 8B + Llama 3.1 1B) |

**Benchmark results (8B main + 1B draft on AMD 890M iGPU):**
- Baseline: ~12 t/s
- Speculative: ~6 t/s (50% slower due to tokenizer mismatch)

**Recommendation:** Only use speculative decoding with models from the **same family and version** (identical tokenizers).

#### Configuration

```env
# In config/env.auto (optional, can also use CLI flags)
LLM_DRAFT_MODEL=models\Llama-3.2-1B-Instruct-Q4_K_M.gguf
LLM_DRAFT_GPULAYERS=45
LLM_DRAFT_MAX=16
LLM_DRAFT_MIN=4
```

## Configuration

Create `config/env.local` based on `scripts/example.env.local`:

```env
LLM_HOST=127.0.0.1
LLM_PORT=8080
LLM_MODEL_PATH=../models/Llama-3.2-1B-Instruct-Q4_K_M.gguf
LLM_THREADS=8
LLM_CTX=4096
LLM_GPULAYERS=35
LLM_PARALLEL_SLOTS=2
LLM_CONT_BATCHING=1
```

## 🛠️ Commands Reference

| Command | Description | Example |
|---------|-------------|---------|
| `start [--env path] [--dry-run]` | Launch LlamaCPP process | `kcppctl.exe start --env config\env.local` |
| `smoke [--host host] [--port port]` | Test API connectivity | `kcppctl.exe smoke --port 8080` |
| `perf [--host host] [--port port] [--tokens n]` | Performance benchmark | `kcppctl.exe perf --tokens 512` |
| `status` | Show process status and info | `kcppctl.exe status` |
| `stop` | Terminate LlamaCPP process | `kcppctl.exe stop` |
| `logs [--tail]` | View application logs | `kcppctl.exe logs --tail` |

## 📦 Model Setup ⚠️ **REQUIRED FOR ALL NEW USERS**

### 🚨 **IMPORTANT: You Must Download Models**
Before using kcppctl, you **MUST** download GGUF model files. Without models, the tool cannot generate text.

**Estimated download size:** ~4-5GB per model
**Storage required:** ~10GB free space recommended

### 1. **Download Required Models**
See [requirements-models.txt](docs/setup/requirements-models.txt) for detailed model specifications and download options.

### 2. **Recommended Model for New Users**
- **Primary Choice**: Llama 3.2 1B Instruct Q4_K_M (~1.3GB)
- **Download URL**: https://huggingface.co/lmstudio-community/Meta-Llama-3.2-1B-Instruct-GGUF
- **Filename**: `Meta-Llama-3.2-1B-Instruct-Q4_K_M.gguf`

### 3. **Quick Model Setup (Recommended Method)**
```powershell
# Create models directory
mkdir models

# Install HuggingFace CLI (one-time setup)
pip install huggingface_hub

# Download the recommended model
huggingface-cli download lmstudio-community/Meta-Llama-3.2-1B-Instruct-GGUF Meta-Llama-3.2-1B-Instruct-Q4_K_M.gguf --local-dir models --local-dir-use-symlinks False

# Verify download
dir models
```

### 4. **Alternative Models**
- **Llama 3.2 3B**: For higher quality output (larger file size)
- **Higher Quality**: Q5_K_M quantization for better output (larger file size)
- See [requirements-models.txt](docs/setup/requirements-models.txt) for complete options

### 5. **Manual Download (Alternative Method)**
If HuggingFace CLI doesn't work:
1. Visit: https://huggingface.co/lmstudio-community/Meta-Llama-3.2-1B-Instruct-GGUF
2. Download: `Meta-Llama-3.2-1B-Instruct-Q4_K_M.gguf`
3. Place in `models/` directory

### ✅ **Verification**
After downloading, verify your model file exists:
```powershell
dir models
# Should show: Meta-Llama-3.2-1B-Instruct-Q4_K_M.gguf
```

**⚠️ Without a model file, kcppctl will not function!**

## 🔧 Configuration

### Environment Variables
- `LLM_HOST`: Server bind address (default: 127.0.0.1)
- `LLM_PORT`: Server port (default: 8080)
- `LLM_MODEL_PATH`: Path to GGUF model file
- `LLM_THREADS`: CPU threads for inference (default: 8)
- `LLM_CTX`: Context size (default: 4096)
- `LLM_GPULAYERS`: GPU layers to offload (default: 35)

### Configuration Files
- `config/env.local`: Local environment configuration
- `scripts/example.env.local`: Example configuration template

## 🧪 Testing

### Smoke Testing
```powershell
# Test basic connectivity
kcppctl.exe smoke --host 127.0.0.1 --port 8080
```

### Performance Testing
```powershell
# Quick performance benchmark
kcppctl.exe perf --tokens 256

# Comprehensive performance test
kcppctl.exe perf --host 127.0.0.1 --port 8080 --tokens 512
```

## 🏗️ Development

### Building from Source
See [kcpp_cpp_project_plan.md](kcpp_cpp_project_plan.md) for comprehensive build instructions.

### Project Structure
- **src/**: C++ source files
- **include/**: Header files
- **tests/**: Unit and integration tests
- **scripts/**: PowerShell utilities and templates
- **config/**: Environment configurations

### Code Quality
- **Language**: Modern C++17
- **Build System**: CMake with vcpkg
- **Testing**: Google Test framework
- **Logging**: spdlog for structured logging
- **HTTP Client**: cpp-httplib for API communication

## 🐛 Troubleshooting

### Common Issues
- **Build Errors**: Ensure Visual Studio Build Tools and CMake are properly installed
- **Runtime Errors**: Check model path and LlamaCPP executable location
- **Performance Issues**: Adjust GPU layers and context size based on available VRAM

### Getting Help
- **Setup Guide**: [SETUP.md](docs/setup/SETUP.md) - Detailed setup instructions
- **Model Requirements**: [requirements-models.txt](docs/setup/requirements-models.txt) - Model specifications
- **API Documentation**: [docs/api/](docs/api/) - API reference and integration guides

## 📄 License

This is a code sample from a prototype.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

---

**Status**: ✅ Ready for production use
**Version**: v0.2.0
**Last Updated**: 2025-02-02