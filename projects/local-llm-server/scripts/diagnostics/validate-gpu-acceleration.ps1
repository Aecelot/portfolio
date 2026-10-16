# GPU Acceleration Validation Script for AMD Ryzen AI 300 Series
# Verifies that KoboldCpp is properly utilizing the Radeon 890M iGPU

param(
    [int]$DurationSeconds = 30,
    [switch]$Detailed
)

Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "  AMD Ryzen AI 300 GPU Acceleration Validation Tool" -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan

# Check if KoboldCpp is running
$koboldProcess = Get-Process "koboldcpp" -ErrorAction SilentlyContinue
if (-not $koboldProcess) {
    Write-Host "`n[ERROR] KoboldCpp is not running!" -ForegroundColor Red
    Write-Host "   Start KoboldCpp first with: .\start-kobold.ps1 -RyzenAIOptimized" -ForegroundColor Yellow
    exit 1
}

# Handle multiple processes - use the first one
if ($koboldProcess -is [array]) {
    Write-Host "`n[WARNING] Multiple KoboldCpp processes detected. Using PID: $($koboldProcess[0].Id)" -ForegroundColor Yellow
    $koboldProcess = $koboldProcess[0]
} else {
    Write-Host "`n[OK] KoboldCpp is running (PID: $($koboldProcess.Id))" -ForegroundColor Green
}

# Function to get GPU information
function Get-AMDGPUInfo {
    try {
        $gpu = Get-CimInstance -ClassName Win32_VideoController | 
            Where-Object { $_.Name -like "*Radeon*" -or $_.Name -like "*AMD*" }
        
        if ($gpu) {
            return @{
                Name = $gpu.Name
                DriverVersion = $gpu.DriverVersion
                AdapterRAM = [Math]::Round($gpu.AdapterRAM / 1MB, 0)
                Status = $gpu.Status
            }
        }
        return $null
    }
    catch {
        return $null
    }
}

# Function to check OpenCL availability
function Test-OpenCLAvailability {
    try {
        # Check for OpenCL DLLs
        $openclPaths = @(
            "$env:SystemRoot\System32\OpenCL.dll",
            "$env:SystemRoot\SysWOW64\OpenCL.dll"
        )
        
        $openclFound = $false
        foreach ($path in $openclPaths) {
            if (Test-Path $path) {
                $openclFound = $true
                break
            }
        }
        
        return $openclFound
    }
    catch {
        return $false
    }
}

# Function to monitor GPU utilization
function Get-GPUUtilization {
    try {
        # Method 1: Try using Get-Counter for GPU metrics
        try {
            $gpuCounters = Get-Counter -Counter "\GPU Engine(*engtype_3D)\Utilization Percentage" -ErrorAction SilentlyContinue
            if ($gpuCounters) {
                $maxUtil = ($gpuCounters.CounterSamples | Measure-Object -Property CookedValue -Maximum).Maximum
                return [Math]::Round($maxUtil, 1)
            }
        }
        catch {
            # Counter method failed, continue to alternative methods
        }

        # Method 2: Try WMI for AMD GPU
        $amdGPU = Get-CimInstance -Namespace "root\cimv2" -ClassName Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like "*AMD*" }
        
        if ($amdGPU) {
            return [Math]::Round($amdGPU.UtilizationPercentage, 1)
        }

        # Method 3: Fallback - estimate based on process CPU usage
        $process = Get-Process "koboldcpp" -ErrorAction SilentlyContinue
        if ($process) {
            $cpuUsage = $process.CPU
            # If CPU usage is low but process is active, likely GPU is working
            if ($cpuUsage -lt 30) {
                return "GPU Likely Active"
            }
        }

        return "Unable to measure"
    }
    catch {
        return "Error: $($_.Exception.Message)"
    }
}

