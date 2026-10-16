# Functional Design Document - Current LLM Server Setup

**Document Version:** 1.0
**Date:** 2025-11-07
**Purpose:** Document current operational setup for brainstorming future improvements

---

## 1. Executive Summary

This document describes the current functional design of the local LLM inference server running on AMD Ryzen AI 300 Series hardware. The system leverages llama.cpp's llama-server with Vulkan GPU acceleration to provide OpenAI-compatible API endpoints for local language model inference.

### Current Capabilities
- Local LLM inference with Vulkan GPU acceleration (AMD Radeon 890M)
- OpenAI-compatible REST API endpoints
- Multiple model support (currently using Llama 3.2 3B)
- Automatic hardware detection and optimization
- Web UI for interactive chat

### Key Metrics
- **GPU Offload:** 100% (all 29 layers on GPU)
- **VRAM Usage:** 2.9 GB / 16 GB (18% utilization)
- **Context Window:** 8,192 tokens (model supports 131,072)
- **Concurrent Users:** 1 slot (single request at a time)

---

## 2. System Architecture

### 2.1 Component Stack

```
┌─────────────────────────────────────────────┐
│  Client Applications                         │
│  (Browser, API Clients, Python, etc.)       │
└──────────────────┬──────────────────────────┘
                   │ HTTP REST API
┌──────────────────▼──────────────────────────┐
│  llama-server.exe                           │
│  - HTTP Server (port 5001)                  │
│  - Request Processing                       │
│  - Session Management (1 slot)              │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  llama.cpp Inference Engine                 │
│  - Model Loading (GGUF)                     │
│  - Token Processing                         │
│  - KV Cache Management                      │
│  - Flash Attention                          │
└──────────────────┬──────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
┌────────▼────────┐  ┌──────▼──────┐
│  Vulkan Backend │  │ CPU Backend │
│  (GPU Layers)   │  │ (Fallback)  │
└────────┬────────┘  └──────┬──────┘
         │                   │
┌────────▼────────┐  ┌──────▼──────┐
│ AMD Radeon 890M │  │ Ryzen AI 9  │
│ iGPU (16GB VRAM)│  │ HX 370      │
│ RDNA 3.5        │  │ 12C/24T     │
└─────────────────┘  └─────────────┘
```

### 2.2 File Structure

```
Local-LLM-Server/
├── config/
│   └── env.auto                    # Auto-generated config (active)
│
├── llamacpp/bin/
│   ├── llama-b6829-bin-win-vulkan-x64/      # ACTIVE: Vulkan (AMD)
│   │   ├── llama-server.exe
│   │   ├── ggml-vulkan.dll
│   │   ├── ggml-rpc.dll
│   │   └── ggml-cpu-icelake.dll
│   ├── llama-b6829-bin-win-cuda-12.4-x64/   # NVIDIA alternative
│   └── llama-b6829-bin-win-cpu-x64/         # CPU-only fallback
│
├── models/
│   ├── llama-3.2-3b-instruct-q4_k_m.gguf    # ACTIVE (1.87 GB)
│   ├── SmolLM2-135M-Instruct-Q5_K_M.gguf    # Alternative (105 MB)
│   └── Llama-3.2-1B-Instruct-Q4_K_M.gguf    # Alternative (~1.3 GB)
│
├── scripts/
│   └── detect-hardware.ps1         # Hardware detection script
│
├── start-llama-server.ps1          # MAIN STARTUP SCRIPT
│
└── docs/
    ├── TECHNICAL_DESIGN.md
    └── FUNCTIONAL_DESIGN_CURRENT_SETUP.md  # This document
```

---

## 3. Hardware Configuration

### 3.1 Detected Hardware Profile

| Component | Specification | Utilization |
|-----------|--------------|-------------|
| **CPU** | AMD Ryzen AI 9 HX 370 | 12 threads active (50%) |
| **Cores** | 12 physical / 24 logical | |
| **iGPU** | AMD Radeon 890M (RDNA 3.5) | 60-80% during inference |
| **VRAM** | 16 GB (BIOS-allocated UMA) | 2.9 GB used (18%) |
| **System RAM** | 79.8 GB available | Variable |
| **NPU** | Ryzen AI NPU (50 TOPS) | Unused (detected but not active) |

### 3.2 Hardware Detection Process

**Automatic Detection Flow:**
1. User runs `start-llama-server.ps1`
2. Script loads `config/env.auto`
3. GPU detection via WMI queries:
   - Checks for NVIDIA → selects CUDA binary
   - Checks for AMD Radeon → selects Vulkan binary
   - Fallback → CPU binary
