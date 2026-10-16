# Dependency Check Script for Ryzen AI 300 Optimization
# Checks all required software, packages, and runtime dependencies

param(
    [switch]$Detailed
)

$ErrorActionPreference = "SilentlyContinue"
$WarningPreference = "SilentlyContinue"

Write-Host "`n=== Ryzen AI 300 Optimization - Dependency Check ===" -ForegroundColor Cyan
Write-Host "Checking all required dependencies...`n" -ForegroundColor Cyan

$dependencies = @{
    "Critical" = @()
    "Warnings" = @()
    "Optional" = @()
}

# Helper function to add dependency status
function Add-DependencyStatus {
    param(
        [string]$Category,
        [string]$Name,
        [string]$Status,
        [string]$Details = ""
    )
    
    $dependencies[$Category] += @{
        Name = $Name
        Status = $Status
        Details = $Details
    }
}

# 1. Check CMake
Write-Host "[1/12] Checking CMake..." -ForegroundColor Yellow
$cmake = Get-Command cmake -ErrorAction SilentlyContinue
if ($cmake) {
    $cmakeVersion = & cmake --version 2>&1 | Select-String -Pattern "cmake version (\d+\.\d+\.\d+)" | ForEach-Object { $_.Matches.Groups[1].Value }
    if ([version]$cmakeVersion -ge [version]"3.24.0") {
        Write-Host "  ✓ CMake $cmakeVersion installed" -ForegroundColor Green
        Add-DependencyStatus "Critical" "CMake" "OK" "Version: $cmakeVersion"
    } else {
        Write-Host "  ✗ CMake version too old: $cmakeVersion (need >= 3.24.0)" -ForegroundColor Red
        Add-DependencyStatus "Critical" "CMake" "FAIL" "Version $cmakeVersion too old, need >= 3.24.0"
    }
} else {
    Write-Host "  ✗ CMake not found" -ForegroundColor Red
    Add-DependencyStatus "Critical" "CMake" "MISSING" "Install from https://cmake.org/download/"
}

# 2. Check vcpkg
Write-Host "[2/12] Checking vcpkg..." -ForegroundColor Yellow
$vcpkgRoot = $env:VCPKG_ROOT
if ($vcpkgRoot -and (Test-Path "$vcpkgRoot\vcpkg.exe")) {
    Write-Host "  ✓ vcpkg found at: $vcpkgRoot" -ForegroundColor Green
    Add-DependencyStatus "Critical" "vcpkg" "OK" "Path: $vcpkgRoot"
} else {
    Write-Host "  ✗ vcpkg not found or VCPKG_ROOT not set" -ForegroundColor Red
    Add-DependencyStatus "Critical" "vcpkg" "MISSING" "Set VCPKG_ROOT environment variable"
}

# 3. Check vcpkg packages
Write-Host "[3/12] Checking vcpkg packages..." -ForegroundColor Yellow
if ($vcpkgRoot -and (Test-Path "$vcpkgRoot\vcpkg.exe")) {
    $requiredPackages = @("cpr:x64-windows", "nlohmann-json:x64-windows", "fmt:x64-windows", "spdlog:x64-windows")
    $installedPackages = & "$vcpkgRoot\vcpkg.exe" list 2>&1 | Out-String
    
    $allInstalled = $true
    foreach ($pkg in $requiredPackages) {
        $pkgName = $pkg -replace ":.*", ""
        if ($installedPackages -match $pkg) {
            Write-Host "  ✓ $pkgName installed" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $pkgName missing" -ForegroundColor Red
            Add-DependencyStatus "Critical" "vcpkg package: $pkgName" "MISSING" "Run: vcpkg install $pkg"
            $allInstalled = $false
        }
    }
    
    if ($allInstalled) {
        Add-DependencyStatus "Critical" "vcpkg packages" "OK" "All required packages installed"
    }
} else {
    Add-DependencyStatus "Critical" "vcpkg packages" "SKIP" "vcpkg not available"
}

# 4. Check Visual Studio Build Tools
Write-Host "[4/12] Checking Visual Studio Build Tools..." -ForegroundColor Yellow
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
    $vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>&1
    if ($vsPath) {
        Write-Host "  ✓ Visual Studio Build Tools found" -ForegroundColor Green
        Add-DependencyStatus "Critical" "VS Build Tools" "OK" "Path: $vsPath"
    } else {
        Write-Host "  ✗ Visual Studio Build Tools not found" -ForegroundColor Red
        Add-DependencyStatus "Critical" "VS Build Tools" "MISSING" "Install Visual Studio 2022 Build Tools"
    }
} else {
    Write-Host "  ✗ vswhere.exe not found" -ForegroundColor Red
    Add-DependencyStatus "Critical" "VS Build Tools" "MISSING" "Install Visual Studio 2022 Build Tools"
}

