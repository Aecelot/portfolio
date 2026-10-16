# TPS Optimization Suggestions for RTX 3060

## Implementation Status Checklist

- [x] **1. Increase GPU Layer Offload** - Updated `LLM_GPULAYERS` from 10 to 99 in `config/env.auto`
- [x] **2. Enable Flash Attention** - Set `LLM_FLASH_ATTENTION=1` in `config/env.auto`
- [x] **3. Optimize Batch Size** - Added `-b 512` and `-ub 256` to `start-llama.ps1` arguments
- [x] **4. Reduce Context Size** - Reduced to 1024 in `config/env.auto`
- [ ] **5. Optimize Threads** - Still at 4, could increase to match CPU cores (8-16)
- [x] **6. Benchmark Tool Created** - Created `scripts/benchmark-tps.ps1` for performance measurement
- [x] **7. Implement Prompt Caching** - Enabled `--cache-prompt` flag in startup scripts
- [ ] **8. Switch to vLLM** - Still using llama.cpp
- [ ] **9. Model Upgrades** - Still using Llama-3.2-1B, could upgrade to larger models
- [ ] **10. System-Level Optimizations** - Power mode, background apps, CUDA drivers not checked
- [ ] **11. Advanced: Multi-GPU Setup** - Not applicable (single GPU)

---

## Completed Optimizations

### ✅ 1. GPU Layer Offload Maximization
**Status:** IMPLEMENTED
- **Change:** `LLM_GPULAYERS=99` in `config/env.auto`
- **Impact:** 200-500% TPS increase by fully utilizing 12GB VRAM
- **Verification:** Check logs for "offloaded X/X layers to GPU" (should show all layers)

### ✅ 2. Flash Attention Enabled
**Status:** IMPLEMENTED
- **Change:** `LLM_FLASH_ATTENTION=1` in `config/env.auto`
- **Impact:** 20-30% TPS increase, reduced memory overhead
- **Verification:** Look for `--flash-attn` in startup arguments

### ✅ 3. Batch Size Optimization
**Status:** IMPLEMENTED
- **Change:** Added `-b 512` (prompt) and `-ub 256` (generation) to `start-llama.ps1`
- **Impact:** 15-25% TPS improvement through parallel processing
- **Verification:** Check startup logs for batch size parameters

### ✅ 4. Performance Benchmarking Tool
**Status:** IMPLEMENTED
- **Created:** `scripts/benchmark-tps.ps1`
- **Features:** Measures prompt processing and generation TPS
- **Usage:** `.\scripts\benchmark-tps.ps1`
- **Output:** Saves results to `performance/benchmark_tps_[timestamp].json`

---

## Pending Optimizations

### ✅ 5. Context Size Reduction
**Status:** IMPLEMENTED
- **Change:** `LLM_CTX=1024` in `config/env.auto`
- **Impact:** 10-15% TPS gain by reducing KV cache
- **Verification:** Restart server and monitor memory usage

### ⏳ 6. CPU Thread Optimization
**Priority:** LOW
- **Current:** `LLM_THREADS=4` in `config/env.auto`
- **Recommendation:** Increase to match CPU cores (typically 8-16)
- **Impact:** 5-10% improvement (minimal since GPU does most work)
- **Steps:** Check CPU cores with `Get-CimInstance Win32_Processor`

### ✅ 7. Prompt Caching Implementation
**Priority:** MEDIUM
- **Status:** IMPLEMENTED (LlamaCPP native `--cache-prompt` flag enabled)
- **Location:** [`start-llama.ps1`](start-llama.ps1:140), [`start-llama-server.ps1`](start-llama-server.ps1:100)
- **Impact:** 15-25% reduction in overhead for repetitive queries (5-20x speedup for repeated prompt prefixes)
- **Implementation:** Enabled `--cache-prompt` flag in both startup scripts for automatic KV cache reuse
- **How it works:** LlamaCPP automatically caches and reuses KV states for identical prompt prefixes
- **Best use case:** Multi-turn conversations with shared system prompts (use stateful sessions for maximum benefit)

### ⏳ 8. vLLM Migration (Advanced)
**Priority:** LOW
- **Current:** Using llama.cpp
- **Impact:** 50-100% speedup potential
- **Consideration:** Only needed for production-level serving with batching
- **Steps:** `pip install vllm`, update adapters for OpenAI-compatible API

### ⏳ 9. Model Upgrades
**Priority:** MEDIUM
- **Current:** Llama-3.2-1B-Instruct-Q4_K_M (~600MB)
- **Options:**
  - Mistral-7B-Instruct-v0.3-Q4_K_M (~4GB) - Better quality, still fast
  - Llama-3.1-8B-Instruct-Q5_K_M (~5.5GB) - Best balance for RTX 3060
- **Impact:** 5-7x quality improvement with minimal speed loss

### ⏳ 10. System-Level Optimizations
**Priority:** LOW
- **Actions:**
  - Close background applications
  - Enable high-performance power mode
  - Verify CUDA drivers (11.8+)
- **Impact:** 5-15% by reducing thermal throttling
- **Verification:** Run `nvidia-smi` to check GPU usage

---

## Quick Wins Summary (Already Implemented)

**Expected Performance Improvements:**
- **Prompt Processing:** 10x+ improvement (~1000-3000 t/s)
- **Generation:** 3-5x improvement (~100-200 t/s)

**Files Modified:**
- [`config/env.auto`](config/env.auto) - GPU layers, flash attention, and context size
- [`start-llama.ps1`](start-llama.ps1) - Batch size optimization
- [`scripts/benchmark-tps.ps1`](scripts/benchmark-tps.ps1) - Performance measurement (created)

**Next Steps:**
1. Restart `start-llama.ps1` terminal to apply changes
2. Run `.\scripts\benchmark-tps.ps1` to measure improvements
3. Consider implementing medium priority items (7, 9)

---

## Monitoring and Validation

### Benchmark Commands
```powershell
# Quick TPS test
.\scripts\benchmark-tps.ps1

# Custom benchmark (5 tests, 200 tokens each)
.\scripts\benchmark-tps.ps1 -NumTests 5 -GenerateTokens 200
```

### Verification Commands
```powershell
# Check GPU usage
nvidia-smi

# Check CPU cores
(Get-CimInstance Win32_Processor).NumberOfLogicalProcessors

# Check CUDA version
nvcc --version
```

### Logs to Monitor
- `llm_load_tensors: offloaded X/X layers to GPU` (should show all layers)
- `eval time` and `prompt eval time` for TPS measurements
- GPU memory usage and temperature