# Display GPU Information
Write-Host "`n[Hardware Detection]" -ForegroundColor Cyan
$gpuInfo = Get-AMDGPUInfo
if ($gpuInfo) {
    Write-Host "   GPU: $($gpuInfo.Name)" -ForegroundColor Green
    Write-Host "   VRAM: $($gpuInfo.AdapterRAM) MB" -ForegroundColor Green
    Write-Host "   Driver: $($gpuInfo.DriverVersion)" -ForegroundColor Green
    Write-Host "   Status: $($gpuInfo.Status)" -ForegroundColor Green
} else {
    Write-Host "   [WARNING] AMD GPU not detected via WMI" -ForegroundColor Yellow
}

# Check OpenCL availability
Write-Host "`n[OpenCL Status]" -ForegroundColor Cyan
$openclAvailable = Test-OpenCLAvailability
if ($openclAvailable) {
    Write-Host "   [OK] OpenCL runtime detected" -ForegroundColor Green
} else {
    Write-Host "   [ERROR] OpenCL runtime NOT found" -ForegroundColor Red
    Write-Host "   Install AMD GPU drivers with OpenCL support" -ForegroundColor Yellow
}

# Check KoboldCpp command line for GPU flags
Write-Host "`n[KoboldCpp Configuration]" -ForegroundColor Cyan
try {
    $processId = $koboldProcess.Id
    $cmdLine = (Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -eq $processId }).CommandLine
    
    if ($cmdLine -like "*--useclblast*") {
        Write-Host "   [OK] --useclblast flag detected" -ForegroundColor Green
        
        # Extract platform and device IDs
        if ($cmdLine -match "--useclblast\s+(\d+)\s+(\d+)") {
            Write-Host "   [OK] Platform: $($matches[1]), Device: $($matches[2])" -ForegroundColor Green
        }
    } else {
        Write-Host "   [ERROR] --useclblast flag NOT found" -ForegroundColor Red
        Write-Host "   GPU acceleration is NOT enabled!" -ForegroundColor Yellow
    }
    
    if ($cmdLine -like "*--gpulayers*") {
        if ($cmdLine -match "--gpulayers\s+(\d+)") {
            $layers = $matches[1]
            Write-Host "   GPU Layers: $layers" -ForegroundColor $(if ($layers -gt 0) { "Green" } else { "Yellow" })
        }
    }
    
    if ($Detailed) {
        Write-Host "`n   Full Command Line:" -ForegroundColor Gray
        Write-Host "   $cmdLine" -ForegroundColor DarkGray
    }
}
catch {
    Write-Host "   [WARNING] Could not retrieve command line" -ForegroundColor Yellow
}

# Test with a simple inference request
Write-Host "`n[Testing GPU Acceleration - Inference Test]" -ForegroundColor Cyan
Write-Host "   Sending test prompt to KoboldCpp..." -ForegroundColor Gray