# 5. Check PowerShell version
Write-Host "[5/12] Checking PowerShell version..." -ForegroundColor Yellow
$psVersion = $PSVersionTable.PSVersion
if ($psVersion.Major -ge 5) {
    Write-Host "  ✓ PowerShell $psVersion" -ForegroundColor Green
    Add-DependencyStatus "Critical" "PowerShell" "OK" "Version: $psVersion"
} else {
    Write-Host "  ⚠ PowerShell version too old: $psVersion" -ForegroundColor Yellow
    Add-DependencyStatus "Warnings" "PowerShell" "OLD" "Consider upgrading to PowerShell 7+"
}

# 6. Check KoboldCpp executable
Write-Host "[6/12] Checking KoboldCpp executable..." -ForegroundColor Yellow
$koboldPath = "koboldccp\koboldcpp.exe"
if (Test-Path $koboldPath) {
    $fileSize = [math]::Round((Get-Item $koboldPath).Length / 1MB, 1)
    Write-Host "  ✓ KoboldCpp executable found ($fileSize MB)" -ForegroundColor Green
    Add-DependencyStatus "Critical" "KoboldCpp" "OK" "Size: $fileSize MB"
} else {
    Write-Host "  ✗ KoboldCpp executable not found at: $koboldPath" -ForegroundColor Red
    Add-DependencyStatus "Critical" "KoboldCpp" "MISSING" "Download from https://github.com/LostRuins/koboldcpp/releases"
}

# 7. Check GGUF model files
Write-Host "[7/12] Checking GGUF model files..." -ForegroundColor Yellow
$modelPath = "models"
if (Test-Path $modelPath) {
    $modelFiles = Get-ChildItem -Path $modelPath -Filter "*.gguf" -ErrorAction SilentlyContinue
    if ($modelFiles.Count -gt 0) {
        Write-Host "  ✓ Found $($modelFiles.Count) GGUF model(s):" -ForegroundColor Green
        foreach ($model in $modelFiles) {
            $sizeGB = [math]::Round($model.Length / 1GB, 2)
            $sizeText = "$sizeGB GB"
            Write-Host "    - $($model.Name) ($sizeText)" -ForegroundColor Gray
        }
        Add-DependencyStatus "Critical" "GGUF Models" "OK" "Count: $($modelFiles.Count)"
    } else {
        Write-Host "  ✗ No GGUF model files found in $modelPath" -ForegroundColor Red
        Add-DependencyStatus "Critical" "GGUF Models" "MISSING" "Download models - see requirements-models.txt"
    }
} else {
    Write-Host "  ✗ Models directory not found: $modelPath" -ForegroundColor Red
    Add-DependencyStatus "Critical" "GGUF Models" "MISSING" "Create models/ directory and download models"
}

# 8. Check Python/pip (for HuggingFace CLI)
Write-Host "[8/12] Checking Python/pip..." -ForegroundColor Yellow
$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
    $pythonVersion = & python --version 2>&1 | Out-String
    Write-Host "  ✓ Python installed: $($pythonVersion.Trim())" -ForegroundColor Green
    
    $pip = Get-Command pip -ErrorAction SilentlyContinue
    if ($pip) {
        Write-Host "  ✓ pip installed" -ForegroundColor Green
        Add-DependencyStatus "Optional" "Python/pip" "OK" "Available for model downloads"
    } else {
        Write-Host "  ⚠ pip not found" -ForegroundColor Yellow
        Add-DependencyStatus "Optional" "pip" "MISSING" "Needed for HuggingFace CLI"
    }
} else {
    Write-Host "  ⚠ Python not found (optional for model downloads)" -ForegroundColor Yellow
    Add-DependencyStatus "Optional" "Python" "MISSING" "Optional: needed for HuggingFace CLI"
}

# 9. Check OpenCL support (for AMD GPU acceleration)
Write-Host "[9/12] Checking OpenCL support (AMD GPU)..." -ForegroundColor Yellow
$openclDll = "C:\Windows\System32\OpenCL.dll"
if (Test-Path $openclDll) {
    Write-Host "  ✓ OpenCL.dll found (AMD GPU support available)" -ForegroundColor Green
    Add-DependencyStatus "Critical" "OpenCL" "OK" "AMD GPU acceleration supported"
} else {
    Write-Host "  ✗ OpenCL.dll not found" -ForegroundColor Red
    Add-DependencyStatus "Critical" "OpenCL" "MISSING" "Install AMD drivers for Ryzen AI 300 GPU support"
}

# 10. Check Git
Write-Host "[10/12] Checking Git..." -ForegroundColor Yellow
$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) {
    $gitVersion = & git --version 2>&1 | Out-String
    Write-Host "  ✓ Git installed: $($gitVersion.Trim())" -ForegroundColor Green
    Add-DependencyStatus "Optional" "Git" "OK" "Version control available"
} else {
    Write-Host "  ⚠ Git not found (optional)" -ForegroundColor Yellow
    Add-DependencyStatus "Optional" "Git" "MISSING" "Optional: for version control"
}

# 11. Check project build
Write-Host "[11/12] Checking project build..." -ForegroundColor Yellow
$buildExe = "build\Release\kcppctl.exe"
if (Test-Path $buildExe) {
    Write-Host "  ✓ kcppctl.exe built successfully" -ForegroundColor Green
    Add-DependencyStatus "Critical" "kcppctl build" "OK" "Executable exists"
} else {
    Write-Host "  ⚠ kcppctl.exe not built yet" -ForegroundColor Yellow
    Add-DependencyStatus "Warnings" "kcppctl build" "PENDING" "Run: cmake --build build --config Release"
}

