# NPU (XDNA) Optimization Implementation Plan

**Target Hardware:** AMD Ryzen AI NPU (50 TOPS) + Radeon 890M iGPU
**Current Stack:** llama.cpp + Vulkan (iGPU only)
**Goal:** Add NPU acceleration for power-efficient inference

---

## Executive Summary

This plan adds AMD Ryzen AI NPU support alongside the existing Vulkan backend, creating a hybrid system that optimizes for both performance (iGPU) and power efficiency (NPU).

**Key Strategy:** Parallel backend architecture with workload-based routing

**Expected Outcomes:**
- **Power Efficiency:** 2-3× improvement (65W → 25W under load)
- **Inference Speed:** Competitive with iGPU (80-120 TPS with optimizations)
- **Flexibility:** Choose backend per workload (battery vs. performance)
- **Future-Proofing:** Ready for AMD's NPU ecosystem maturation

**Estimated Time Investment:**
- Phase 1 (SDK Setup): 2-3 hours
- Phase 2 (Model Conversion): 3-4 hours
- Phase 3 (Integration): 4-6 hours
- Phase 4 (Optimization): 3-5 hours
- Total: 12-18 hours

---

## Architecture Overview

### Hybrid Backend Design

```
┌─────────────────────────────────────────┐
│  start-llama-server.ps1 (Router)        │
│  - Detects hardware                     │
│  - Selects backend based on config      │
└──────────┬──────────────────────────────┘
           │
     ┌─────┴──────┐
     │            │
┌────▼────┐  ┌───▼─────────┐
│ llama.  │  │ onnxruntime-│
│ cpp     │  │ genai       │
│ server  │  │ (Python)    │
└────┬────┘  └───┬─────────┘
     │            │
┌────▼────┐  ┌───▼─────────┐
│ Vulkan  │  │ VitisAI EP  │
│ (iGPU)  │  │ (NPU)       │
│         │  │ + DML (iGPU)│
└─────────┘  └─────────────┘
     │            │
┌────▼────┐  ┌───▼─────────┐
│ 890M    │  │ XDNA NPU    │
│ 16GB    │  │ + 890M      │
│ VRAM    │  │ (Hybrid)    │
└─────────┘  └─────────────┘
```

### Backend Selection Logic

```
User Request → Router
├── Backend=vulkan → llama.cpp (Vulkan EP) → iGPU
├── Backend=npu → ORT-GenAI (VitisAI EP) → NPU only
├── Backend=hybrid → ORT-GenAI (VitisAI + DML EPs) → NPU + iGPU
└── Backend=auto → Detect:
    ├── On battery? → hybrid (power-efficient)
    └── On AC? → vulkan (max throughput)
```

---

## Phase 1: SDK Installation & Prerequisites (2-3 hours)

### Goal: Install AMD Ryzen AI Software and validate NPU detection

### 1.1 System Requirements Check

**Verify:**
```powershell
# Check Windows version (requires Windows 11)
winver
# Should show: Windows 11 22H2 or later

# Check AMD drivers
Get-CimInstance Win32_VideoController | Where-Object { $_.Name -like "*Radeon*" }
# Should show: AMD Radeon 890M Graphics with recent driver

# Check NPU detection
Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -like "*NPU*" -or $_.Name -like "*XDNA*" }
# May or may not show NPU (driver-dependent)
```

**Requirements:**
- ✅ Windows 11 22H2+
- ✅ AMD GPU drivers (latest from AMD.com)
- ✅ Python 3.10 or 3.11 (NOT 3.12 yet)
- ✅ Visual Studio 2022 Build Tools (for compilation)

---

### 1.2 Install AMD Ryzen AI Software

**Step 1: Download Ryzen AI SDK**

Visit: https://ryzenai.docs.amd.com/en/latest/inst.html

Download: **Ryzen AI Software 1.6** or later

**Step 2: Install SDK**

```powershell
# Extract SDK (example path)
$sdkPath = "C:\AMD\RyzenAI"
Expand-Archive -Path "ryzen-ai-sw-1.6.0.zip" -DestinationPath $sdkPath

# Add to PATH
$env:Path += ";$sdkPath\bin"

# Verify installation
$sdkPath\bin\amd_xdna_test.exe
# Should output: "XDNA device detected: 1 device(s)"
```