4. Selected: **Vulkan binary** (AMD Radeon 890M detected)

**Manual Re-optimization:**
```powershell
.\scripts\detect-hardware.ps1 -Detailed
```
This regenerates `config/env.auto` with optimized settings.

---

## 4. Active Model Configuration

### 4.1 Current Model: Llama 3.2 3B Instruct

```
Model File: llama-3.2-3b-instruct-q4_k_m.gguf
Location:   <models-dir>\
```

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Parameters** | 3.21 billion | 28 transformer layers |
| **File Size** | 1.87 GB | Q4_K_M quantization |
| **Quantization** | Q4_K_M | 5.01 bits per weight |
| **Context Window** | 131,072 tokens max | Using 8,192 currently |
| **Languages** | 8 languages | EN, DE, FR, IT, PT, HI, ES, TH |
| **License** | Apache 2.0 | Commercial use allowed |
| **Source** | Meta (Facebook) | Llama 3.2 series |

### 4.2 GPU Offloading Status

```
┌─────────────────────────────────────────┐
│ Model Layers: 28 transformer blocks     │
│ Output Layer: 1 projection layer        │
│ Total Layers: 29                        │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ GPU Offload (Vulkan):  29/29 (100%)     │
│ CPU Fallback:          0/29  (0%)       │
└─────────────────────────────────────────┘
```

**Memory Allocation:**
```
GPU (Vulkan0):
├── Model Weights:     1,918 MB
├── KV Cache:            896 MB (8,192 context)
├── Compute Buffers:     131 MB
└── Total:            ~2,945 MB (2.9 GB)

CPU (Mapped):
└── Model Metadata:      308 MB (memory-mapped)

Available VRAM:       ~13 GB unused
```

### 4.3 Alternative Models

| Model | Size | Layers | Use Case | Status |
|-------|------|--------|----------|--------|
| **Llama 3.2 3B** | 1.87 GB | 28 | Current production | ✅ Active |
| Llama 3.2 1B | ~1.3 GB | Unknown | Lightweight fallback | Available |
| SmolLM2-135M | 105 MB | 30 | Testing, fast inference | Available |

---

## 5. Runtime Configuration

### 5.1 Active Configuration File: `config/env.auto`

```ini
LLM_HOST=127.0.0.1                # Localhost binding (security)
LLM_PORT=5001                     # HTTP server port
LLM_MODEL_PATH=models\llama-3.2-3b-instruct-q4_k_m.gguf

# Performance Settings
LLM_GPULAYERS=99                  # Offload all layers (actual: 29)
LLM_CTX=8192                      # Context window (tokens)
LLM_THREADS=12                    # CPU threads (50% of 24)

# Memory Management
LLM_USEMMAP=1                     # Memory-mapped file I/O
LLM_USEMLock=1                    # Lock pages in RAM (no swap)

# GPU Backend (Vulkan/OpenCL)
LLM_USECLBLAST=1                  # Legacy OpenCL flag
LLM_CLBLAST_PLATFORM=0
LLM_CLBLAST_DEVICE=0

# Advanced Features
LLM_FLASH_ATTENTION=0             # Auto-enabled by llama-server
LLM_NO_KV_OFFLOAD=0               # KV cache on GPU enabled
```

### 5.2 Command-Line Arguments (Generated)

The startup script converts config to:

```bash
llama-server.exe \
  -m "models\llama-3.2-3b-instruct-q4_k_m.gguf" \
  -ngl 99 \                       # GPU layers
  -c 8192 \                       # Context size
  -t 12 \                         # Threads
  --host 127.0.0.1 \
  --port 5001 \
  -b 512 \                        # Batch size
  -ub 256 \                       # Micro-batch
  --mlock                         # Memory locking
```

---

## 6. API Endpoints

### 6.1 Available Endpoints

| Endpoint | Method | Purpose | OpenAI Compatible |
|----------|--------|---------|-------------------|
| `/v1/chat/completions` | POST | Chat completions | ✅ Yes |
| `/completion` | POST | Text completion | ❌ llama.cpp specific |
| `/health` | GET | Health check | ❌ No |
| `/` | GET | Web UI | ❌ No |
| `/v1/models` | GET | List models | ✅ Yes (partial) |

### 6.2 Primary Endpoint: Chat Completions

**URL:** `POST http://127.0.0.1:5001/v1/chat/completions`

**Request (OpenAI Format):**
```json
{
  "model": "llama-3.2-3b-instruct",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "What is the capital of France?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 2048,
  "stream": false
}
```

