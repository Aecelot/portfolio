# 🚀 LlamaCPP C++ Control Tool - Complete Setup Guide

This comprehensive guide provides step-by-step instructions to set up and run the kcppctl project on Windows 11 with full automation and optimization.

## 📋 System Requirements

### 🖥️ Hardware Requirements
- **Operating System**: Windows 11 x64
- **GPU**: NVIDIA RTX 3060 12GB with current NVIDIA drivers (or compatible CUDA GPU)
- **Memory**: 16GB RAM minimum, 32GB recommended for optimal performance
- **Storage**: ~10GB free space for models, build artifacts, and dependencies

### ⚙️ Software Requirements
- **Build Tools**: Visual Studio 2022 Build Tools (MSVC v143, C++ CMake tools for Windows)
- **Build System**: CMake 3.24 or higher
- **Version Control**: Git
- **Package Manager**: vcpkg (automatically configured via manifest)
- **PowerShell**: Windows PowerShell 7.x (recommended)

### 🤖 Model Requirements ⚠️ **CRITICAL: Model Download Required**
- **Model Format**: GGUF (GPT-Generated Unified Format)
- **Primary Model**: See [requirements-models.txt](../requirements-models.txt) for detailed specifications
- **Recommended Model**: Llama 3.2 1B Instruct Q4_K_M (~1.3GB)
- **⚠️ ESSENTIAL**: You MUST download GGUF model files before using kcppctl. The tool will not function without models!

## 🚀 Step 1: Install Visual Studio Build Tools

1. Download Visual Studio 2022 Build Tools:
   - Visit: https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - Download the Build Tools installer

2. Run the installer and select these workloads:
   - **Desktop development with C++**
   - **C++ CMake tools for Windows**
   - Ensure **MSVC v143** is selected

3. During installation, ensure these components are included:
   - MSVC v143 - VS 2022 C++ x64/x86 build tools
   - Windows SDK (10.0.22621.0 or latest)
   - C++ CMake tools for Windows

## 🔧 Step 2: Install CMake

1. Download CMake from: https://cmake.org/download/
2. Choose the Windows x64 Installer
3. Run the installer with default settings
4. Ensure CMake is added to PATH during installation

**Verification:**
```powershell
cmake --version
# Should output: cmake version 3.24.0 or higher
```

## 📦 Step 3: Install vcpkg

