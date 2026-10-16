# Vulkan iGPU Optimization Implementation Plan

**Target Hardware:** AMD Radeon 890M (RDNA 3.5) with 16GB VRAM
**Current Model:** Llama 3.2 3B Instruct (Q4_K_M)
**Goal:** Maximize throughput and minimize latency on existing Vulkan backend

---

## Executive Summary

This plan optimizes the existing llama.cpp + Vulkan setup without changing the core stack. Expected improvements: **+300-600% throughput** through batching, multi-slot serving, context expansion, and speculative decoding.

**Estimated Time Investment:**
- Phase 1 (Quick Wins): 30 minutes
- Phase 2 (Medium Effort): 1-2 hours
- Phase 3 (Advanced): 2-3 hours
- Total: 4-6 hours

**Expected Results:**
- Throughput: 1 req/min → 4-8 req/min (multi-slot)
- Latency: Baseline → 50-70% reduction (speculative decoding)
- Quality: No degradation (same model)
- VRAM Usage: 2.9 GB → 5-7 GB (still <50% of 16 GB)

---

## Phase 1: Quick Wins (30 minutes)

### Goal: Immediate 2-3x performance boost with minimal changes

### 1.1 Increase Batch Sizes

**Current State:**
```powershell
-b 512    # Batch size
-ub 256   # Micro-batch size
```

**Optimization:**
```powershell
-b 2048   # 4x increase
-ub 1024  # 4x increase
```

**Rationale:**
- RDNA 3.5 has 768 stream processors (underutilized at 512)
- Larger batches = better GPU saturation
- VRAM headroom supports it (13 GB unused)

**Expected Gain:** +20-40% throughput

**VRAM Impact:** +200-400 MB (negligible)

**Implementation:**
```powershell
# Edit start-llama-server.ps1, line ~98-99
# Change:
$llamaArgs = @(
    # ... existing args ...
    "-b", "2048",    # WAS: 512
    "-ub", "1024"    # WAS: 256
)
```

**Testing:**
```powershell
# Before change: Benchmark
.\start-llama-server.ps1
# Run 10 requests, measure avg latency

# After change: Benchmark
# Run same 10 requests, compare latency
```

---

### 1.2 Enable Flash Attention Explicitly

**Current State:**
```ini
LLM_FLASH_ATTENTION=0  # Auto-detect
```

**Optimization:**
```ini
LLM_FLASH_ATTENTION=1  # Force enable
```

**And add to startup args:**
```powershell
$llamaArgs += @("--flash-attn")
```

**Rationale:**
- Flash Attention reduces memory I/O for attention computation
- Already auto-enabled, but explicit is more reliable
- Especially effective on contexts >2K tokens

**Expected Gain:** +10-20% on longer contexts

**VRAM Impact:** None (algorithm change only)

**Implementation:**

**Step 1:** Edit `config/env.auto`
```ini
# Line 12, change:
LLM_FLASH_ATTENTION=1  # WAS: 0
```

**Step 2:** Edit `start-llama-server.ps1`
```powershell
# Add after line ~104 (after --mlock):
if ($config['LLM_FLASH_ATTENTION'] -eq "1") {
    $llamaArgs += @("--flash-attn")
}
```

**Testing:**
```powershell
# Check server logs on startup:
# Should see: "llama_context: Flash Attention was auto, set to enabled"
```

---

### 1.3 Increase Context Window

**Current State:**
```ini
LLM_CTX=8192  # 8K context
```

**Optimization:**
```ini
LLM_CTX=16384  # 16K context (2x increase)
```

**Rationale:**
- Model supports up to 131,072 tokens
- Better prompt caching (reuse longer prefixes)
- Supports longer conversations without truncation
- VRAM cost minimal: 896 MB → 1,792 MB KV cache

**Expected Gain:** +30-50% on multi-turn conversations (from caching)

**VRAM Impact:** +896 MB (total: 3.8 GB / 16 GB = 24%)

**Implementation:**
```ini
# Edit config/env.auto, line 2:
LLM_CTX=16384  # WAS: 8192
```