**Response:**
```json
{
  "id": "chatcmpl-123456",
  "object": "chat.completion",
  "created": 1699000000,
  "model": "llama-3.2-3b-instruct",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The capital of France is Paris."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 28,
    "completion_tokens": 8,
    "total_tokens": 36
  }
}
```

### 6.3 Web UI Access

**URL:** `http://127.0.0.1:5001`

Features:
- Interactive chat interface
- Model parameter controls (temperature, top_p, etc.)
- Real-time token streaming
- Session history (in-memory, single slot)

---

## 7. Startup & Shutdown Procedures

### 7.1 Server Startup Sequence

**Command:**
```powershell
.\start-llama-server.ps1
```

**Initialization Steps:**
```
[1/3] GPU Detection
├── Scan Win32_VideoController
├── Detect: AMD Radeon 890M
└── Select: Vulkan binary

[2/3] Configuration Loading
├── Read: config/env.auto
├── Model: llama-3.2-3b-instruct-q4_k_m.gguf
├── GPU Layers: 99
├── Context: 8192
└── Threads: 12

[3/3] Server Launch
├── Load backend: ggml-rpc.dll
├── Load backend: ggml-vulkan.dll
├── Detect Vulkan devices (1 found)
├── Load backend: ggml-cpu-icelake.dll
└── Bind HTTP server: 127.0.0.1:5001

[Model Loading]
├── Parse GGUF metadata (37 KV pairs, 255 tensors)
├── Allocate Vulkan buffers (1,918 MB)
├── Offload 29/29 layers to GPU
└── Memory-map CPU portion (308 MB)

[Context Initialization]
├── Construct llama_context
├── Allocate KV cache (896 MB on GPU)
├── Enable Flash Attention (auto)
├── Warm-up model (empty run)
└── Initialize slot (id=0, ctx=8192)

[Server Ready]
├── HTTP server listening: 127.0.0.1:5001
├── HTTP worker threads: 23
├── Prompt cache enabled: 8,192 MB limit
└── Status: Idle, waiting for requests
```

**Typical Startup Time:** 5-10 seconds

### 7.2 Server Shutdown

**Manual Shutdown:**
```powershell
# Find process
Get-Process llama-server

# Stop gracefully
Stop-Process -Name llama-server -Force
```

**Automatic Cleanup:**
- KV cache cleared from VRAM
- Memory-mapped files unmapped
- HTTP connections closed
- Vulkan resources released

---

## 8. Performance Characteristics

### 8.1 Resource Utilization (Current)

| Resource | Usage | Capacity | Utilization |
|----------|-------|----------|-------------|
| **VRAM** | 2.9 GB | 16 GB | 18% |
| **GPU Compute** | 60-80% | 100% | Variable |
| **CPU Threads** | 12 | 24 | 50% |
| **System RAM** | ~5-10 GB | 79.8 GB | ~10% |

### 8.2 Performance Metrics (Observed)

| Metric | Value | Notes |
|--------|-------|-------|
| **Graph Splits** | 2 | Extremely efficient |
| **Flash Attention** | Enabled | Auto-detected |
| **KV Cache Strategy** | On GPU | Fast context reuse |
| **Batch Processing** | 512 / 256 | Batch / micro-batch |

**Inference Speed:** Not yet benchmarked (TBD)

### 8.3 Bottlenecks & Headroom

**Current Bottlenecks:**
- ⚠️ Single slot (1 concurrent user only)
- ⚠️ Context limited to 8K (model supports 131K)
- ⚠️ NPU unused (50 TOPS idle)

**Available Headroom:**
- ✅ 13 GB VRAM unused → Can support 4-6x larger context
- ✅ 12 CPU threads unused → Can handle more concurrent slots
- ✅ UMA bandwidth → Shared memory flexibility

---

## 9. Limitations & Constraints

### 9.1 Functional Limitations

| Area | Current State | Limitation | Impact |
|------|--------------|------------|--------|
| **Concurrency** | 1 slot | Single request at a time | Low throughput |
| **Network** | Localhost only | No external access | Local use only |
| **Authentication** | None | Open on localhost | Security risk if exposed |
| **Model Switching** | Requires restart | No hot-swap | Downtime for changes |
| **Context** | 8,192 / 131,072 | Underutilized | Truncates long conversations |
| **Monitoring** | None | No metrics | Blind operation |

### 9.2 Technical Constraints

**Hardware:**
- Shared memory architecture (UMA) - competes with CPU
- Vulkan backend less mature than CUDA
- NPU requires DirectML/ONNX runtime integration