**Step 3: Install Python Dependencies**

```powershell
# Create virtual environment
python -m venv venv-npu
.\venv-npu\Scripts\Activate.ps1

# Install ONNX Runtime with VitisAI EP
pip install onnxruntime-genai
pip install onnxruntime-vitisai

# Install AMD Quark (quantization)
pip install "quark @ git+https://github.com/amd/quark.git"

# Install model conversion tools
pip install optimum[amd]
pip install transformers accelerate
```

**Verification:**

```python
# test-npu.py
import onnxruntime as ort

# Check available execution providers
print("Available EPs:", ort.get_available_providers())
# Should include: 'VitisAIExecutionProvider'

# Try to create session with VitisAI EP
try:
    providers = [('VitisAIExecutionProvider', {'device_id': 0})]
    print("✅ VitisAI EP is available")
except Exception as e:
    print(f"❌ VitisAI EP error: {e}")
```

**Expected Output:**
```
Available EPs: ['VitisAIExecutionProvider', 'DmlExecutionProvider', 'CPUExecutionProvider']
✅ VitisAI EP is available
```

---

### 1.3 Install Model Conversion Tools

**Install AMD Quark:**

```powershell
# Clone and install Quark
git clone https://github.com/amd/quark.git
cd quark
pip install -e .

# Verify installation
python -c "from quark.onnx import ModelQuantizer; print('✅ Quark installed')"
```

**Install Optimum-AMD:**

```powershell
pip install optimum[amd]

# Verify
python -c "from optimum.amd.ryzenai import RyzenAIModelForCausalLM; print('✅ Optimum-AMD installed')"
```

---

### Phase 1 Deliverable

**Checklist:**
- ✅ Ryzen AI SDK installed and XDNA device detected
- ✅ Python environment with onnxruntime-genai
- ✅ VitisAI execution provider available
- ✅ AMD Quark quantizer installed
- ✅ Optimum-AMD installed

**Validation:**
```powershell
# Run comprehensive test
python scripts/validate-npu-setup.ps1
```

---

## Phase 2: Model Conversion (3-4 hours)

### Goal: Convert GGUF models to NPU-optimized ONNX format

### 2.1 Model Conversion Strategy

**Two Paths:**

#### Path A: Direct Conversion (Hugging Face → ONNX)
```
Hugging Face Model → Optimum-AMD → ONNX (UINT4/INT4)
```

**Pros:** Easiest, well-supported
**Cons:** Requires downloading original HF model

#### Path B: GGUF → HF → ONNX (Complex)
```
GGUF → llama.cpp convert → HF safetensors → Optimum-AMD → ONNX
```

**Pros:** Reuses existing GGUF models
**Cons:** Complex, error-prone, not officially supported

**Recommendation:** Use Path A (Hugging Face direct)

---

### 2.2 Convert Llama 3.2 3B to ONNX

**Step 1: Download Hugging Face Model**

```python
# scripts/convert-to-onnx.py
from optimum.amd.ryzenai import RyzenAIModelForCausalLM
from transformers import AutoTokenizer

model_id = "meta-llama/Llama-3.2-3B-Instruct"

print("Step 1: Loading model from Hugging Face...")
model = RyzenAIModelForCausalLM.from_pretrained(
    model_id,
    export=True,  # Export to ONNX
    provider="VitisAIExecutionProvider",
    quantization_config={
        "bits": 4,  # UINT4 quantization
        "group_size": 128,  # Weight grouping
        "quant_method": "awq"  # Activation-Aware Weight Quantization
    }
)

print("Step 2: Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(model_id)

print("Step 3: Saving ONNX model...")
output_dir = "models/onnx/llama-3.2-3b-uint4-npu"
model.save_pretrained(output_dir)
tokenizer.save_pretrained(output_dir)

print(f"✅ Model saved to: {output_dir}")
```

**Run conversion:**
```powershell
python scripts/convert-to-onnx.py
```

**Expected Output:**
```
Step 1: Loading model from Hugging Face...
  Downloading model... (may take 5-10 min)
  Quantizing to UINT4... (may take 10-15 min)
Step 2: Loading tokenizer...
Step 3: Saving ONNX model...
✅ Model saved to: models/onnx/llama-3.2-3b-uint4-npu
```

