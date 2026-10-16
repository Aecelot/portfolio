param(
    [switch]$SkipAntivirus,
    [switch]$SkipPowerPlan,
    [switch]$SkipCpuAffinity,
    [switch]$Revert
)

# KoboldCpp System Optimization Script
# Optimizes Windows settings for RTX 3060 + Ryzen 9 7900 performance

Write-Host "KoboldCpp System Optimization" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

if ($Revert) {
    Write-Host "REVERT MODE: Restoring original system settings" -ForegroundColor Yellow
} else {
    Write-Host "APPLY MODE: Applying performance optimizations" -ForegroundColor Green
}
Write-Host ""

# Function to check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check for administrator privileges
if (-not (Test-Administrator)) {
    Write-Warning "This script requires administrator privileges for some optimizations."
    Write-Warning "Please run as Administrator for full functionality."
    Write-Host ""
}

# 1. ANTIVIRUS EXCLUSIONS
if (-not $SkipAntivirus -and -not $Revert) {
    Write-Host "1. Configuring Antivirus Exclusions..." -ForegroundColor Yellow

    try {
        # Add exclusions for models and logs directories
        $exclusions = @(
            "models\",
            "koboldcpp\logs\"
        )

        foreach ($exclusion in $exclusions) {
            Add-MpPreference -ExclusionPath $exclusion -ErrorAction SilentlyContinue
            Write-Host "  Added exclusion: $exclusion" -ForegroundColor Green
        }

        Write-Host "  Antivirus exclusions configured successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "  Warning: Could not configure antivirus exclusions: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "  You may need to add these paths manually in Windows Security" -ForegroundColor Yellow
    }
}
elseif ($Revert) {
    Write-Host "1. Removing Antivirus Exclusions..." -ForegroundColor Yellow
    Write-Host "  Note: Manual removal may be required via Windows Security" -ForegroundColor Gray
}

Write-Host ""

# 2. POWER PLAN OPTIMIZATION
if (-not $SkipPowerPlan) {
    Write-Host "2. Configuring Power Plan..." -ForegroundColor Yellow

    try {
        if ($Revert) {
            # Set to Balanced (revert)
            powercfg.exe -setactive 381b4222-f694-41f0-9685-ff5bb260df2e
            Write-Host "  Reverted to Balanced power plan" -ForegroundColor Green
        } else {
            # Set to High Performance
            powercfg.exe -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
            Write-Host "  Set to High Performance power plan" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "  Warning: Could not set power plan: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "  You may need to set it manually in Power Options" -ForegroundColor Yellow
    }
}

Write-Host ""

# 3. CPU AFFINITY OPTIMIZATION (Optional)
if (-not $SkipCpuAffinity -and -not $Revert) {
    Write-Host "3. CPU Affinity Configuration..." -ForegroundColor Yellow
    Write-Host "  Note: CPU affinity will be set when KoboldCpp launches" -ForegroundColor Gray
    Write-Host "  This pins KoboldCpp to the first 12 cores of your Ryzen 9 7900" -ForegroundColor Gray
    Write-Host "  CPU Affinity mask for 12 cores: 0xFFF (4095 in decimal)" -ForegroundColor Gray
    Write-Host "  This setting is applied in start-kobold.ps1" -ForegroundColor Gray
}

Write-Host ""

# 4. SYSTEM INFORMATION SUMMARY
Write-Host "4. System Information:" -ForegroundColor Yellow

# CPU Information
try {
    $cpu = Get-WmiObject Win32_Processor
    Write-Host "  CPU: $($cpu.Name)" -ForegroundColor White
    Write-Host "  Cores: $($cpu.NumberOfCores) physical, $($cpu.NumberOfLogicalProcessors) logical" -ForegroundColor White
} catch {
    Write-Host "  CPU: Information unavailable" -ForegroundColor Gray
}

# GPU Information
try {
    $gpu = Get-WmiObject Win32_VideoController
    Write-Host "  GPU: $($gpu.Name)" -ForegroundColor White
    Write-Host "  VRAM: $([math]::Round($gpu.AdapterRAM / 1GB, 1))GB" -ForegroundColor White
} catch {
    Write-Host "  GPU: Information unavailable" -ForegroundColor Gray
}

# Memory Information
try {
    $memory = Get-WmiObject Win32_OperatingSystem
    $totalMemory = [math]::Round($memory.TotalVisibleMemorySize / 1MB, 0)
    Write-Host "  RAM: $($totalMemory)MB total" -ForegroundColor White
} catch {
    Write-Host "  RAM: Information unavailable" -ForegroundColor Gray
}

Write-Host ""

# 5. VERIFICATION
Write-Host "5. Verification:" -ForegroundColor Yellow

if (-not $Revert) {
    # Check current power plan
    try {
        $currentPlan = powercfg.exe /getactivescheme
        if ($currentPlan -like "*High Performance*") {
            Write-Host "  [✓] Power plan: High Performance" -ForegroundColor Green
        } elseif ($currentPlan -like "*Balanced*") {
            Write-Host "  [○] Power plan: Balanced (consider High Performance for optimal results)" -ForegroundColor Yellow
        } else {
            Write-Host "  [?] Power plan: $($currentPlan -replace '.*\(|\).*', '')" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  [?] Power plan: Unable to verify" -ForegroundColor Gray
    }

    # Check antivirus exclusions
    try {
        $preferences = Get-MpPreference
        $excludedPaths = $preferences.ExclusionPath
        $koboldPaths = $excludedPaths | Where-Object { $_ -like "*models*" -or $_ -like "*koboldcpp*" }
        if ($koboldPaths.Count -ge 1) {
            Write-Host "  [✓] Antivirus exclusions: Configured" -ForegroundColor Green
            foreach ($path in $koboldPaths) {
                Write-Host "    - $path" -ForegroundColor Gray
            }
        } else {
            Write-Host "  [○] Antivirus exclusions: Not detected (may need manual configuration)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  [?] Antivirus exclusions: Unable to verify" -ForegroundColor Gray
    }
}

Write-Host ""

# 6. RECOMMENDATIONS
if (-not $Revert) {
    Write-Host "6. Additional Recommendations:" -ForegroundColor Yellow
    Write-Host "  [→] Close unnecessary background applications" -ForegroundColor White
    Write-Host "  [→] Ensure NVIDIA drivers are up to date" -ForegroundColor White
    Write-Host "  [→] Monitor temperatures during extended use" -ForegroundColor White
    Write-Host "  [→] Consider undervolting GPU for better thermals if needed" -ForegroundColor White
    Write-Host ""

    Write-Host "  Performance Targets:" -ForegroundColor Cyan
    Write-Host "    • TTFT: <400ms (Time to First Token)" -ForegroundColor White
    Write-Host "    • Tokens/sec: >35 tokens/sec" -ForegroundColor White
    Write-Host "    • Expected: 2-3x improvement over unoptimized setup" -ForegroundColor White
}

Write-Host ""
Write-Host "Optimization complete!" -ForegroundColor Green
Write-Host "You can now start KoboldCpp with: .\start-kobold.ps1" -ForegroundColor Cyan

if (-not $Revert) {
    Write-Host ""
    Write-Host "To revert these changes later, run: .\optimize-system.ps1 -Revert" -ForegroundColor Yellow
}