**Software:**
- Static binary selection (cannot switch GPU backend at runtime)
- No distributed inference (single node only)
- No persistent session storage

### 9.3 Capacity Planning

**Current Capacity:**
- **Max Concurrent Users:** 1 (single slot)
- **Max Context Length:** 8,192 tokens (configured)
- **Max Model Size:** ~10-12 GB (VRAM constraint)

**Theoretical Capacity (with optimization):**
- **Max Concurrent Users:** 4-8 slots (with VRAM headroom)
- **Max Context Length:** 32,768-65,536 tokens (VRAM permitting)
- **Max Model Size:** 13-14 GB (7B-8B models Q4 quantized)

---

## 10. Security & Access Control

### 10.1 Security Posture

**Network Security:**
```
Binding: 127.0.0.1:5001
├── Accessible: Localhost only
├── Firewall: Windows Firewall (default)
├── Encryption: None (HTTP, not HTTPS)
└── External Access: Blocked
```

**Authentication:**
- ❌ No API keys
- ❌ No user authentication
- ❌ No rate limiting
- ✅ Localhost-only access (implicit security)

**Data Privacy:**
```
Processing: 100% local
├── No cloud API calls
├── No telemetry
├── No logging to disk (by default)
└── Prompt cache: Memory-only (cleared on restart)
```

### 10.2 Risk Assessment

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Unauthorized local access | Low | Medium | Localhost binding |
| Port scanning | Low | Low | Firewall |
| Prompt injection | Medium | Medium | Application-level validation |
| Resource exhaustion (DoS) | Low | Medium | Single slot limits abuse |
| Model file theft | Low | Low | OS file permissions |
| Memory dumping | Very Low | Medium | OS security |

---

## 11. Operational Procedures

### 11.1 Standard Operations

**Start Server:**
```powershell
.\start-llama-server.ps1
# Wait 5-10 seconds for initialization
# Access: http://127.0.0.1:5001
```

**Check Status:**
```powershell
# Process check
Get-Process llama-server

# Health check
curl http://127.0.0.1:5001/health
```

**Stop Server:**
```powershell
Stop-Process -Name llama-server -Force
```

### 11.2 Model Switching

**Procedure:**
1. Stop server: `Stop-Process -Name llama-server -Force`
2. Edit config: `notepad config\env.auto`
3. Change: `LLM_MODEL_PATH=models\<new-model>.gguf`
4. Start server: `.\start-llama-server.ps1`
5. Verify in startup logs

**Supported Model Changes:**
- SmolLM2-135M-Instruct-Q5_K_M.gguf (fast)
- Llama-3.2-1B-Instruct-Q4_K_M.gguf (balanced)
- llama-3.2-3b-instruct-q4_k_m.gguf (current)

### 11.3 Hardware Re-optimization

**When to Run:**
- After BIOS changes (VRAM allocation)
- After hardware upgrades
- After driver updates
- Manual optimization needed

**Procedure:**
```powershell
# Run hardware detection
.\scripts\detect-hardware.ps1 -Detailed

# Review auto-generated config
cat config\env.auto

# Restart with new config
Stop-Process -Name llama-server -Force
.\start-llama-server.ps1
```

---

## 12. Monitoring & Observability

### 12.1 Available Monitoring

**Process-Level (Windows):**
- Task Manager: CPU, RAM, GPU usage
- Resource Monitor: Detailed breakdowns
- `Get-Process llama-server`: PowerShell stats

**Application-Level:**
- Startup logs (stderr): Model loading, GPU detection
- HTTP logs (stdout): Request timestamps
- Error messages: Console output

**Health Endpoint:**
```bash
curl http://127.0.0.1:5001/health
```

### 12.2 Missing Observability

Current **gaps** in monitoring:

❌ **No metrics endpoint** (Prometheus, StatsD)
❌ **No performance dashboard** (Grafana, etc.)
❌ **No token/s measurements** (inference speed)
❌ **No request tracing** (latency breakdown)
❌ **No cache hit rate visibility**
❌ **No structured logging** (JSON logs)
❌ **No alerting** (failures, slowdowns)

---

## 13. Integration Capabilities

### 13.1 Current Integrations

**Direct API Access:**
```python
# Python example
import requests

response = requests.post(
    'http://127.0.0.1:5001/v1/chat/completions',
    json={
        'model': 'llama-3.2-3b-instruct',
        'messages': [{'role': 'user', 'content': 'Hello'}]
    }
)
print(response.json())
```

**Web Browser:**
- Built-in UI at `http://127.0.0.1:5001`
- Interactive chat
- Parameter tuning