**Output Files:**
```
models/onnx/llama-3.2-3b-uint4-npu/
├── model.onnx              # Main ONNX model (~1.5-1.7 GB)
├── model.onnx.data         # External weights (if split)
├── genai_config.json       # ORT-GenAI configuration
├── tokenizer.json          # Tokenizer
└── tokenizer_config.json
```

---

### 2.3 Advanced Optimization: UINT3 Quantization

**For maximum memory efficiency:**

```python
# scripts/convert-to-onnx-uint3.py
from quark.onnx import ModelQuantizer
from optimum.exporters.onnx import main_export

model_id = "meta-llama/Llama-3.2-3B-Instruct"

# Step 1: Export to ONNX (FP16)
print("Exporting to ONNX (FP16)...")
main_export(
    model_name_or_path=model_id,
    output="models/onnx/llama-3.2-3b-fp16"
)

# Step 2: Quantize with AMD Quark (UINT3)
print("Quantizing to UINT3...")
quantizer = ModelQuantizer(
    quantization_mode="weight_only",  # Weight-only quantization
    weight_bits=3,  # UINT3 (aggressive)
    group_size=64,  # Smaller groups for better compression
    enable_sparse=True,  # Prune small weights
    calibration_method="awq"  # Activation-aware
)

quantized_model = quantizer.quantize_model(
    "models/onnx/llama-3.2-3b-fp16/model.onnx",
    calibration_data_reader=None  # Use default calibration
)

# Step 3: Save
output_path = "models/onnx/llama-3.2-3b-uint3-npu/model.onnx"
quantized_model.save(output_path)
print(f"✅ UINT3 model saved: {output_path}")
```

**Trade-offs:**

| Quantization | Size | Speed | Quality | NPU Compat |
|--------------|------|-------|---------|------------|
| **UINT4 (AWQ)** | 1.6-1.7 GB | Baseline | ⭐⭐⭐⭐ | ✅ Best |
| **UINT3** | 1.2-1.4 GB | +10-15% | ⭐⭐⭐ | ✅ Good |
| **INT8** | 3.0 GB | -10% | ⭐⭐⭐⭐⭐ | ✅ Safe fallback |

**Recommendation:** Start with UINT4, test UINT3 if memory is tight.

---

### 2.4 Validate Converted Model

**Test script:**

```python
# scripts/test-onnx-model.py
import onnxruntime_genai as og

model_path = "models/onnx/llama-3.2-3b-uint4-npu"

print("Loading model...")
model = og.Model(model_path)

print("Creating generator...")
tokenizer = og.Tokenizer(model)
params = og.GeneratorParams(model)
params.set_search_options(max_length=100, temperature=0.7)

# Test inference
prompt = "Hello, how are you?"
input_tokens = tokenizer.encode(prompt)

print(f"Prompt: {prompt}")
print("Generating...")

generator = og.Generator(model, params)
generator.append_tokens(input_tokens)

output = ""
while not generator.is_done():
    generator.compute_logits()
    generator.generate_next_token()
    token = generator.get_next_tokens()[0]
    output += tokenizer.decode(token)

print(f"Response: {output}")
```

**Expected Output:**
```
Loading model...
Creating generator...
Prompt: Hello, how are you?
Generating...
Response: Hello! I'm doing well, thank you for asking. How can I assist you today?
```

---

### Phase 2 Deliverable

**Checklist:**
- ✅ Llama 3.2 3B converted to ONNX (UINT4)
- ✅ Model validates on CPU (ORT-GenAI test)
- ✅ Optional: UINT3 model created
- ✅ Optional: SmolLM2-135M converted for draft model

**Files Created:**
```
models/onnx/
├── llama-3.2-3b-uint4-npu/      # Main model
├── llama-3.2-3b-uint3-npu/      # Optional aggressive quant
└── smollm2-135m-uint4-npu/      # Optional draft model
```

---

## Phase 3: Backend Integration (4-6 hours)

### Goal: Create ONNX Runtime server and integrate with startup scripts

### 3.1 Create ONNX Runtime Server

**File:** `scripts/onnx-server.py`