1. Open PowerShell as Administrator:
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```

2. Clone vcpkg repository:
   ```powershell
   cd C:\src
   git clone https://github.com/Microsoft/vcpkg.git
   cd vcpkg
   ```

3. Bootstrap vcpkg:
   ```powershell
   .\bootstrap-vcpkg.bat
   ```

4. Set environment variable (permanent):
   ```powershell
   [Environment]::SetEnvironmentVariable("VCPKG_ROOT", "C:\src\vcpkg", "User")
   $env:VCPKG_ROOT="C:\src\vcpkg"
   ```

## 📚 Step 4: Install Project Dependencies

1. Install required packages via vcpkg:
   ```powershell
   vcpkg install --triplet x64-windows cpr nlohmann-json fmt spdlog
   ```

2. Verification - packages should be installed:
   ```
   vcpkg list
   # Should show: cpr:x64-windows    nlohmann-json:x64-windows
   #               fmt:x64-windows    spdlog:x64-windows
   ```

## 🏗️ Step 5: Build the kcppctl Project

1. Navigate to project directory:
   ```powershell
   cd "<path-to-repo>"
   ```

2. Configure with CMake:
   ```powershell
   $toolchain="$env:VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake"
   cmake -S . -B build -DCMAKE_TOOLCHAIN_FILE="$toolchain" -DCMAKE_BUILD_TYPE=Release
   ```

3. Build the executable:
   ```powershell
   cmake --build build --target kcppctl --config Release
   ```

4. Verify executable was created:
   ```powershell
   dir build\kcppctl.exe
   ```

## 🤖 Step 6: Set Up LlamaCPP Runtime

### Verify LlamaCPP Installation
1. Check that LlamaCPP executables are available in the `llamacpp/` directory:
    ```
    Local-LLM-Server/
    ├── llamacpp/
    │   ├── bin/
    │   │   ├── llama-b6829-bin-win-cpu-x64/
    │   │   │   └── llama-cli.exe
    │   │   └── llama-b6829-bin-win-vulkan-x64/
    │   │       └── llama-cli.exe
    └── ...
    ```

2. Verify executable exists:
    ```powershell
    dir llamacpp\bin\*\llama-cli.exe
    ```

3. Test basic functionality (optional):
    ```powershell
    # Test CLI version (CPU version)
    .\llamacpp\bin\llama-b6829-bin-win-cpu-x64\llama-cli.exe --version
    ```

## 🧠 Step 7: Set Up GGUF Models ⚠️ **CRITICAL STEP - DO NOT SKIP**

### 🚨 **IMPORTANT NOTICE FOR NEW USERS**
This step is **REQUIRED** for kcppctl to function. You must download GGUF model files before proceeding. Without models, the tool will not work!

**Expected download size:** ~1-5GB per model
**Time required:** 2-15 minutes depending on internet speed

### 📋 Model Selection Guide

**For RTX 3060 12GB, we recommend:**
1. **Primary Choice**: Llama 3.2 1B Instruct Q4_K_M (~1.3GB)
    - Best balance of quality and performance
    - Optimal memory usage for RTX 3060
2. **Alternative**: Llama 3.2 3B Instruct Q4_K_M (~2.1GB)
    - Higher quality output
    - Requires more VRAM, may need reduced GPU layers

**See [requirements-models.txt](../requirements-models.txt) for complete model specifications, download links, and performance recommendations.**

### 🚀 Automated Model Installation (Recommended)

1. **Install HuggingFace CLI** (one-time setup):
   ```powershell
   pip install huggingface_hub
   ```

2. **Create models directory**:
   ```powershell
   mkdir -p models
   ```

3. **Download recommended model**:
    ```powershell
    # Download Llama 3.2 1B Instruct Q4_K_M (recommended)
    huggingface-cli download lmstudio-community/Meta-Llama-3.2-1B-Instruct-GGUF Meta-Llama-3.2-1B-Instruct-Q4_K_M.gguf --local-dir models --local-dir-use-symlinks False
    ```

### 🔧 Manual Model Installation

1. **Browse Model Repository**:
    - Visit: https://huggingface.co/lmstudio-community
    - Search for: "Meta-Llama-3.2-1B-Instruct-GGUF"

2. **Download Model File**:
    - Select: `Meta-Llama-3.2-1B-Instruct-Q4_K_M.gguf`
    - Wait for download to complete

3. **Organize Model Files**:
    ```
    Local-LLM-Server/
    └── models/
        ├── Meta-Llama-3.2-1B-Instruct-Q4_K_M.gguf    # Primary model
        ├── Meta-Llama-3.2-3B-Instruct-Q4_K_M.gguf    # Higher quality (optional)
        └── Meta-Llama-3.2-1B-Instruct-Q5_K_M.gguf    # High quality variant (optional)
    ```

### ✅ Verification ⚠️ **DO NOT SKIP THIS STEP**

Verify model installation:
```powershell
# List downloaded models
dir models

