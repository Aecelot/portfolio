# Simple Dependency Check for Ryzen AI 300 Optimization

Write-Host "`n=== Ryzen AI 300 Dependency Check ===" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check CMake
Write-Host "[1/12] CMake..." -NoNewline
$cmake = Get-Command cmake -ErrorAction SilentlyContinue
if ($cmake) {
    Write-Host " ✓ Found" -ForegroundColor Green
} else {
    Write-Host " ✗ Missing" -ForegroundColor Red
    $allGood = $false
}

# Check vcpkg
Write-Host "[2/12] vcpkg..." -NoNewline
if ($env:VCPKG_ROOT -and (Test-Path "$env:VCPKG_ROOT\vcpkg.exe")) {
    Write-Host " ✓ Found at $env:VCPKG_ROOT" -ForegroundColor Green
} else {
    Write-Host " ✗ Missing or VCPKG_ROOT not set" -ForegroundColor Red
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
        Write-Host " ✓ All installed" -ForegroundColor Green
    } else {
        Write-Host " ✗ Missing: $($missing -join ', ')" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host " ⚠ Skipped (vcpkg not available)" -ForegroundColor Yellow
}

# Check Visual Studio
Write-Host "[4/12] Visual Studio Build Tools..." -NoNewline
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
    $vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>&1
    if ($vsPath) {
        Write-Host " ✓ Found" -ForegroundColor Green
    } else {
        Write-Host " ✗ Not found" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host " ✗ vswhere.exe not found" -ForegroundColor Red
    $allGood = $false
}

# Check PowerShell
Write-Host "[5/12] PowerShell..." -NoNewline
if ($PSVersionTable.PSVersion.Major -ge 5) {
    Write-Host " ✓ Version $($PSVersionTable.PSVersion)" -ForegroundColor Green
} else {
    Write-Host " ⚠ Old version" -ForegroundColor Yellow
}

# Check KoboldCpp
Write-Host "[6/12] KoboldCpp executable..." -NoNewline
if (Test-Path "koboldccp\koboldcpp.exe") {
    $sizeMB = [math]::Round((Get-Item "koboldccp\koboldcpp.exe").Length / 1MB, 1)
    Write-Host " ✓ Found ($sizeMB MB)" -ForegroundColor Green
} else {
    Write-Host " ✗ Not found at koboldccp\koboldcpp.exe" -ForegroundColor Red
    $allGood = $false
}

# Check models
Write-Host "[7/12] GGUF models..." -NoNewline
if (Test-Path "models") {
    $models = Get-ChildItem -Path "models" -Filter "*.gguf" -ErrorAction SilentlyContinue
    if ($models.Count -gt 0) {
        Write-Host " ✓ Found $($models.Count) model(s)" -ForegroundColor Green
        foreach ($m in $models) {
            $sizeGB = [math]::Round($m.Length / 1GB, 2)
            $sizeText = "$sizeGB GB"
            Write-Host "    - $($m.Name) ($sizeText)" -ForegroundColor Gray
        }
    } else {
        Write-Host " ✗ No .gguf files in models/" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host " ✗ models/ directory not found" -ForegroundColor Red
    $allGood = $false
}

# Check Python/pip
Write-Host "[8/12] Python/pip..." -NoNewline
$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
    $pip = Get-Command pip -ErrorAction SilentlyContinue
    if ($pip) {
        Write-Host " ✓ Both installed" -ForegroundColor Green
    } else {
        Write-Host " ⚠ Python found, pip missing" -ForegroundColor Yellow
    }
} else {
    Write-Host " ⚠ Not found (optional)" -ForegroundColor Yellow
}

# Check OpenCL
Write-Host "[9/12] OpenCL (AMD GPU support)..." -NoNewline
if (Test-Path "C:\Windows\System32\OpenCL.dll") {
    Write-Host " ✓ Found" -ForegroundColor Green
} else {
    Write-Host " ✗ OpenCL.dll not found" -ForegroundColor Red
    Write-Host "    Install AMD Ryzen AI drivers" -ForegroundColor Yellow
    $allGood = $false
}

# Check Git
Write-Host "[10/12] Git..." -NoNewline
if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Host " ✓ Found" -ForegroundColor Green
} else {
    Write-Host " ⚠ Not found (optional)" -ForegroundColor Yellow
}

# Check build
Write-Host "[11/12] kcppctl build..." -NoNewline
if (Test-Path "build\Release\kcppctl.exe") {
    Write-Host " ✓ Built" -ForegroundColor Green
} else {
    Write-Host " ⚠ Not built yet" -ForegroundColor Yellow
}

# Check Ryzen AI config
Write-Host "[12/12] Ryzen AI config..." -NoNewline
if (Test-Path "config\env.ryzen-ai-optimized") {
    $content = Get-Content "config\env.ryzen-ai-optimized" -Raw
    if ($content -match "--useclblast") {
        Write-Host " ✓ Configured with AMD GPU flags" -ForegroundColor Green
    } else {
        Write-Host " ⚠ Missing --useclblast flags" -ForegroundColor Yellow
    }
} else {
    Write-Host " ⚠ Not found" -ForegroundColor Yellow
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "✓ All critical dependencies satisfied!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "  1. .\start-kobold.ps1 -RyzenAIOptimized" -ForegroundColor White
    Write-Host "  2. .\scripts\monitor-hardware-utilization.ps1" -ForegroundColor White
    Write-Host "  3. .\scripts\benchmark-ryzen-ai.ps1" -ForegroundColor White
} else {
    Write-Host "✗ Some critical dependencies are missing" -ForegroundColor Red
    Write-Host "`nPlease install missing dependencies above" -ForegroundColor Yellow
}

Write-Host ""