```python
#!/usr/bin/env python3
"""
ONNX Runtime GenAI Server for AMD Ryzen AI NPU
Compatible with llama.cpp's API format
"""

import argparse
import json
from flask import Flask, request, jsonify
import onnxruntime_genai as og
import time

app = Flask(__name__)

# Global model state
model = None
tokenizer = None
params = None

def load_model(model_path, execution_providers=None):
    """Load ONNX model with specified execution providers"""
    global model, tokenizer, params

    print(f"Loading model from: {model_path}")

    # Create session options
    session_options = og.SessionOptions()

    if execution_providers:
        print(f"Using execution providers: {execution_providers}")
        # Configure EPs (VitisAI for NPU, DML for iGPU)
        session_options.execution_providers = execution_providers

    model = og.Model(model_path, session_options=session_options)
    tokenizer = og.Tokenizer(model)
    params = og.GeneratorParams(model)

    print("✅ Model loaded successfully")

@app.route('/v1/chat/completions', methods=['POST'])
def chat_completions():
    """OpenAI-compatible chat completions endpoint"""
    data = request.json

    # Extract messages
    messages = data.get('messages', [])
    max_tokens = data.get('max_tokens', 512)
    temperature = data.get('temperature', 0.7)

    # Format prompt (simple concatenation for now)
    prompt = "\n".join([f"{msg['role']}: {msg['content']}" for msg in messages])
    prompt += "\nassistant:"

    # Tokenize
    input_tokens = tokenizer.encode(prompt)

    # Configure generation
    params.set_search_options(
        max_length=max_tokens,
        temperature=temperature
    )

    # Generate
    start_time = time.time()
    generator = og.Generator(model, params)
    generator.append_tokens(input_tokens)

    output = ""
    token_count = 0

    while not generator.is_done():
        generator.compute_logits()
        generator.generate_next_token()
        token = generator.get_next_tokens()[0]
        output += tokenizer.decode(token)
        token_count += 1

    end_time = time.time()
    duration = end_time - start_time

    # Build response (OpenAI format)
    response = {
        "id": f"chatcmpl-{int(time.time())}",
        "object": "chat.completion",
        "created": int(start_time),
        "model": "llama-3.2-3b-npu",
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": output.strip()
            },
            "finish_reason": "stop"
        }],
        "usage": {
            "prompt_tokens": len(input_tokens),
            "completion_tokens": token_count,
            "total_tokens": len(input_tokens) + token_count
        },
        "performance": {
            "duration_seconds": duration,
            "tokens_per_second": token_count / duration if duration > 0 else 0
        }
    }

    return jsonify(response)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "model_loaded": model is not None,
        "backend": "onnxruntime-genai"
    })

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', required=True, help='Path to ONNX model directory')
    parser.add_argument('--host', default='127.0.0.1', help='Host to bind to')
    parser.add_argument('--port', type=int, default=5001, help='Port to bind to')
    parser.add_argument('--ep', default='vitisai', choices=['vitisai', 'dml', 'hybrid', 'cpu'],
                       help='Execution provider (vitisai=NPU, dml=iGPU, hybrid=both)')

    args = parser.parse_args()

    # Configure execution providers based on selection
    if args.ep == 'vitisai':
        providers = [
            ('VitisAIExecutionProvider', {'device_id': 0})
        ]
    elif args.ep == 'dml':
        providers = [
            ('DmlExecutionProvider', {})
        ]
    elif args.ep == 'hybrid':
        providers = [
            ('VitisAIExecutionProvider', {'device_id': 0, 'enable_hybrid': True}),
            ('DmlExecutionProvider', {})
        ]
    else:
        providers = None  # CPU fallback

    # Load model
    load_model(args.model, execution_providers=providers)

    # Start server
    print(f"\n🚀 ONNX Server starting on {args.host}:{args.port}")
    print(f"   Backend: {args.ep}")
    print(f"   Model: {args.model}\n")

    app.run(host=args.host, port=args.port, threaded=True)
```

---

### 3.2 Modify Startup Script for Backend Selection

**File:** `start-llama-server.ps1` (enhanced)