# Should show:
# Meta-Llama-3.2-1B-Instruct-Q4_K_M.gguf (or your chosen model)
```

**Expected file size**: ~1.3GB for 1B Q4_K_M, ~2.1GB for 3B Q4_K_M, ~1.8GB for 1B Q5_K_M

**⚠️ CRITICAL**: If no model files are shown, you must download a model before proceeding. kcppctl will not function without GGUF model files!

## ⚙️ Step 8: Configure Environment

1. Create config directory:
   ```powershell
   mkdir config
   ```

2. Copy and customize environment file:
   ```powershell
   Copy-Item scripts\example.env.local config\env.local
   ```

3. Edit `config\env.local` with your settings:
     ```env
     # Server binding
     LLM_HOST=127.0.0.1
     LLM_PORT=8080

     # Model configuration (update path based on downloaded model)
     LLM_MODEL_PATH=../models/Meta-Llama-3.2-1B-Instruct-Q4_K_M.gguf

     # Performance settings (optimized for RTX 3060 12GB)
     LLM_THREADS=8
     LLM_CTX=4096
     LLM_GPULAYERS=35
     ```

## 🧪 Step 9: Testing and Verification

### Basic Functionality Test
1. Start LlamaCPP server:
    ```powershell
    .\build\kcppctl.exe start --dry-run
    ```

2. Show help:
    ```powershell
    .\build\kcppctl.exe --help
    ```

### Full Workflow Test (requires LlamaCPP + Model)
1. Start the server:
    ```powershell
    .\build\kcppctl.exe start
    ```

2. Check status:
    ```powershell
    .\build\kcppctl.exe status
    ```

3. Run smoke test:
    ```powershell
    .\build\kcppctl.exe smoke --host 127.0.0.1 --port 8080
    ```

4. Run performance test:
   ```powershell
   .\build\kcppctl.exe perf --tokens 512
   ```

5. Stop the server:
   ```powershell
   .\build\kcppctl.exe stop
   ```

## 🔍 Troubleshooting

### Build Issues

**CMake not found:**
```powershell
# Reinstall CMake and ensure it's in PATH
$env:Path += ";C:\Program Files\CMake\bin"
```

**vcpkg packages not found:**
```powershell
# Ensure VCPKG_ROOT is set and vcpkg.exe is in PATH
$env:VCPKG_ROOT="C:\src\vcpkg"
vcpkg integrate install
```

**MSVC compiler not found:**
- Verify Visual Studio Build Tools installation
- Run: `"C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"`

### Runtime Issues

**LlamaCPP fails to start:**
- Verify model path in `config/env.local`
- Check LlamaCPP executable exists in `./llamacpp/bin/`
- Ensure sufficient GPU memory (RTX 3060 12GB should handle Llama 3.2 1B)

**HTTP connection refused:**
- Wait for LlamaCPP to fully initialize (may take 30-60 seconds)
- Check firewall allows localhost connections
- Verify port configuration matches

**Out of memory errors:**
- Reduce `LLM_GPULAYERS` in environment file
- Reduce `LLM_CTX` size
- Use smaller model quantization (Q4 instead of Q5)

### Performance Optimization

**For RTX 3060 12GB:**
```env
LLM_THREADS=8
LLM_CTX=4096
LLM_GPULAYERS=35
```

**Memory-constrained systems:**
```env
LLM_THREADS=4
LLM_CTX=2048
LLM_GPULAYERS=20
```

## 📝 Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `LLM_HOST` | Server bind address | 127.0.0.1 | Yes |
| `LLM_PORT` | Server port | 8080 | Yes |
| `LLM_MODEL_PATH` | Path to GGUF model | - | Yes |
| `LLM_THREADS` | CPU threads | 8 | Yes |
| `LLM_CTX` | Context size | 4096 | Yes |
| `LLM_GPULAYERS` | GPU layers to offload | 35 | Yes |

## 🔄 Update Instructions

### Update vcpkg packages:
```powershell
vcpkg update
vcpkg upgrade --no-dry-run
```

### Rebuild after code changes:
```powershell
cmake --build build --clean-first --config Release
```

### Update LlamaCPP Runtime:
- LlamaCPP executables are managed automatically in the `llamacpp/` directory
- No manual updates required for runtime executables
- Restart server to use any updated versions

## 📞 Support & Documentation

- **📖 Project Documentation:** `README.md` - Overview and usage guide
- **📋 Model Requirements:** `requirements-models.txt` - Detailed model specifications
- **🛠️ Development Plan:** `kcpp_cpp_project_plan.md` - Technical roadmap
- **🐛 Troubleshooting:** Check troubleshooting section above
- **🔍 Build Issues:** Common solutions documented in troubleshooting section

## 🚀 Quick Setup Summary

1. ✅ **Install Build Tools** (Visual Studio 2022 + CMake + vcpkg)
2. ✅ **Install Dependencies** (vcpkg packages auto-installed)
3. ✅ **Build Project** (CMake configuration + build)
4. ✅ **Verify LlamaCPP Runtime** (Check executables in llamacpp/ directory)
5. ⚠️ **DOWNLOAD MODELS** (Get GGUF models via HuggingFace CLI) **REQUIRED!**
6. ✅ **Configure Environment** (Copy and edit config files)
7. ✅ **Test Installation** (Smoke tests and performance benchmarks)

## ✨ Pro Tips

- **⚠️ DOWNLOAD MODELS FIRST** - Use HuggingFace CLI for automated model downloads (REQUIRED before using kcppctl)
- **Monitor GPU memory usage** when adjusting `LLM_GPULAYERS`
- **Enable logging** for troubleshooting: `kcppctl.exe logs --tail`
- **Check model compatibility** in `requirements-models.txt`
- **Verify model download** with `dir models` before running tests

---

**Setup Status:** Complete ✅
**Ready for Use:** After following all steps above
**Documentation Version:** v1.0