### 13.2 Compatible Clients

**OpenAI SDK:**
```python
from openai import OpenAI

client = OpenAI(
    base_url='http://127.0.0.1:5001/v1',
    api_key='not-needed'  # No auth required
)

response = client.chat.completions.create(
    model='llama-3.2-3b-instruct',
    messages=[{'role': 'user', 'content': 'Hi'}]
)
```

**Potential Integrations:**
- LangChain (OpenAI-compatible endpoint)
- LlamaIndex (custom connector)
- Unreal Engine 5 (HTTP REST plugin)
- Unity (HTTP client)
- Cursor/Continue (IDE code completion)

---

## 14. Troubleshooting Guide

### 14.1 Common Issues

**Problem:** Server won't start
```
Symptoms: Immediate exit, no logs
Diagnosis:
  1. Check model file exists
  2. Verify binary exists (llama-server.exe)
  3. Check port 5001 not in use

Solution:
  dir models\llama-3.2-3b-instruct-q4_k_m.gguf
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5001).OwningProcess
  Stop conflicting process or change LLM_PORT
```

**Problem:** GPU not detected
```
Symptoms: Using CPU binary instead of Vulkan
Diagnosis:
  .\scripts\detect-hardware.ps1 -Detailed
  Check for "AMD GPU detected"

Solution:
  - Update AMD drivers
  - Check BIOS: Enable iGPU, allocate VRAM
  - Manually select Vulkan binary path
```

**Problem:** Slow inference
```
Symptoms: Long response times
Diagnosis:
  - Check logs: "offloaded 29/29" (should be 100%)
  - Check GPU utilization in Task Manager

Solution:
  - Increase LLM_GPULAYERS=99
  - Reduce LLM_CTX if memory-bound
  - Close background GPU applications
```

**Problem:** Out of memory
```
Symptoms: Crash during long contexts
Diagnosis:
  - Check VRAM usage: 2.9 GB + (context size factor)
  - 8K context = ~900 MB KV cache
  - 16K context = ~1.8 GB KV cache

Solution:
  - Reduce LLM_CTX (e.g., 4096)
  - Switch to smaller model (1B or SmolLM2)
  - Reduce LLM_GPULAYERS (offload less to GPU)
```

### 14.2 Diagnostic Commands

```powershell
# Check hardware
.\scripts\detect-hardware.ps1 -Detailed

# View config
cat config\env.auto

# Check process
Get-Process llama-server | Format-List *

# Test endpoint
curl http://127.0.0.1:5001/health

# Check VRAM
Get-CimInstance -ClassName Win32_VideoController |
  Select Name, AdapterRAM, DriverVersion
```

---

## 15. Improvement Opportunities

### 15.1 Performance Improvements (Priority Ranked)

**High Impact, Low Effort:**

1. **Increase Context Window** (8K → 16K or 32K)
   - **Rationale:** Underutilizing model capacity (131K max)
   - **VRAM Cost:** +900 MB per 8K context
   - **Benefit:** 4x longer conversations, larger documents
   - **Effort:** Change `LLM_CTX=16384` in config

2. **Enable Multi-Slot Serving** (1 → 4-8 slots)
   - **Rationale:** 13 GB VRAM unused
   - **VRAM Cost:** ~3-4 GB per slot (with 8K context)
   - **Benefit:** 4-8x throughput, concurrent users
   - **Effort:** Add `--parallel 4` flag to llama-server

3. **Benchmark & Optimize Batch Sizes**
   - **Rationale:** Current 512/256 not validated
   - **Test:** 1024/512, 2048/1024 for higher throughput
   - **Benefit:** Potential 10-30% speed improvement
   - **Effort:** Experiment with `-b` and `-ub` parameters

**Medium Impact, Medium Effort:**

4. **Upgrade to Larger Model** (3B → 7B/8B)
   - **Rationale:** VRAM headroom allows it
   - **VRAM Cost:** ~5-7 GB (Q4 quantized)
   - **Benefit:** Better quality, reasoning
   - **Effort:** Download model, update config

5. **Explore NPU Integration**
   - **Rationale:** 50 TOPS unused
   - **Requirement:** DirectML/ONNX runtime
   - **Benefit:** Hybrid inference (CPU+GPU+NPU)
   - **Effort:** High (research, testing, integration)

6. **Flash Attention Explicit Config**
   - **Rationale:** Currently auto-enabled
   - **Test:** Force enable with different params
   - **Benefit:** Marginal speed improvement
   - **Effort:** Add `--flash-attn` flag

### 15.2 Feature Additions

