param(
    [int]$DurationSeconds = 60,
    [int]$SampleIntervalSeconds = 2,
    [string]$OutputFile = "performance\hardware_utilization_$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss').csv"
)

Write-Host "Ryzen AI 300 Hardware Utilization Monitor" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Monitoring Duration: $DurationSeconds seconds" -ForegroundColor Yellow
Write-Host "Sample Interval: $SampleIntervalSeconds seconds" -ForegroundColor Yellow
Write-Host "Output File: $OutputFile" -ForegroundColor Yellow
Write-Host ""

# Create performance directory if it doesn't exist
if (!(Test-Path "performance")) {
    New-Item -ItemType Directory -Path "performance" | Out-Null
}

# CSV Header
$header = "Timestamp,CPU_Percent,Memory_Percent,GPU_Percent,GPU_Memory_Used_MB,Process_Count"
$header | Out-File $OutputFile -Encoding UTF8

Write-Host "Starting hardware monitoring..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop monitoring early" -ForegroundColor Yellow
Write-Host ""

$samples = 0
$startTime = Get-Date

try {
    while (((Get-Date) - $startTime).TotalSeconds -lt $DurationSeconds) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

        # CPU Usage
        $cpuUsage = Get-Counter '\Processor(_Total)\% Processor Time' -ErrorAction SilentlyContinue
        $cpuPercent = if ($cpuUsage) { [Math]::Round($cpuUsage.CounterSamples[0].CookedValue, 2) } else { 0 }

        # Memory Usage
        $memoryUsage = Get-Counter '\Memory\% Committed Bytes In Use' -ErrorAction SilentlyContinue
        $memoryPercent = if ($memoryUsage) { [Math]::Round($memoryUsage.CounterSamples[0].CookedValue, 2) } else { 0 }

        # GPU Usage (try multiple counters)
        $gpuPercent = 0
        $gpuMemoryUsed = 0

        try {
            # Try GPU Engine utilization
            $gpuCounter = Get-Counter '\GPU Engine(*)\Utilization Percentage' -ErrorAction SilentlyContinue
            if ($gpuCounter -and $gpuCounter.CounterSamples.Count -gt 0) {
                $gpuPercent = [Math]::Round($gpuCounter.CounterSamples[0].CookedValue, 2)
            }

            # Try GPU Memory
            $gpuMemoryCounter = Get-Counter '\GPU Process Memory(*)\Dedicated Usage' -ErrorAction SilentlyContinue
            if ($gpuMemoryCounter -and $gpuMemoryCounter.CounterSamples.Count -gt 0) {
                $gpuMemoryUsed = [Math]::Round($gpuMemoryCounter.CounterSamples[0].CookedValue / 1MB, 2)
            }
        }
        catch {
            # GPU counters not available
        }

        # Process Count (look for KoboldCpp and other relevant processes)
        $koboldProcess = Get-Process "koboldcpp" -ErrorAction SilentlyContinue
        $processCount = if ($koboldProcess) { $koboldProcess.Count } else { 0 }

        # Create CSV row
        $row = "$timestamp,$cpuPercent,$memoryPercent,$gpuPercent,$gpuMemoryUsed,$processCount"
        $row | Out-File $OutputFile -Encoding UTF8 -Append

        # Display current metrics
        Write-Host "[$timestamp] CPU: $($cpuPercent.ToString('F1'))% | MEM: $($memoryPercent.ToString('F1'))% | GPU: $($gpuPercent.ToString('F1'))% | GPU_MEM: $($gpuMemoryUsed.ToString('F1'))MB | Processes: $processCount" -ForegroundColor White

        $samples++
        Start-Sleep -Seconds $SampleIntervalSeconds
    }
}
catch {
    Write-Host "`nMonitoring stopped: $($_.Exception.Message)" -ForegroundColor Yellow
}

$endTime = Get-Date
$totalDuration = ($endTime - $startTime).TotalSeconds

Write-Host ""
Write-Host "Monitoring completed!" -ForegroundColor Green
Write-Host "Total Samples: $samples" -ForegroundColor Cyan
Write-Host "Actual Duration: $($totalDuration.ToString('F1')) seconds" -ForegroundColor Cyan
Write-Host "Average Sample Interval: $(($totalDuration / $samples).ToString('F2')) seconds" -ForegroundColor Cyan
Write-Host "Results saved to: $OutputFile" -ForegroundColor Green

# Quick analysis
if ($samples -gt 0) {
    $data = Import-Csv $OutputFile
    $avgCPU = ($data | Measure-Object -Property CPU_Percent -Average).Average
    $avgMemory = ($data | Measure-Object -Property Memory_Percent -Average).Average
    $avgGPU = ($data | Measure-Object -Property GPU_Percent -Average).Average

    Write-Host ""
    Write-Host "Average Utilization:" -ForegroundColor Cyan
    Write-Host "  CPU: $($avgCPU.ToString('F1'))%" -ForegroundColor White
    Write-Host "  Memory: $($avgMemory.ToString('F1'))%" -ForegroundColor White
    Write-Host "  GPU: $($avgGPU.ToString('F1'))%" -ForegroundColor White

    # Assessment
    Write-Host ""
    Write-Host "Hardware Utilization Assessment:" -ForegroundColor Cyan
    if ($avgGPU -lt 10) {
        Write-Host "  GPU: Very Low - Likely CPU-only inference" -ForegroundColor Red
    } elseif ($avgGPU -lt 30) {
        Write-Host "  GPU: Low - Minimal GPU offload" -ForegroundColor Yellow
    } elseif ($avgGPU -lt 60) {
        Write-Host "  GPU: Moderate - Some GPU acceleration" -ForegroundColor Green
    } else {
        Write-Host "  GPU: High - Good GPU utilization" -ForegroundColor Green
    }

    if ($avgCPU -gt 80) {
        Write-Host "  CPU: High - Potential CPU bottleneck" -ForegroundColor Yellow
    }
}

return $OutputFile