try {
    $testPrompt = @{
        prompt = "Write a short story about"
        max_length = 50
        temperature = 0.7
    } | ConvertTo-Json

    $startTime = Get-Date
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:5001/api/v1/generate" -Method Post -Body $testPrompt -ContentType "application/json" -TimeoutSec 30
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds

    Write-Host "   [OK] Inference completed in $([Math]::Round($duration, 2))s" -ForegroundColor Green
    
    if ($response.results -and $response.results[0].text) {
        Write-Host "   [OK] Generated text: $($response.results[0].text.Substring(0, [Math]::Min(50, $response.results[0].text.Length)))..." -ForegroundColor Green
    }
}
catch {
    Write-Host "   [WARNING] Inference test failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Monitor GPU utilization during sustained load
Write-Host "`n[Monitoring GPU Utilization - $DurationSeconds seconds]" -ForegroundColor Cyan
Write-Host "   Generating continuous inference to measure GPU usage..." -ForegroundColor Gray

$samples = @()
$interval = 2  # Sample every 2 seconds

# Start continuous inference in background
$inferenceJob = Start-Job -ScriptBlock {
    param($duration)
    $endTime = (Get-Date).AddSeconds($duration)
    while ((Get-Date) -lt $endTime) {
        try {
            $prompt = @{
                prompt = "The quick brown fox jumps over the lazy dog. This is a test of GPU acceleration. "
                max_length = 100
                temperature = 0.7
            } | ConvertTo-Json
            
            Invoke-RestMethod -Uri "http://127.0.0.1:5001/api/v1/generate" -Method Post -Body $prompt -ContentType "application/json" -TimeoutSec 10 | Out-Null
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }
} -ArgumentList $DurationSeconds

# Monitor while inference is running
$sampleCount = [Math]::Ceiling($DurationSeconds / $interval)
for ($i = 0; $i -lt $sampleCount; $i++) {
    Start-Sleep -Seconds $interval
    
    $gpuUtil = Get-GPUUtilization
    $cpuUtil = (Get-Process "koboldcpp" -ErrorAction SilentlyContinue).CPU
    
    $samples += @{
        Time = Get-Date
        GPUUtilization = $gpuUtil
        CPUUsage = $cpuUtil
    }
    
    Write-Host "   Sample $($i+1)/$sampleCount - GPU: $gpuUtil" -ForegroundColor Gray
}

# Clean up background job
Stop-Job -Job $inferenceJob -ErrorAction SilentlyContinue
Remove-Job -Job $inferenceJob -ErrorAction SilentlyContinue

# Analysis
Write-Host "`n[Performance Analysis]" -ForegroundColor Cyan

$avgGPU = if ($samples[0].GPUUtilization -is [double]) {
    [Math]::Round(($samples | Measure-Object -Property GPUUtilization -Average).Average, 1)
} else {
    "Unable to measure"
}

Write-Host "   Average GPU Utilization: $avgGPU%" -ForegroundColor $(
    if ($avgGPU -is [double] -and $avgGPU -gt 40) { "Green" } 
    elseif ($avgGPU -is [double] -and $avgGPU -gt 10) { "Yellow" } 
    else { "Red" }
)

# Final verdict
Write-Host "`n===============================================================" -ForegroundColor Cyan
Write-Host "  VALIDATION RESULTS" -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan

$allChecks = @(
    @{ Name = "AMD GPU Detected"; Pass = ($null -ne $gpuInfo) },
    @{ Name = "OpenCL Available"; Pass = $openclAvailable },
    @{ Name = "--useclblast Flag"; Pass = ($cmdLine -like "*--useclblast*") },
    @{ Name = "GPU Layers > 0"; Pass = ($cmdLine -match "--gpulayers\s+[1-9]") }
)

$passCount = ($allChecks | Where-Object { $_.Pass }).Count
$totalChecks = $allChecks.Count

foreach ($check in $allChecks) {
    $status = if ($check.Pass) { "[PASS]" } else { "[FAIL]" }
    $color = if ($check.Pass) { "Green" } else { "Red" }
    Write-Host "   $status $($check.Name)" -ForegroundColor $color
}

Write-Host "`n   Score: $passCount/$totalChecks checks passed" -ForegroundColor $(
    if ($passCount -eq $totalChecks) { "Green" }
    elseif ($passCount -ge $totalChecks * 0.75) { "Yellow" }
    else { "Red" }
)

if ($passCount -eq $totalChecks) {
    Write-Host "`n[SUCCESS] GPU acceleration is properly configured!" -ForegroundColor Green
    Write-Host "  Your Radeon 890M iGPU should be accelerating inference." -ForegroundColor Green
} elseif ($passCount -ge $totalChecks * 0.75) {
    Write-Host "`n[WARNING] GPU acceleration is partially configured" -ForegroundColor Yellow
    Write-Host "   Some optimizations may not be active." -ForegroundColor Yellow
} else {
    Write-Host "`n[ERROR] GPU acceleration is NOT properly configured!" -ForegroundColor Red
    Write-Host "   Restart KoboldCpp with: .\start-kobold.ps1 -RyzenAIOptimized" -ForegroundColor Yellow
}

Write-Host "`n===============================================================" -ForegroundColor Cyan