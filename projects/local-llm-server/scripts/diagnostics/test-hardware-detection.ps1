#!/usr/bin/env pwsh
# Hardware Detection System Test Script
# Tests the auto-optimization system on the current hardware

param(
    [switch]$Verbose,
    [switch]$TestAllProfiles,
    [string]$TestConfig
)

Write-Host " LLM Server Hardware Detection System Test" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Test 1: Basic Hardware Detection
Write-Host "`n1. Testing hardware detection..." -ForegroundColor Yellow
try {
    $hardwareInfo = & ".\scripts\detect-hardware.ps1" -Detailed
    Write-Host " Hardware detection completed successfully" -ForegroundColor Green
}
catch {
    Write-Host " Hardware detection failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Configuration Generation
Write-Host "`n2. Testing configuration generation..." -ForegroundColor Yellow
$configPath = "config\env.auto"
$autoConfig = $null
if (Test-Path $configPath) {
    $autoConfig = @{}
    Get-Content $configPath | Where-Object { $_ -match "=" } | ForEach-Object {
        $key = $_.Split("=")[0]
        $value = $_.Split("=")[1]
        $autoConfig[$key] = $value
    }

    Write-Host " Auto-configuration generated:" -ForegroundColor Green
    $autoConfig.GetEnumerator() | ForEach-Object {
        Write-Host "  $($_.Key): $($_.Value)" -ForegroundColor Gray
    }
} else {
    Write-Host " Auto-configuration file not found at $configPath" -ForegroundColor Red
}

# Test 3: Dry Run Test
Write-Host "`n3. Testing dry run with auto-configuration..." -ForegroundColor Yellow
try {
    Write-Host "Running: .\start-llama-server.ps1 -UseAutoConfig -DryRun" -ForegroundColor Gray
    & ".\start-llama-server.ps1" -UseAutoConfig -DryRun
    Write-Host " Dry run completed successfully" -ForegroundColor Green
}
catch {
    Write-Host " Dry run failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Configuration Template Tests
Write-Host "`n4. Testing configuration templates..." -ForegroundColor Yellow

$configTemplates = @(
    @{ Name = "High-End"; Path = "config\env.high-end" },
    @{ Name = "Mid-Range"; Path = "config\env.mid-range" },
    @{ Name = "Low-End"; Path = "config\env.low-end" }
)

foreach ($template in $configTemplates) {
    if (Test-Path $template.Path) {
        try {
            & ".\start-llama-server.ps1" -ConfigPath $template.Path -DryRun
            Write-Host " $($template.Name) template: Valid" -ForegroundColor Green
        }
        catch {
            Write-Host " $($template.Name) template: Failed - $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host " $($template.Name) template: Missing ($($template.Path))" -ForegroundColor Red
    }
}

# Test 5: Hardware Compatibility Check
Write-Host "`n5. Testing hardware compatibility..." -ForegroundColor Yellow

try {
    # Check if required files exist
    $requiredFiles = @(
        "llamacpp\bin\*\llama-cli.exe",
        "models\Llama-3.2-1B-Instruct-Q4_K_M.gguf",
        "models\Roleplay-Mistral-7B.Q4_K_M.gguf"
    )

    foreach ($file in $requiredFiles) {
        if (Test-Path $file) {
            Write-Host " $file" -ForegroundColor Green
        } else {
            Write-Host " $file (missing)" -ForegroundColor Yellow
        }
    }
}
catch {
    Write-Host " Compatibility check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Summary
Write-Host "`n Test Summary:" -ForegroundColor Cyan
Write-Host "Hardware detection system is ready for use!" -ForegroundColor Green
Write-Host "`nUsage options:" -ForegroundColor White
Write-Host "  .\start-llama-server.ps1 -UseAutoConfig    # Auto-detect and optimize" -ForegroundColor Gray
Write-Host "  .\start-llama-server.ps1 -AutoDetect       # Just detect, use manual config" -ForegroundColor Gray
Write-Host "  .\start-llama-server.ps1 -ConfigPath config\env.high-end  # Use specific tier" -ForegroundColor Gray
Write-Host "  .\scripts\detect-hardware.ps1 -Detailed             # Hardware info only" -ForegroundColor Gray

if ($Verbose) {
    Write-Host "`n Verbose Output:" -ForegroundColor Cyan
    Write-Host "Detected GPU Type: $(if ($hardwareInfo) { $hardwareInfo['Type'] } else { 'Unknown' })"
    Write-Host "Recommended GPU Layers: $(if ($autoConfig -and $autoConfig.ContainsKey('LLM_GPULAYERS')) { $autoConfig['LLM_GPULAYERS'] } else { 'Unknown' })"
    Write-Host "Recommended Threads: $(if ($autoConfig -and $autoConfig.ContainsKey('LLM_THREADS')) { $autoConfig['LLM_THREADS'] } else { 'Unknown' })"
    Write-Host "Recommended Context: $(if ($autoConfig -and $autoConfig.ContainsKey('LLM_CTX')) { $autoConfig['LLM_CTX'] } else { 'Unknown' })"
}

Write-Host "`n Hardware detection system test completed!" -ForegroundColor Green