**Testing:**
```powershell
# Start server, check logs:
# Should see: "llama_context: n_ctx = 16384"

# Test long conversation:
# Send 20-turn conversation, verify no truncation
```

---

### 1.4 Optimize Thread Count

**Current State:**
```ini
LLM_THREADS=12  # 50% of 24 threads
```

**Optimization:**
```ini
LLM_THREADS=8   # 33% of threads (less CPU overhead)
```

**Rationale:**
- With 100% GPU offload, CPU mainly handles HTTP/scheduling
- Fewer threads = less context switching overhead
- More threads available for OS/background tasks

**Expected Gain:** +5-15% (situational)

**VRAM Impact:** None

**Implementation:**
```ini
# Edit config/env.auto, line 6:
LLM_THREADS=8  # WAS: 12

# Alternative: Test with 16 threads if you want more CPU involvement
# LLM_THREADS=16
```

**Testing:**
```powershell
# Benchmark with 8, 12, 16, and 24 threads
# Pick the fastest configuration for your workload
```

---

### Phase 1 Summary

**Changes Made:**
1. ✅ Batch sizes: 512 → 2048, 256 → 1024
2. ✅ Flash Attention: Auto → Explicit
3. ✅ Context: 8K → 16K
4. ✅ Threads: 12 → 8 (or test 16)

**Expected Results:**
- Throughput: +60-100%
- Latency: -20-30%
- VRAM: 2.9 GB → 3.8 GB

**Time Investment:** 30 minutes

**Rollback Plan:**
```powershell
# Revert config/env.auto to original values
# Restart server
```

---

## Phase 2: Multi-Slot Concurrent Serving (1-2 hours)

### Goal: 4-8x throughput via parallel request handling

### 2.1 Enable Parallel Slots

**Current State:**
```
Single slot (n_slots=1)
- 1 request at a time
- GPU idle between requests
```

**Optimization:**
```powershell
--parallel 4  # 4 concurrent slots
```

**Rationale:**
- Current VRAM usage: 3.8 GB (24%)
- 4 slots estimate: ~5-6 GB (37%)
- Massive throughput gain for multi-user scenarios

**Expected Gain:** +300% throughput (4x concurrent)

**VRAM Impact:** +1.2-2.2 GB (shared weights, 4× KV caches)

**Implementation:**

**Step 1:** Edit `start-llama-server.ps1`
```powershell
# Add after batch args (~line 100):
$llamaArgs += @(
    "--parallel", "4",        # 4 concurrent slots
    "--cont-batching"         # Enable continuous batching
)
```

**Step 2:** Test scaling
```powershell
# Start with 2 slots, then 4, then 6
# Monitor VRAM usage in Task Manager
# Pick max slots that fit in VRAM comfortably
```

**Testing:**
```powershell
# Send 4 concurrent requests (use separate terminals):
# Terminal 1:
curl -X POST http://127.0.0.1:5001/v1/chat/completions -d '...'

# Terminal 2:
curl -X POST http://127.0.0.1:5001/v1/chat/completions -d '...'

# Terminal 3:
curl -X POST http://127.0.0.1:5001/v1/chat/completions -d '...'

# Terminal 4:
curl -X POST http://127.0.0.1:5001/v1/chat/completions -d '...'

# All should process in parallel
```

---

### 2.2 Configure Prompt Caching

**Current State:**
```
Prompt cache enabled (default)
Cache size: 8192 MB limit
No explicit reuse settings
```

**Optimization:**
```powershell
--cache-prompt              # Explicit enable
--cache-reuse 16384         # Reuse up to 16K tokens
```

**Rationale:**
- Reuses computed KV cache for repeated prompts
- System prompts computed once, reused forever
- Huge win for multi-turn conversations

**Expected Gain:** +50-200% on repeated prefixes

**VRAM Impact:** None (uses existing cache allocation)

**Implementation:**
```powershell
# Add to start-llama-server.ps1 args:
$llamaArgs += @(
    "--cache-prompt",
    "--cache-reuse", "16384"  # Match context size
)
```