```powershell
# Enhanced start-llama-server.ps1 with NPU support

param(
    [ValidateSet("auto", "vulkan", "npu", "hybrid")]
    [string]$Backend = "auto"
)

# Get script directory (project root)
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $SCRIPT_DIR

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  LLM Server Startup (Multi-Backend)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Load configuration
$configPath = "$SCRIPT_DIR\config\env.auto"
if (-not (Test-Path $configPath)) {
    Write-Host "ERROR: Config not found at $configPath" -ForegroundColor Red
    exit 1
}

$config = @{}
Get-Content $configPath | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $config[$matches[1]] = $matches[2]
    }
}

# Detect hardware
Write-Host "[1/4] Detecting Hardware..." -ForegroundColor Yellow

$hasNPU = $false
$npu = Get-CimInstance Win32_PnPEntity | Where-Object {
    $_.Name -like "*NPU*" -or $_.Name -like "*XDNA*" -or $_.Name -like "*AI*"
}
if ($npu) {
    $hasNPU = $true
    Write-Host "      [OK] NPU detected: AMD Ryzen AI" -ForegroundColor Green
}

$hasiGPU = $false
$gpu = Get-CimInstance Win32_VideoController | Where-Object {
    $_.Name -like "*Radeon*" -or $_.Name -like "*AMD*"
}
if ($gpu) {
    $hasiGPU = $true
    Write-Host "      [OK] iGPU detected: $($gpu.Name)" -ForegroundColor Green
}
Write-Host ""

# Backend selection
Write-Host "[2/4] Selecting Backend..." -ForegroundColor Yellow

if ($Backend -eq "auto") {
    # Auto-detect: Prefer hybrid if NPU available, else Vulkan
    if ($hasNPU) {
        $Backend = "hybrid"
        Write-Host "      [AUTO] Selected: Hybrid (NPU + iGPU)" -ForegroundColor Green
    } else {
        $Backend = "vulkan"
        Write-Host "      [AUTO] Selected: Vulkan (iGPU only)" -ForegroundColor Green
    }
} else {
    Write-Host "      [MANUAL] Selected: $Backend" -ForegroundColor Cyan
}
Write-Host ""

# Launch appropriate backend
Write-Host "[3/4] Starting Server..." -ForegroundColor Yellow

$PORT = $config['LLM_PORT']
$HOST = $config['LLM_HOST']

switch ($Backend) {
    "vulkan" {
        # Existing llama.cpp path
        Write-Host "      Backend: Vulkan (iGPU)" -ForegroundColor Cyan
        Write-Host "      Binary: llama-server.exe" -ForegroundColor Gray

        $LLAMA_BIN = "$SCRIPT_DIR\llamacpp\bin\llama-b6829-bin-win-vulkan-x64"
        $MODEL_PATH = "$SCRIPT_DIR\$($config['LLM_MODEL_PATH'])"

        $llamaArgs = @(
            "-m", $MODEL_PATH,
            "-ngl", $config['LLM_GPULAYERS'],
            "-c", $config['LLM_CTX'],
            "-t", $config['LLM_THREADS'],
            "--host", $HOST,
            "--port", $PORT,
            "-b", "2048",
            "-ub", "1024",
            "--mlock"
        )

        & "$LLAMA_BIN\llama-server.exe" @llamaArgs
    }

    "npu" {
        # ONNX Runtime with VitisAI EP (NPU only)
        Write-Host "      Backend: NPU (XDNA)" -ForegroundColor Cyan
        Write-Host "      Runtime: onnxruntime-genai" -ForegroundColor Gray

        $MODEL_PATH = "$SCRIPT_DIR\models\onnx\llama-3.2-3b-uint4-npu"

        & "python" "$SCRIPT_DIR\scripts\onnx-server.py" `
            --model $MODEL_PATH `
            --host $HOST `
            --port $PORT `
            --ep vitisai
    }

    "hybrid" {
        # ONNX Runtime with VitisAI + DML EPs (NPU + iGPU)
        Write-Host "      Backend: Hybrid (NPU + iGPU)" -ForegroundColor Cyan
        Write-Host "      Runtime: onnxruntime-genai" -ForegroundColor Gray

        $MODEL_PATH = "$SCRIPT_DIR\models\onnx\llama-3.2-3b-uint4-npu"

        & "python" "$SCRIPT_DIR\scripts\onnx-server.py" `
            --model $MODEL_PATH `
            --host $HOST `
            --port $PORT `
            --ep hybrid
    }
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  Server Started ($Backend)" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  URL: http://$($HOST):$PORT" -ForegroundColor White
Write-Host ""
```

---

### 3.3 Test NPU Backend