**Monitoring & Observability:**
1. **Add Prometheus Metrics Endpoint**
   - Tokens/s, requests/s, latency percentiles
   - Cache hit rates, GPU utilization
   - Export to Grafana dashboard

2. **Structured Logging**
   - JSON logs with request IDs
   - Log rotation, compression
   - Queryable for analysis

3. **Performance Benchmarking Suite**
   - Automated token/s measurement
   - Latency profiling
   - Regression testing

**Scalability:**
4. **External Network Access** (optional)
   - Bind to `0.0.0.0` for LAN access
   - Add API key authentication
   - TLS/SSL support (HTTPS)

5. **Model Hot-Swapping API**
   - Endpoint: `POST /v1/admin/load-model`
   - No server restart required
   - Graceful transition

6. **Persistent Session Storage**
   - Save conversation history to SQLite
   - Resume sessions across restarts
   - Long-term memory

**Advanced Features:**
7. **RAG (Retrieval-Augmented Generation)**
   - Vector database integration (ChromaDB, Qdrant)
   - Document embedding pipeline
   - Semantic search for context

8. **Function Calling Support**
   - Define tools/functions in request
   - Structured JSON outputs
   - Agent capabilities

9. **Streaming Responses**
   - Server-Sent Events (SSE)
   - Real-time token streaming
   - Better UX for long generations

### 15.3 Operational Improvements

**Automation:**
1. **Windows Service Wrapper**
   - Auto-start on boot
   - Graceful shutdown
   - Auto-restart on failure

2. **Configuration UI**
   - Web-based config editor
   - Live parameter tuning
   - Hardware profile presets

3. **Health Monitoring & Alerting**
   - Email/SMS alerts on failures
   - Watchdog for auto-recovery
   - Scheduled health checks

**Testing:**
4. **Automated Test Suite**
   - Smoke tests (connectivity)
   - Performance benchmarks (token/s)
   - Regression tests (quality)

5. **Load Testing**
   - Simulate concurrent users
   - Measure breaking points
   - Optimize for peak load

---

## 16. Benchmarking Plan

### 16.1 Performance Metrics to Collect

**Inference Speed:**
- [ ] **Prompt Processing:** Tokens/s (context encoding)
- [ ] **Generation Speed:** Tokens/s (output generation)
- [ ] **First Token Latency:** Time to first output token
- [ ] **Total Latency:** End-to-end request time

**Throughput:**
- [ ] **Requests/Minute:** Single slot capacity
- [ ] **Concurrent Requests:** Multi-slot performance (future)

**Resource Usage:**
- [ ] **GPU Utilization:** Percentage during inference
- [ ] **VRAM Usage:** Actual vs. allocated
- [ ] **CPU Usage:** Thread utilization
- [ ] **Memory Bandwidth:** UMA contention

**Quality Metrics:**
- [ ] **Response Coherence:** Subjective evaluation
- [ ] **Context Retention:** Long conversation test
- [ ] **Instruction Following:** Accuracy on tasks

### 16.2 Benchmark Tools

**llama.cpp Built-in:**
```powershell
.\llamacpp\bin\llama-b6829-bin-win-vulkan-x64\llama-bench.exe `
  -m models\llama-3.2-3b-instruct-q4_k_m.gguf `
  -ngl 99 -t 12
```

**Custom API Benchmark (Python):**
```python
import time
import requests

# Measure latency
start = time.time()
response = requests.post(
    'http://127.0.0.1:5001/v1/chat/completions',
    json={'model': 'llama-3.2-3b-instruct', 'messages': [...]}
)
latency = time.time() - start
tokens = response.json()['usage']['total_tokens']
tokens_per_sec = tokens / latency
```

**Recommended Baseline Tests:**
1. Short prompt (50 tokens) → 512 tokens output
2. Medium prompt (500 tokens) → 512 tokens output
3. Long prompt (2000 tokens) → 512 tokens output
4. Context stress test (8000 tokens) → 512 tokens output

---

## 17. Cost-Benefit Analysis

### 17.1 Operating Costs

**Hardware:**
- AMD Ryzen AI 9 HX 370 system: ~$1,500-2,000 (one-time)
- 16 GB VRAM allocation: $0 (BIOS setting)
- Storage: ~$0.10/GB for models

**Electricity:**
- Idle power: ~15-25W
- Load power: ~65-85W (CPU + iGPU)
- Cost: ~$0.01-0.02/hour (US avg $0.15/kWh)
- **Monthly (24/7):** ~$7-15

**Maintenance:**
- Driver updates: Free
- Model downloads: Free (Hugging Face)
- Software updates: Free (llama.cpp open source)