**Testing:**
```powershell
# Test 1: Send same system prompt 10 times
# First request: Slow (compute KV cache)
# Requests 2-10: Fast (reuse cached KV)

# Test 2: Multi-turn conversation
# Each turn reuses previous context (cached)
```

---

### 2.3 Enable Continuous Batching

**Current State:**
```
Static batching (wait for full batch)
```

**Optimization:**
```powershell
--cont-batching  # Dynamic batching
```

**Rationale:**
- Don't wait for full batch to fill
- Process requests as they arrive
- Better latency for bursty traffic

**Expected Gain:** -30-50% latency (lower wait times)

**VRAM Impact:** None

**Implementation:**
```powershell
# Already added in 2.1 (--cont-batching flag)
```

---

### 2.4 Optimize Slot Context Allocation

**Current State:**
```
Each slot gets full 16K context
4 slots × 16K = 64K total allocation
```

**Optimization:**
```powershell
--ctx-size 16384       # Per-slot context
--slots-endpoint       # Enable slot management API
```

**Rationale:**
- Allows monitoring which slots are active
- Can tune per-slot context dynamically
- Better resource allocation

**Implementation:**
```powershell
# Add to start-llama-server.ps1:
$llamaArgs += @(
    "--ctx-size", "16384",    # Per-slot context
    "--slots-endpoint"        # Enable /slots endpoint
)
```

**Testing:**
```powershell
# Check slot status:
curl http://127.0.0.1:5001/slots

# Should show 4 slots with status (idle/processing)
```

---

### Phase 2 Summary

**Changes Made:**
1. ✅ Parallel slots: 1 → 4
2. ✅ Continuous batching enabled
3. ✅ Prompt caching configured (16K reuse)
4. ✅ Slot management API enabled

**Expected Results:**
- Throughput: +300-400% (4× concurrent users)
- Latency: -30-50% (continuous batching)
- Cache hits: +50-200% on repeated prompts
- VRAM: 3.8 GB → 5-6 GB (37%)

**Time Investment:** 1-2 hours

---

## Phase 3: Advanced Optimizations (2-3 hours)

### Goal: Maximize performance with advanced techniques

### 3.1 Speculative Decoding (Draft Model)

**Concept:**
- Use small fast model (SmolLM2-135M) to predict 4-16 tokens
- Use main model (Llama 3.2 3B) to verify predictions in parallel
- Accept correct predictions, reject wrong ones
- Net speedup: 2-4× on generation

**Implementation:**

**Step 1:** Verify draft model exists
```powershell
dir models\SmolLM2-135M-Instruct-Q5_K_M.gguf
# Should show 105 MB file
```

**Step 2:** Add speculative decoding args
```powershell
# Edit start-llama-server.ps1, add:
$llamaArgs += @(
    "--draft", "models\SmolLM2-135M-Instruct-Q5_K_M.gguf",
    "--draft-max", "16",      # Predict up to 16 tokens
    "--draft-min", "4",       # Minimum 4 tokens
    "--draft-p-min", "0.9"    # Accept if confidence >90%
)
```

**Expected Gain:** +100-300% generation speed (2-4× faster)

**VRAM Impact:** +105 MB (SmolLM2 model)

**Trade-offs:**
- Adds complexity
- Requires compatible llama.cpp version (build 3000+)
- May reduce quality slightly (if draft predictions wrong)

**Testing:**
```powershell
# Check server logs on startup:
# Should see: "draft model loaded: SmolLM2-135M-Instruct"

# Benchmark generation speed:
# Before: X tokens/sec
# After: 2-4X tokens/sec (if working)
```

**Fallback if not working:**
```powershell
# Remove --draft args
# Speculative decoding requires recent llama.cpp build
```

---

### 3.2 Memory Optimizations

**Current State:**
```ini
LLM_USEMMAP=1   # Memory-mapped I/O
```

**Optimization:**
```ini
LLM_USEMMAP=0   # Direct allocation (better for Vulkan)
```

**Rationale:**
- Vulkan prefers direct GPU memory allocation
- mmap is slower for GPU backends (designed for CPU)
- Direct alloc reduces one memory copy layer

**Expected Gain:** +5-10%