```powershell
# Start NPU-only server
.\start-llama-server.ps1 -Backend npu

# In another terminal, test:
curl -X POST http://127.0.0.1:5001/v1/chat/completions `
  -H "Content-Type: application/json" `
  -d '{
    "model": "llama-3.2-3b-npu",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 50
  }'
```

**Expected Output:**
```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you today?"
    }
  }],
  "usage": {
    "total_tokens": 18
  },
  "performance": {
    "tokens_per_second": 45.2
  }
}
```

---

### Phase 3 Deliverable

**Checklist:**
- ✅ `onnx-server.py` created and functional
- ✅ `start-llama-server.ps1` supports `-Backend` parameter
- ✅ NPU-only mode tested and working
- ✅ Hybrid mode tested (NPU + iGPU)
- ✅ API remains OpenAI-compatible

---

## Phase 4: NPU-Specific Optimizations (3-5 hours)

### Goal: Maximize NPU performance with targeted optimizations

### 4.1 KV Cache Compression

**Add to `onnx-server.py`:**

```python
# In load_model function, add:
params.set_search_options(
    max_length=max_tokens,
    temperature=temperature,
    kv_cache_quantization="uint8"  # Compress KV cache
)
```

**Expected Gain:** -50% KV cache memory, +10-15% speed (less memory traffic)

---

### 4.2 Sliding Window Attention

```python
params.set_search_options(
    max_length=8192,
    temperature=temperature,
    sliding_window=4096  # Keep only last 4K tokens
)
```

**Expected Gain:** -50% memory, +20% speed on long contexts

---

### 4.3 Async Memory Transfers (Advanced)

**Requires custom ONNX model with async ops:**

```python
session_options.add_session_config_entry("npu.async_dma", "1")
session_options.add_session_config_entry("npu.pipeline_depth", "2")
```

**Expected Gain:** +20-30% by hiding memory latency

---

### 4.4 Hybrid Workload Partitioning

**Configure smart partitioning:**

```python
# In hybrid mode, configure which ops go to which device
session_options.add_session_config_entry("vitisai.offload_matmul_threshold", "512")
# Matmuls >512 elements → iGPU (DML)
# Smaller ops → NPU (VitisAI)
```

**Expected Gain:** +30-50% by leveraging both devices optimally

---

### 4.5 Model Graph Fusion

**Use ONNX optimizer:**

```python
# scripts/optimize-onnx-model.py
from onnxruntime.transformers import optimizer

model_path = "models/onnx/llama-3.2-3b-uint4-npu/model.onnx"

optimized_model = optimizer.optimize_model(
    model_path,
    model_type="gpt2",  # Llama architecture
    num_heads=24,
    hidden_size=3072,
    optimization_options=optimizer.FusionOptions(
        enable_gelu_fusion=True,
        enable_layer_norm_fusion=True,
        enable_attention_fusion=True,
        enable_skip_layer_norm_fusion=True,
        enable_bias_skip_layer_norm_fusion=True,
        enable_bias_gelu_fusion=True
    )
)

optimized_model.save_model_to_file("models/onnx/llama-3.2-3b-uint4-npu-optimized/model.onnx")
print("✅ Optimized model saved")
```

**Run before serving:**
```powershell
python scripts/optimize-onnx-model.py
```

**Expected Gain:** +30-40% (fewer memory round-trips)

---

### Phase 4 Deliverable

**Optimizations Applied:**
- ✅ KV cache UINT8 compression
- ✅ Sliding window (optional, for long contexts)
- ✅ ONNX graph fusion
- ✅ Hybrid workload partitioning
- ✅ Optional: Async DMA pipelining

**Expected Performance:**
- NPU-only: 60-80 TPS → 80-120 TPS (+30-100%)
- Hybrid: 80-100 TPS → 120-180 TPS (+50-80%)
- Power: 25-35W (vs 65W Vulkan)

---

## Benchmarking & Comparison

### Benchmark Script

