# Dependency Check for Ryzen AI 300 Optimization

Write-Host ""
Write-Host "=== Ryzen AI 300 Dependency Check ===" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check CMake
Write-Host "[1/12] CMake..." -NoNewline
if (Get-Command cmake -ErrorAction SilentlyContinue) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " MISSING" -ForegroundColor Red
    $allGood = $false
}

# Check vcpkg
Write-Host "[2/12] vcpkg..." -NoNewline
if ($env:VCPKG_ROOT -and (Test-Path "$env:VCPKG_ROOT\vcpkg.exe")) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " MISSING" -ForegroundColor Red
    $allGood = $false
}

# Check vcpkg packages
Write-Host "[3/12] vcpkg packages..." -NoNewline
if ($env:VCPKG_ROOT -and (Test-Path "$env:VCPKG_ROOT\vcpkg.exe")) {
    $packages = & "$env:VCPKG_ROOT\vcpkg.exe" list 2>&1 | Out-String
    $missing = @()
    if ($packages -notmatch "cpr:x64-windows") { $missing += "cpr" }
    if ($packages -notmatch "nlohmann-json:x64-windows") { $missing += "nlohmann-json" }
    if ($packages -notmatch "fmt:x64-windows") { $missing += "fmt" }
    if ($packages -notmatch "spdlog:x64-windows") { $missing += "spdlog" }
    
    if ($missing.Count -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " MISSING: $($missing -join ', ')" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host " SKIP" -ForegroundColor Yellow
}

# Check Visual Studio
Write-Host "[4/12] Visual Studio Build Tools..." -NoNewline
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
    $vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>&1
    if ($vsPath) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " MISSING" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host " MISSING" -ForegroundColor Red
    $allGood = $false
}

# Check PowerShell
Write-Host "[5/12] PowerShell..." -NoNewline
if ($PSVersionTable.PSVersion.Major -ge 5) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " OLD VERSION" -ForegroundColor Yellow
}

# Check KoboldCpp
Write-Host "[6/12] KoboldCpp executable..." -NoNewline
if (Test-Path "koboldccp\koboldcpp.exe") {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " MISSING" -ForegroundColor Red
    $allGood = $false
}

# Check models
Write-Host "[7/12] GGUF models..." -NoNewline
if (Test-Path "models") {
    $models = Get-ChildItem -Path "models" -Filter "*.gguf" -ErrorAction SilentlyContinue
    if ($models.Count -gt 0) {
        Write-Host " OK ($($models.Count) models)" -ForegroundColor Green
    } else {
        Write-Host " MISSING" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host " MISSING (no models directory)" -ForegroundColor Red
    $allGood = $false
}

# Check Python/pip
Write-Host "[8/12] Python/pip..." -NoNewline
if (Get-Command python -ErrorAction SilentlyContinue) {
    if (Get-Command pip -ErrorAction SilentlyContinue) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " PARTIAL (pip missing)" -ForegroundColor Yellow
    }
} else {
    Write-Host " SKIP (optional)" -ForegroundColor Yellow
}

# Check OpenCL
Write-Host "[9/12] OpenCL (AMD GPU)..." -NoNewline
if (Test-Path "C:\Windows\System32\OpenCL.dll") {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " MISSING" -ForegroundColor Red
    $allGood = $false
}

# Check Git
Write-Host "[10/12] Git..." -NoNewline
if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " SKIP (optional)" -ForegroundColor Yellow
}

# Check build
Write-Host "[11/12] kcppctl build..." -NoNewline
if (Test-Path "build\Release\kcppctl.exe") {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " NOT BUILT" -ForegroundColor Yellow
}

# Check Ryzen AI config
Write-Host "[12/12] Ryzen AI config..." -NoNewline
if (Test-Path "config\env.ryzen-ai-optimized") {
    $content = Get-Content "config\env.ryzen-ai-optimized" -Raw
    if ($content -match "--useclblast") {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " INCOMPLETE" -ForegroundColor Yellow
    }
} else {
    Write-Host " MISSING" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "All critical dependencies satisfied!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. .\start-kobold.ps1 -RyzenAIOptimized"
    Write-Host "  2. .\scripts\monitor-hardware-utilization.ps1"
    Write-Host "  3. .\scripts\benchmark-ryzen-ai.ps1"
} else {
    Write-Host "Some critical dependencies are missing" -ForegroundColor Red
    Write-Host "Please install missing dependencies above"
}

Write-Host ""