**VRAM Impact:** None (allocation method change)

**Implementation:**
```ini
# Edit config/env.auto, line 7:
LLM_USEMMAP=0  # WAS: 1
```

```powershell
# Edit start-llama-server.ps1:
# Remove --mlock from args (conflicts with no-mmap)
# Or conditionally add based on USEMMAP flag
```

**Testing:**
```powershell
# Check startup logs:
# Should NOT see "mmap" in memory allocation lines
```

---

### 3.3 NUMA Optimization

**Concept:**
- Distribute memory allocation across NUMA nodes
- Reduces memory controller contention
- Better for multi-threaded workloads

**Implementation:**
```powershell
# Add to start-llama-server.ps1 args:
$llamaArgs += @(
    "--numa", "distribute"  # Spread across memory controllers
)
```

**Expected Gain:** +5-10% (multi-threaded scenarios)

**VRAM Impact:** None

**Testing:**
```powershell
# Start server, check logs:
# Should see: "NUMA: distribute"
```

---

### 3.4 Vulkan Backend Tuning

**Current State:**
```
Using default Vulkan settings
```

**Optimization:**
```powershell
# Set Vulkan environment variables before starting server
$env:VK_LAYER_PATH = ""  # Disable validation layers (faster)
$env:AMD_VULKAN_ICD = "NATIVE"  # Use native AMD driver

# In start-llama-server.ps1, add before launching:
$env:VK_LAYER_PATH = ""
$env:AMD_VULKAN_ICD = "NATIVE"
```

**Expected Gain:** +5-15% (removes driver overhead)

**Implementation:**
```powershell
# Edit start-llama-server.ps1, add near top:
# Optimize Vulkan driver
$env:VK_LAYER_PATH = ""
$env:AMD_VULKAN_ICD = "NATIVE"
$env:HSA_OVERRIDE_GFX_VERSION = "11.0.0"  # RDNA 3.5 target
```

---

### 3.5 Larger Models (Optional)

**Current:** Llama 3.2 3B (1.87 GB)

**Upgrade Options:**

| Model | Size | VRAM (w/ 4 slots) | Quality | Fit? |
|-------|------|-------------------|---------|------|
| **Llama 3.2 3B** (current) | 1.87 GB | ~6 GB | ⭐⭐⭐⭐ | ✅ |
| Llama 3.1 7B Q4 | ~5 GB | ~12 GB | ⭐⭐⭐⭐⭐ | ✅ |
| Llama 3.1 8B Q4 | ~6 GB | ~14 GB | ⭐⭐⭐⭐⭐ | ✅ |
| Llama 3.1 8B Q5 | ~7.5 GB | ~16+ GB | ⭐⭐⭐⭐⭐ | ⚠️ Tight |

**Recommendation:** Test Llama 3.1 7B Q4 with 2-3 slots for better quality.

**Implementation:**
```powershell
# Download model:
huggingface-cli download bartowski/Meta-Llama-3.1-7B-Instruct-GGUF `
  Meta-Llama-3.1-7B-Instruct-Q4_K_M.gguf `
  --local-dir models

# Update config/env.auto:
LLM_MODEL_PATH=models\Meta-Llama-3.1-7B-Instruct-Q4_K_M.gguf

# Reduce slots to 2-3 to fit in VRAM
```

---

### Phase 3 Summary

**Advanced Changes:**
1. ✅ Speculative decoding with SmolLM2 draft model
2. ✅ Direct memory allocation (no mmap)
3. ✅ NUMA distribution
4. ✅ Vulkan driver optimization
5. ⚠️ Optional: Upgrade to 7B model

**Expected Results:**
- Generation speed: +100-300% (speculative decoding)
- Memory efficiency: +10-15% (direct alloc + NUMA)
- Quality: No change (or better with 7B model)
- VRAM: 5-6 GB (3B) or 12-14 GB (7B)

**Time Investment:** 2-3 hours

---

## Complete Optimized Configuration

### Final `config/env.auto`