### 17.2 Cloud Comparison

**OpenAI GPT-3.5 Turbo Pricing:**
- Input: $0.50 per 1M tokens
- Output: $1.50 per 1M tokens
- Average: ~$1.00 per 1M tokens

**Break-Even Analysis:**
```
Local server cost: $10/month (electricity)
Cloud usage equivalent: 10M tokens/month

At 100 requests/day × 1000 tokens avg:
  = 3M tokens/month
  = $3/month (cloud)
  → Local is more expensive at low usage

At 1000 requests/day × 1000 tokens avg:
  = 30M tokens/month
  = $30/month (cloud)
  → Local saves $20/month

Break-even: ~333 requests/day
```

**Value Adds (Local):**
- ✅ **Privacy:** No data sent to cloud
- ✅ **Latency:** <100ms local vs. 200-500ms cloud
- ✅ **Offline:** Works without internet
- ✅ **Customization:** Fine-tuning, model selection
- ✅ **No rate limits:** Unlimited usage

---

## 18. Compliance & Data Governance

### 18.1 Data Handling

**Prompt Data:**
- **Storage:** In-memory only (KV cache)
- **Retention:** Session lifetime (cleared on reset)
- **Persistence:** None (unless user implements logging)
- **Logging:** Not enabled by default

**Model Weights:**
- **Location:** `models/` directory (local filesystem)
- **Licensing:** Apache 2.0 (Llama 3.2), Apache 2.0 (SmolLM2)
- **Distribution:** User downloads from Hugging Face
- **Modifications:** Allowed under Apache 2.0

**Response Caching:**
- **Prompt Cache:** In-memory (8,192 MB limit)
- **Cleared:** On server restart
- **Purpose:** Speed optimization (prefix reuse)

### 18.2 Regulatory Compliance

**GDPR (EU Data Protection):**
- ✅ No data sent to third parties (fully local)
- ✅ No persistent storage of user data
- ✅ User has full control (runs on own hardware)
- ⚠️ If user logs prompts, must handle GDPR compliance

**HIPAA (Healthcare Data - US):**
- ✅ Local processing (reduces exposure)
- ⚠️ No encryption at rest (models/prompts unencrypted)
- ⚠️ No audit logging (cannot prove compliance)
- ❌ Not HIPAA-compliant without additional safeguards

**Recommendations for Compliance:**
1. Add disk encryption (BitLocker) for model storage
2. Implement audit logging (JSON logs with request IDs)
3. Add authentication (API keys) if accessible beyond localhost
4. Document data retention policies

---

## 19. Future Roadmap (Prioritized)

### Phase 1: Optimization (Weeks 1-2)

**Goal:** Maximize current hardware utilization

- [ ] Increase context to 16K-32K
- [ ] Run comprehensive benchmarks (establish baseline)
- [ ] Test larger models (7B/8B Llama models)
- [ ] Optimize batch sizes for throughput

**Expected Outcomes:**
- 2-4x larger context capacity
- Documented performance baselines
- Quality improvement with larger model

### Phase 2: Scalability (Weeks 3-4)

**Goal:** Support multiple concurrent users

- [ ] Enable multi-slot serving (4-8 slots)
- [ ] Implement request queueing
- [ ] Add streaming responses (SSE)
- [ ] Test concurrent load

**Expected Outcomes:**
- 4-8x throughput improvement
- Better user experience (streaming)
- Defined capacity limits

### Phase 3: Observability (Weeks 5-6)

**Goal:** Visibility into performance

- [ ] Add Prometheus metrics endpoint
- [ ] Create Grafana dashboard
- [ ] Implement structured logging (JSON)
- [ ] Add performance alerts

**Expected Outcomes:**
- Real-time performance monitoring
- Historical trend analysis
- Proactive issue detection

### Phase 4: Advanced Features (Weeks 7-8)

**Goal:** Expand capabilities

- [ ] Model hot-swapping API
- [ ] RAG integration (vector DB)
- [ ] Function calling support
- [ ] NPU exploration (if feasible)

**Expected Outcomes:**
- No-downtime model switching
- Document Q&A capability
- Agent/tool use capabilities

---

## 20. Known Issues & Limitations

### 20.1 Current Known Issues

| Issue | Severity | Workaround | Planned Fix |
|-------|----------|------------|-------------|
| Single slot bottleneck | Medium | Queue requests client-side | Phase 2: Multi-slot |
| No performance monitoring | Low | Manual Task Manager checks | Phase 3: Metrics |
| Context underutilized (8K/131K) | Low | Increase LLM_CTX | Phase 1: Config change |
| NPU unused | Low | N/A | Phase 4: Research |
| No authentication | Medium | Localhost-only binding | Phase 2 (optional) |
| No streaming responses | Low | Poll for completion | Phase 2: SSE |

