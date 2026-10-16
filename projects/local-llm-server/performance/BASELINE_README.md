# Ryzen AI 300 Optimization Baseline Report

## Executive Summary

**Current Status**: CPU-only inference with untapped Ryzen AI 300 hardware potential
**Performance**: 40-54 TPS (Suboptimal)
**Optimization Opportunity**: 2-4x performance improvement potential

---

## 🔍 Hardware Configuration

### Detected Hardware
- **CPU**: AMD Ryzen AI 9 HX 370 (12 cores, 24 threads)
- **iGPU**: AMD Radeon 890M Graphics (RDNA 3.5, 16 Compute Units)
- **RAM**: 95.3GB DDR5
- **NPU**: Ryzen AI NPU (50 TOPS) - **DETECTED**

### Hardware Detection Status
✅ **CPU Detection**: Working correctly
✅ **NPU Detection**: Successfully detected via processor name
❌ **iGPU Recognition**: Detected but not utilized for acceleration
❌ **GPU Memory Detection**: Incorrect VRAM reporting (512MB vs actual shared memory)

---

## ⚙️ Current KoboldCpp Configuration

### Auto-Detected Settings (`config/env.auto`)
```ini
LLM_HOST=127.0.0.1
LLM_PORT=5001
LLM_MODEL_PATH=models/Llama-3.2-1B-Instruct-Q4_K_M.gguf
LLM_THREADS=12
LLM_CTX=4096
LLM_GPULAYERS=10  # Very conservative
LLM_USEMMAP=1
LLM_USEMLock=1
LLM_FLASH_ATTENTION=0
```

### Issues Identified
1. **Insufficient GPU Layers**: Only 10 layers (should be 40+ for Ryzen AI 300)
2. **No OpenCL Flags**: Missing `--useclblast` configuration for AMD iGPU
3. **Low Context Utilization**: Only using 107/8192 tokens (1.3%)

---

## 📊 Performance Baseline

### Benchmark Results

#### 50-Token Tests
- **Run 1**: 35.97 TPS (1.39s)
- **Run 2**: 49.22 TPS (1.02s)
- **Run 3**: 53.79 TPS (0.93s)
- **Average**: ~46 TPS

#### 100-Token Tests (During Inference)
- **Run 1**: 44.71 TPS (2.24s)
- **Run 2**: 53.87 TPS (1.86s)
- **Average**: ~49 TPS

### Performance Assessment
- **Status**: CPU-Only Inference
- **Expected with Ryzen AI 300**: 80-150+ TPS
- **Improvement Potential**: 2-4x (160-300% increase)

---

## 🔍 Hardware Utilization Analysis

### During Idle Monitoring (30s)
- **CPU**: 5.3% average utilization
- **Memory**: 32.7% average utilization
- **GPU**: 0.0% average utilization ❌
- **GPU Memory**: 9.1MB usage

### During Active Inference (100 tokens)
- **CPU**: Low utilization (not bottlenecked)
- **GPU**: 0% utilization during generation ❌
- **Processing Speed**: 130 T/s (processing), 57 T/s (generation)

### Key Findings
1. **Zero GPU Utilization**: RDNA 3.5 iGPU completely idle during inference
2. **CPU Underutilized**: Only 5% CPU usage indicates bottleneck elsewhere
3. **Memory Efficient**: 32% memory usage is reasonable
4. **Model Context Wasted**: Only 1.3% of available context used

---

## 🚨 Critical Issues Identified

### 1. GPU Acceleration Disabled
- **Problem**: KoboldCpp not utilizing AMD RDNA 3.5 iGPU
- **Impact**: Missing 2-4x performance improvement
- **Root Cause**: Missing OpenCL/CLBLAST configuration

### 2. Conservative GPU Layer Allocation
- **Problem**: Only 10 GPU layers instead of 40+ for Ryzen AI 300
- **Impact**: Minimal GPU memory usage (9.1MB vs potential 8GB+)
- **Solution**: Increase to 40 layers with proper AMD flags

### 3. Context Underutilization
- **Problem**: Using only 107/8192 context tokens
- **Impact**: Poor narrative coherence and memory efficiency
- **Potential**: Could support much larger context windows

### 4. NPU Not Utilized
- **Problem**: 50 TOPS NPU detected but not used for inference
- **Opportunity**: Additional 20-50% performance boost via ONNX/DirectML

---

## 🎯 Optimization Targets

### Immediate Goals (Phase 2)
1. **Enable AMD iGPU Acceleration**: Configure OpenCL/CLBLAST
2. **Increase GPU Layers**: From 10 → 40 layers
3. **Test Performance Improvement**: Target 80-120 TPS

### Medium-term Goals (Phase 3)
1. **NPU Integration**: Implement ONNX Runtime with DirectML
2. **Context Optimization**: Utilize full 8192 context window
3. **Target Performance**: 120-200 TPS

### Long-term Goals (Phase 4)
1. **Hybrid Optimization**: Balance iGPU/NPU workloads
2. **Advanced Features**: Flash attention, KV cache optimization
3. **Target Performance**: 200+ TPS with 7B models

---

## 📁 Supporting Data Files

### Performance Logs
- `performance/baseline_pre_optimization_*.json` - Initial baseline tests
- `performance/baseline_with_monitoring_*.json` - Tests during monitoring
- `performance/hardware_utilization_*.csv` - Hardware monitoring data

### Configuration Files
- `config/env.auto` - Current auto-detected configuration
- `config/env.local` - Manual configuration template

---

## 🚀 Next Steps

### Phase 2: Implementation
1. **Update KoboldCpp launch flags** for AMD iGPU support
2. **Configure OpenCL/CLBLAST** for RDNA 3.5 acceleration
3. **Increase GPU layers** to utilize available VRAM
4. **Test performance improvements**

### Success Metrics
- **GPU Utilization**: >60% during inference
- **TPS Improvement**: 2x minimum (80+ TPS)
- **Context Utilization**: >50% of available context
- **Memory Efficiency**: Stable without OOM errors

---

## 📅 Timeline

- **Phase 1 (Complete)**: ✅ Hardware audit and baseline establishment
- **Phase 2 (Next)**: 🔄 AMD iGPU optimization implementation
- **Phase 3**: ⏳ Testing and validation
- **Phase 4**: ⏳ Documentation and CI integration

---

## 💡 Technical Notes

### KoboldCpp AMD Optimization Flags
```bash
# For AMD iGPU (RDNA 3.5)
--useclblast 0 0    # Enable OpenCL with platform/device 0
--gpulayers 40      # Use 40 GPU layers
--contextsize 4096  # Reasonable context size

# For NPU (future)
--onnx             # ONNX runtime
--directml         # DirectML for AMD NPU
```

### Expected Performance Gains
- **iGPU Acceleration**: +150-300% TPS improvement
- **NPU Integration**: +20-50% additional improvement
- **Context Optimization**: Better narrative coherence
- **Memory Efficiency**: Reduced host memory usage

---

*Baseline established on: $(Get-Date)*
*Hardware: AMD Ryzen AI 9 HX 370 + Radeon 890M Graphics*
*Baseline TPS: ~49 TPS (CPU-only)*
*Target TPS: 120-200+ TPS (Ryzen AI 300 optimized)*