```ini
LLM_HOST=127.0.0.1
LLM_PORT=5001
LLM_MODEL_PATH=models\llama-3.2-3b-instruct-q4_k_m.gguf

# Performance Settings
LLM_GPULAYERS=99           # All layers on GPU
LLM_CTX=16384              # 16K context (2× increase)
LLM_THREADS=8              # Optimized thread count
LLM_FLASH_ATTENTION=1      # Explicit enable

# Memory Management
LLM_USEMMAP=0              # Direct allocation (Vulkan-optimized)
LLM_USEMLock=1             # Lock memory

# GPU Backend (Vulkan - CLBlast not used)
LLM_USECLBLAST=0           # Disabled for Vulkan
LLM_CLBLAST_PLATFORM=0
LLM_CLBLAST_DEVICE=0

# Advanced
LLM_NO_KV_OFFLOAD=0        # KV cache on GPU
```

### Final `start-llama-server.ps1` additions

```powershell
# Add after config loading, before server launch:

# Vulkan optimizations
$env:VK_LAYER_PATH = ""
$env:AMD_VULKAN_ICD = "NATIVE"
$env:HSA_OVERRIDE_GFX_VERSION = "11.0.0"

# Build optimized arguments
$llamaArgs = @(
    "-m", $MODEL_PATH,
    "-ngl", "99",
    "-c", "16384",                      # 16K context
    "-t", "8",                          # 8 threads
    "--host", $SERVER_HOST,
    "--port", $PORT,
    "-b", "2048",                       # Large batch
    "-ub", "1024",                      # Large micro-batch
    "--mlock",
    "--flash-attn",                     # Explicit flash attention
    "--parallel", "4",                  # 4 concurrent slots
    "--cont-batching",                  # Continuous batching
    "--cache-prompt",                   # Prompt caching
    "--cache-reuse", "16384",
    "--ctx-size", "16384",
    "--slots-endpoint",                 # Slot management API
    "--numa", "distribute",             # NUMA optimization
    "--draft", "models\SmolLM2-135M-Instruct-Q5_K_M.gguf",  # Speculative decoding
    "--draft-max", "16",
    "--draft-min", "4",
    "--draft-p-min", "0.9"
)
```

---

## Benchmarking & Validation

### Benchmark Script

```powershell
# scripts/benchmark-vulkan.ps1

param(
    [int]$Iterations = 10,
    [int]$MaxTokens = 512
)

$prompt = "Write a detailed story about a dragon discovering modern technology."

Write-Host "Running benchmark: $Iterations iterations, $MaxTokens tokens each" -ForegroundColor Cyan

$results = @()

for ($i = 1; $i -le $Iterations; $i++) {
    Write-Host "Iteration $i/$Iterations..." -NoNewline

    $start = Get-Date

    $response = Invoke-RestMethod -Uri "http://127.0.0.1:5001/v1/chat/completions" `
        -Method Post `
        -ContentType "application/json" `
        -Body (@{
            model = "llama-3.2-3b-instruct"
            messages = @(
                @{ role = "user"; content = $prompt }
            )
            max_tokens = $MaxTokens
            temperature = 0.7
        } | ConvertTo-Json)

    $end = Get-Date
    $duration = ($end - $start).TotalSeconds

    $tokens = $response.usage.total_tokens
    $tps = $tokens / $duration

    $results += @{
        Iteration = $i
        Duration = $duration
        Tokens = $tokens
        TPS = $tps
    }

    Write-Host " Done ($duration sec, $tps TPS)" -ForegroundColor Green
}

# Calculate statistics
$avgDuration = ($results | Measure-Object -Property Duration -Average).Average
$avgTPS = ($results | Measure-Object -Property TPS -Average).Average
$minTPS = ($results | Measure-Object -Property TPS -Minimum).Minimum
$maxTPS = ($results | Measure-Object -Property TPS -Maximum).Maximum