### 20.2 Technical Debt

**Configuration Management:**
- Manual editing of `env.auto` required for changes
- No validation of config values
- No rollback mechanism

**Testing:**
- No automated test suite
- No regression testing
- No performance benchmarks

**Deployment:**
- No service wrapper (manual start/stop)
- No auto-restart on failure
- No graceful shutdown handling

---

## Appendix A: Configuration Reference

### Complete `env.auto` Parameter Guide

```ini
# ===== NETWORK =====
LLM_HOST=<IP>               # Bind address (127.0.0.1 = localhost)
LLM_PORT=<PORT>             # HTTP port (default: 5001)

# ===== MODEL =====
LLM_MODEL_PATH=<PATH>       # Relative or absolute path to .gguf

# ===== PERFORMANCE =====
LLM_GPULAYERS=<0-99>        # GPU layers (99 = all, 0 = CPU-only)
LLM_CTX=<SIZE>              # Context window (tokens)
LLM_THREADS=<NUM>           # CPU threads (1-24)

# ===== MEMORY =====
LLM_USEMMAP=<0|1>           # Memory-mapped I/O (1 = enabled)
LLM_USEMLock=<0|1>          # Lock memory (prevent swap)

# ===== GPU BACKEND =====
LLM_USECLBLAST=<0|1>        # OpenCL BLAS (legacy, Vulkan doesn't need)
LLM_CLBLAST_PLATFORM=<IDX>  # OpenCL platform index
LLM_CLBLAST_DEVICE=<IDX>    # OpenCL device index

# ===== ADVANCED =====
LLM_FLASH_ATTENTION=<0|1>   # Flash Attention (0=auto, 1=force)
LLM_NO_KV_OFFLOAD=<0|1>     # Disable KV cache GPU offload
```

**Recommended Values (Current Hardware):**
```ini
LLM_GPULAYERS=99            # Offload everything
LLM_CTX=16384               # Use 2x current (still plenty of VRAM)
LLM_THREADS=12              # Half of logical CPUs
LLM_USEMMAP=1               # Always enable
LLM_USEMLock=1              # Prevent swapping
```

---

## Appendix B: Model Selection Guide

### Choosing the Right Model

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| **SmolLM2-135M** | 105 MB | ⚡⚡⚡⚡⚡ | ⭐⭐ | Testing, fast responses |
| **Llama 3.2 1B** | 1.3 GB | ⚡⚡⚡⚡ | ⭐⭐⭐ | Lightweight chat |
| **Llama 3.2 3B** | 1.87 GB | ⚡⚡⚡ | ⭐⭐⭐⭐ | Current (balanced) |
| Llama 3.1 7B (Q4) | ~5 GB | ⚡⚡ | ⭐⭐⭐⭐⭐ | High quality |
| Llama 3.1 8B (Q4) | ~6 GB | ⚡⚡ | ⭐⭐⭐⭐⭐ | High quality |

**VRAM Capacity Check:**
```
Available VRAM: 16 GB
Current usage:  2.9 GB (Llama 3.2 3B)
Headroom:      13.1 GB

Can fit:
✅ Llama 3.1 7B Q4 (~5 GB model + 3 GB context = 8 GB total)
✅ Llama 3.1 8B Q4 (~6 GB model + 3 GB context = 9 GB total)
```

---

## Appendix C: Useful Commands

### Daily Operations

```powershell
# Start server
.\start-llama-server.ps1

# Check if running
Get-Process llama-server

# Stop server
Stop-Process -Name llama-server -Force

# View config
cat config\env.auto

# Test API
curl http://127.0.0.1:5001/health

# Check VRAM usage
nvidia-smi  # (if NVIDIA)
Get-CimInstance Win32_VideoController  # (for AMD)
```

### Maintenance

```powershell
# Re-detect hardware
.\scripts\detect-hardware.ps1 -Detailed

# List available models
dir models\*.gguf

# Check GPU info
Get-CimInstance Win32_VideoController | Format-List *

# Monitor resource usage
Get-Process llama-server | Format-Table Name, CPU, WorkingSet
```

---

## Document Metadata

**Version:** 1.0
**Created:** 2025-11-07
**Last Updated:** 2025-11-07
**Author:** System Documentation
**Purpose:** Baseline for future improvements

---

**End of Document**