# 12. Check AMD Ryzen AI specific requirements
Write-Host "[12/12] Checking AMD Ryzen AI specific setup..." -ForegroundColor Yellow
$ryzenConfig = "config\env.ryzen-ai-optimized"
if (Test-Path $ryzenConfig) {
    Write-Host "  ✓ Ryzen AI optimized config exists" -ForegroundColor Green
    
    # Check if config has AMD GPU flags
    $configContent = Get-Content $ryzenConfig -Raw
    if ($configContent -match "--useclblast") {
        Write-Host "  ✓ AMD GPU acceleration flags configured" -ForegroundColor Green
        Add-DependencyStatus "Critical" "Ryzen AI Config" "OK" "Optimization config ready"
    } else {
        Write-Host "  ⚠ AMD GPU flags not found in config" -ForegroundColor Yellow
        Add-DependencyStatus "Warnings" "Ryzen AI Config" "INCOMPLETE" "Missing --useclblast flags"
    }
} else {
    Write-Host "  ⚠ Ryzen AI optimized config not found" -ForegroundColor Yellow
    Add-DependencyStatus "Warnings" "Ryzen AI Config" "MISSING" "Create config/env.ryzen-ai-optimized"
}

# Summary Report
Write-Host "`n=== Dependency Check Summary ===" -ForegroundColor Cyan

$criticalFailed = $dependencies["Critical"] | Where-Object { $_.Status -ne "OK" }
$warningsCount = $dependencies["Warnings"].Count
$optionalMissing = $dependencies["Optional"] | Where-Object { $_.Status -eq "MISSING" }

Write-Host "`nCritical Dependencies:" -ForegroundColor Yellow
if ($criticalFailed.Count -eq 0) {
    Write-Host "  ✓ All critical dependencies satisfied!" -ForegroundColor Green
} else {
    Write-Host "  ✗ $($criticalFailed.Count) critical issue(s) found:" -ForegroundColor Red
    foreach ($dep in $criticalFailed) {
        Write-Host "    - $($dep.Name): $($dep.Status) - $($dep.Details)" -ForegroundColor Red
    }
}

if ($warningsCount -gt 0) {
    Write-Host "`nWarnings:" -ForegroundColor Yellow
    foreach ($dep in $dependencies["Warnings"]) {
        Write-Host "  ⚠ $($dep.Name): $($dep.Status) - $($dep.Details)" -ForegroundColor Yellow
    }
}

if ($optionalMissing.Count -gt 0) {
    Write-Host "`nOptional Dependencies:" -ForegroundColor Gray
    foreach ($dep in $optionalMissing) {
        Write-Host "  - $($dep.Name): $($dep.Details)" -ForegroundColor Gray
    }
}

# Recommendations
Write-Host "`n=== Recommendations ===" -ForegroundColor Cyan

if ($criticalFailed.Count -eq 0) {
    Write-Host "✓ System ready for Ryzen AI 300 optimization!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "  1. Run: .\start-kobold.ps1 -RyzenAIOptimized" -ForegroundColor White
    Write-Host "  2. Monitor performance with: .\scripts\monitor-hardware-utilization.ps1" -ForegroundColor White
    Write-Host "  3. Run benchmark: .\scripts\benchmark-ryzen-ai.ps1" -ForegroundColor White
} else {
    Write-Host "⚠ Please resolve critical dependencies before proceeding:" -ForegroundColor Yellow
    
    if ($dependencies["Critical"] | Where-Object { $_.Name -eq "vcpkg packages" -and $_.Status -eq "MISSING" }) {
        Write-Host "`n  Install vcpkg packages:" -ForegroundColor White
        Write-Host "    vcpkg install cpr:x64-windows nlohmann-json:x64-windows fmt:x64-windows spdlog:x64-windows" -ForegroundColor Gray
    }
    
    if ($dependencies["Critical"] | Where-Object { $_.Name -eq "GGUF Models" -and $_.Status -eq "MISSING" }) {
        Write-Host "`n  Download models:" -ForegroundColor White
        Write-Host "    pip install huggingface_hub" -ForegroundColor Gray
        Write-Host "    huggingface-cli download TheBloke/Mistral-7B-Instruct-v0.1-GGUF mistral-7b-instruct-v0.1.Q4_K_M.gguf --local-dir models --local-dir-use-symlinks False" -ForegroundColor Gray
    }
    
    if ($dependencies["Critical"] | Where-Object { $_.Name -eq "OpenCL" -and $_.Status -eq "MISSING" }) {
        Write-Host "`n  Install AMD drivers:" -ForegroundColor White
        Write-Host "    Download and install latest AMD Ryzen AI drivers from AMD.com" -ForegroundColor Gray
    }
}

Write-Host "`n" -ForegroundColor White

# Exit with appropriate code
if ($criticalFailed.Count -eq 0) {
    exit 0
} else {
    exit 1
}