Write-Host "`nResults:" -ForegroundColor Cyan
Write-Host "  Average Duration: $avgDuration seconds"
Write-Host "  Average TPS: $avgTPS tokens/sec"
Write-Host "  Min TPS: $minTPS"
Write-Host "  Max TPS: $maxTPS"
```

### Metrics to Track

| Metric | Baseline | Phase 1 | Phase 2 | Phase 3 | Target |
|--------|----------|---------|---------|---------|--------|
| **Latency (avg)** | TBD | -20-30% | -40-50% | -50-70% | <2s |
| **Throughput (TPS)** | TBD | +60-100% | +100-200% | +200-400% | 100+ TPS |
| **Concurrent Users** | 1 | 1 | 4 | 4 | 4-8 |
| **VRAM Usage** | 2.9 GB | 3.8 GB | 5-6 GB | 6-7 GB | <10 GB |
| **Cache Hit Rate** | Unknown | Improved | High | Very High | >70% |

---

## Rollback Plan

If optimizations cause issues:

```powershell
# Revert config/env.auto:
git checkout config/env.auto

# Revert start-llama-server.ps1:
git checkout start-llama-server.ps1

# Restart server:
Stop-Process -Name llama-server -Force
.\start-llama-server.ps1
```

**Incremental Testing:**
- Test each phase independently
- Benchmark after each change
- Keep notes on what works/doesn't work
- Roll back individual changes if needed

---

## Troubleshooting

### Issue: Out of VRAM

**Symptoms:** Server crashes, "out of memory" errors

**Solutions:**
1. Reduce parallel slots: `--parallel 2` (instead of 4)
2. Reduce context: `LLM_CTX=8192` (instead of 16384)
3. Disable speculative decoding (remove `--draft` args)

### Issue: Slow startup

**Symptoms:** Server takes >30 seconds to start

**Solutions:**
1. Check model file size (should be 1.87 GB)
2. Disable mlock if causing issues
3. Check VRAM not full from previous instance

### Issue: Lower quality outputs

**Symptoms:** Draft model predictions often wrong

**Solutions:**
1. Increase draft confidence: `--draft-p-min 0.95` (from 0.9)
2. Reduce draft tokens: `--draft-max 8` (from 16)
3. Disable speculative decoding entirely

### Issue: Slots not working

**Symptoms:** Only 1 request processed at a time

**Solutions:**
1. Check llama.cpp version supports `--parallel`
2. Verify `--cont-batching` flag is set
3. Check logs for slot initialization errors

---

## Success Criteria

**Phase 1 Success:**
- ✅ 2-3× throughput improvement
- ✅ Server starts without errors
- ✅ VRAM usage <25%

**Phase 2 Success:**
- ✅ 4 concurrent requests processed simultaneously
- ✅ Prompt cache hit rate >50%
- ✅ VRAM usage <50%

**Phase 3 Success:**
- ✅ Speculative decoding shows 2-4× generation speedup
- ✅ Overall throughput 5-8× baseline
- ✅ No quality degradation

---

## Next Steps After Optimization

1. **Monitor Production Performance**
   - Track metrics over time
   - Identify bottlenecks
   - Tune based on usage patterns

2. **Consider Model Upgrade**
   - Test Llama 3.1 7B for better quality
   - Evaluate VRAM trade-offs

3. **Explore NPU Path** (separate plan)
   - If power efficiency becomes priority
   - Or for hybrid NPU+iGPU setup

---

## Estimated Final Performance

**Conservative Estimate:**

| Metric | Baseline | Optimized | Improvement |
|--------|----------|-----------|-------------|
| Throughput | 1 req/min | 5-8 req/min | **+400-700%** |
| Latency | X sec | 0.3-0.5X sec | **-50-70%** |
| VRAM Usage | 2.9 GB | 6-7 GB | +130% |
| Concurrent Users | 1 | 4 | **+300%** |
| Cache Hit Rate | Low | 70-90% | **+300-500%** |

**Optimistic Estimate (with speculative decoding working well):**

| Metric | Best Case |
|--------|-----------|
| Throughput | **10-12 req/min** (+900-1100%) |
| Generation Speed | **200-300 TPS** (vs ~60-80 baseline) |
| Latency | **0.2-0.3× baseline** (-70-80%) |

---

**Document Version:** 1.0
**Last Updated:** 2025-11-07
**Status:** Ready for Implementation

**End of Vulkan Optimization Plan**