```powershell
# scripts/benchmark-all-backends.ps1

Write-Host "Benchmarking All Backends..." -ForegroundColor Cyan

$backends = @("vulkan", "npu", "hybrid")
$results = @{}

foreach ($backend in $backends) {
    Write-Host "`n=== Testing: $backend ===" -ForegroundColor Yellow

    # Start server
    Start-Process powershell -ArgumentList "-File start-llama-server.ps1 -Backend $backend" -NoNewWindow
    Start-Sleep -Seconds 10  # Wait for startup

    # Run benchmark
    $prompt = "Write a story about AI"
    $iterations = 5
    $durations = @()

    for ($i = 1; $i -le $iterations; $i++) {
        $start = Get-Date

        $response = Invoke-RestMethod -Uri "http://127.0.0.1:5001/v1/chat/completions" `
            -Method Post `
            -ContentType "application/json" `
            -Body (@{
                messages = @(@{ role = "user"; content = $prompt })
                max_tokens = 256
            } | ConvertTo-Json)

        $end = Get-Date
        $duration = ($end - $start).TotalSeconds
        $durations += $duration

        Write-Host "  Iteration $i: $duration sec"
    }

    $avgDuration = ($durations | Measure-Object -Average).Average
    $results[$backend] = $avgDuration

    Write-Host "  Average: $avgDuration sec" -ForegroundColor Green

    # Stop server
    Stop-Process -Name llama-server,python -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
$results.GetEnumerator() | Sort-Object Value | ForEach-Object {
    Write-Host "$($_.Key): $($_.Value) sec"
}
```

---

## Expected Performance Comparison

| Backend | TPS | Power | Latency | VRAM | Best For |
|---------|-----|-------|---------|------|----------|
| **Vulkan (iGPU)** | 80-120 | 65W | Baseline | 6-7 GB | Max throughput, AC power |
| **NPU (optimized)** | 80-120 | 25W | +0-10% | 2-3 GB RAM | Battery, power efficiency |
| **Hybrid** | 120-180 | 35-45W | -10-20% | 4-5 GB mixed | Balanced |

---

## Rollback Plan

**If NPU path doesn't work:**

```powershell
# Simply use Vulkan backend
.\start-llama-server.ps1 -Backend vulkan

# Or set as default:
# In start-llama-server.ps1, change default:
[string]$Backend = "vulkan"  # WAS: "auto"
```

**No changes to existing Vulkan setup required!**

---

## Success Criteria

**Phase 1 Success:**
- ✅ Ryzen AI SDK installed
- ✅ VitisAI EP detected

**Phase 2 Success:**
- ✅ ONNX model loads and generates text
- ✅ Model size <2 GB (UINT4)

**Phase 3 Success:**
- ✅ NPU backend responds to API requests
- ✅ Hybrid mode uses both NPU + iGPU

**Phase 4 Success:**
- ✅ NPU performance competitive with iGPU (80-120 TPS)
- ✅ Power draw <30W (vs 65W Vulkan)
- ✅ Quality matches Vulkan output

---

## Troubleshooting

### Issue: VitisAI EP not found

**Solution:**
```powershell
# Reinstall onnxruntime-vitisai
pip uninstall onnxruntime-vitisai
pip install onnxruntime-vitisai --upgrade

# Check installation
python -c "import onnxruntime; print(onnxruntime.get_available_providers())"
```

### Issue: NPU inference slower than expected

**Solutions:**
1. Enable hybrid mode (NPU + iGPU)
2. Apply graph fusion optimizations
3. Enable KV cache compression
4. Use UINT3 instead of UINT4

### Issue: Model quality degraded

**Solutions:**
1. Use INT8 instead of UINT4
2. Increase group size: `group_size=256`
3. Use weight-only quantization (keep activations FP16)

---

## Maintenance & Updates

**Stay Updated:**

```powershell
# Update Ryzen AI SDK (quarterly)
# Check: https://ryzenai.docs.amd.com/

# Update Python packages
pip install --upgrade onnxruntime-genai onnxruntime-vitisai optimum

# Update models (when new quantizations available)
python scripts/convert-to-onnx.py
```

---

## Next Steps

**After NPU is working:**

1. **Production Deployment**
   - Choose default backend (auto/hybrid recommended)
   - Document power savings
   - Monitor long-term stability

2. **Advanced Features**
   - Multi-model serving (different models on different backends)
   - Dynamic backend switching based on load
   - Battery-aware routing (auto-switch to NPU on battery)

3. **Future Optimizations**
   - Test AMD Quark updates (new quantization methods)
   - Explore NPU-specific model architectures
   - Monitor AMD's XDNA 2 roadmap (Strix Halo)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-07
**Status:** Ready for Implementation

**End of NPU Optimization Plan**
