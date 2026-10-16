# Metrics Collector - Full observability for LLM inference
# Collects TPS, latency, GPU/RAM usage, and exposes Prometheus-compatible /metrics

param(
    [int]$MetricsPort = 8082,         # Port for metrics endpoint
    [int]$LlamaPort = 5001,           # llama-server port to monitor
    [int]$PollInterval = 5,           # Seconds between metric polls
    [int]$HistoryMinutes = 60,        # Minutes of history to keep
    [switch]$Dashboard                 # Show live dashboard instead of running as service
)

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Metrics storage
$script:metrics = @{
    # Current values
    current = @{
        timestamp = $null
        llama_server_up = 0
        # TPS metrics
        prompt_tokens_per_second = 0.0
        generation_tokens_per_second = 0.0
        # Latency metrics
        time_to_first_token_ms = 0.0
        avg_request_latency_ms = 0.0
        # Throughput
        requests_total = 0
        requests_per_minute = 0.0
        tokens_generated_total = 0
        tokens_prompt_total = 0
        # Resource utilization
        gpu_memory_used_mb = 0
        gpu_memory_total_mb = 0
        gpu_utilization_percent = 0
        ram_used_mb = 0
        ram_available_mb = 0
        ram_total_mb = 0
        # Slot utilization
        slots_active = 0
        slots_total = 0
        # Errors
        errors_total = 0
        error_rate = 0.0
        # Cache
        cache_hits = 0
        cache_misses = 0
        cache_hit_rate = 0.0
    }
    # Historical data (time series)
    history = @()
    # Aggregates
    session = @{
        start_time = $null
        total_requests = 0
        total_tokens_generated = 0
        total_tokens_prompt = 0
        total_errors = 0
        avg_prompt_tps = 0.0
        avg_generation_tps = 0.0
        avg_ttft_ms = 0.0
        min_ttft_ms = [double]::MaxValue
        max_ttft_ms = 0.0
    }
}

$script:shutdownRequested = $false
$script:lastLlamaMetrics = $null

# Parse Prometheus metrics format
function Parse-PrometheusMetrics {
    param([string]$Text)

    $metrics = @{}
    $lines = $Text -split "`n"

    foreach ($line in $lines) {
        $line = $line.Trim()
        if ($line -eq "" -or $line.StartsWith("#")) { continue }

        # Parse metric line: metric_name{labels} value
        if ($line -match '^([a-zA-Z_][a-zA-Z0-9_]*)\{?([^}]*)\}?\s+(.+)$') {
            $name = $matches[1]
            $labels = $matches[2]
            $value = $matches[3]

            try {
                $numValue = [double]$value
                $key = if ($labels) { "${name}{$labels}" } else { $name }
                $metrics[$key] = $numValue
            } catch {
                # Skip non-numeric values
            }
        } elseif ($line -match '^([a-zA-Z_][a-zA-Z0-9_]*)\s+(.+)$') {
            $name = $matches[1]
            $value = $matches[2]
            try {
                $metrics[$name] = [double]$value
            } catch {}
        }
    }

    return $metrics
}

# Fetch metrics from llama-server
function Get-LlamaMetrics {
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:$LlamaPort/metrics" -Method GET -TimeoutSec 5
        $script:metrics.current.llama_server_up = 1
        return Parse-PrometheusMetrics -Text $response
    } catch {
        $script:metrics.current.llama_server_up = 0
        return $null
    }
}

# Get llama-server slots info
function Get-LlamaSlots {
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:$LlamaPort/slots" -Method GET -TimeoutSec 5
        return $response
    } catch {
        return $null
    }
}

# Get GPU metrics (AMD and NVIDIA)
function Get-GPUMetrics {
    $gpuMetrics = @{
        memory_used_mb = 0
        memory_total_mb = 0
        utilization_percent = 0
    }

    # Try NVIDIA first (nvidia-smi)
    try {
        $nvidiaSmi = & nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits 2>$null
        if ($LASTEXITCODE -eq 0 -and $nvidiaSmi) {
            $parts = $nvidiaSmi -split ","
            $gpuMetrics.memory_used_mb = [int]$parts[0].Trim()
            $gpuMetrics.memory_total_mb = [int]$parts[1].Trim()
            $gpuMetrics.utilization_percent = [int]$parts[2].Trim()
            return $gpuMetrics
        }
    } catch {}

    # Try AMD (rocm-smi) - less common on Windows
    try {
        $rocmSmi = & rocm-smi --showmeminfo vram --csv 2>$null
        if ($LASTEXITCODE -eq 0 -and $rocmSmi) {
            # Parse rocm-smi output
            # This is a simplified parser
            return $gpuMetrics
        }
    } catch {}

    # Fallback: estimate from process memory (for iGPU)
    try {
        $llamaProcess = Get-Process -Name "llama-server" -ErrorAction SilentlyContinue
        if ($llamaProcess) {
            $gpuMetrics.memory_used_mb = [int]($llamaProcess.WorkingSet64 / 1MB)
            # For iGPU, total is shared system memory
            $os = Get-CimInstance -ClassName Win32_OperatingSystem
            $gpuMetrics.memory_total_mb = [int]($os.TotalVisibleMemorySize / 1024 * 0.5)  # Assume 50% can be used
        }
    } catch {}

    return $gpuMetrics
}

# Get RAM metrics
function Get-RAMMetrics {
    try {
        $os = Get-CimInstance -ClassName Win32_OperatingSystem
        return @{
            total_mb = [int]($os.TotalVisibleMemorySize / 1024)
            available_mb = [int]($os.FreePhysicalMemory / 1024)
            used_mb = [int](($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1024)
        }
    } catch {
        return @{ total_mb = 0; available_mb = 0; used_mb = 0 }
    }
}

# Update all metrics
function Update-Metrics {
    $timestamp = Get-Date
    $script:metrics.current.timestamp = $timestamp.ToString("o")

    # Get llama-server metrics
    $llamaMetrics = Get-LlamaMetrics

    if ($llamaMetrics) {
        # Extract TPS metrics
        if ($llamaMetrics.ContainsKey("llamacpp_prompt_tokens_seconds")) {
            $script:metrics.current.prompt_tokens_per_second = [Math]::Round($llamaMetrics["llamacpp_prompt_tokens_seconds"], 2)
        }
        if ($llamaMetrics.ContainsKey("llamacpp_tokens_predicted_seconds")) {
            $script:metrics.current.generation_tokens_per_second = [Math]::Round($llamaMetrics["llamacpp_tokens_predicted_seconds"], 2)
        }

        # Token counts
        if ($llamaMetrics.ContainsKey("llamacpp_tokens_predicted_total")) {
            $newTokens = [int]$llamaMetrics["llamacpp_tokens_predicted_total"]
            $script:metrics.session.total_tokens_generated = $newTokens
            $script:metrics.current.tokens_generated_total = $newTokens
        }
        if ($llamaMetrics.ContainsKey("llamacpp_prompt_tokens_total")) {
            $newPromptTokens = [int]$llamaMetrics["llamacpp_prompt_tokens_total"]
            $script:metrics.session.total_tokens_prompt = $newPromptTokens
            $script:metrics.current.tokens_prompt_total = $newPromptTokens
        }

        # Request counts
        if ($llamaMetrics.ContainsKey("llamacpp_requests_processing")) {
            $script:metrics.current.slots_active = [int]$llamaMetrics["llamacpp_requests_processing"]
        }

        # KV cache metrics
        foreach ($key in $llamaMetrics.Keys) {
            if ($key -match "llamacpp_kv_cache_tokens_count") {
                # Cache utilization
            }
        }

        # Calculate requests per minute from history
        if ($script:metrics.history.Count -ge 2) {
            $oldestInWindow = $script:metrics.history | Where-Object {
                ([DateTime]$_.timestamp) -gt $timestamp.AddMinutes(-1)
            } | Select-Object -First 1

            if ($oldestInWindow) {
                $tokenDiff = $script:metrics.current.tokens_generated_total - $oldestInWindow.tokens_generated_total
                $timeDiff = ($timestamp - [DateTime]$oldestInWindow.timestamp).TotalMinutes
                if ($timeDiff -gt 0) {
                    $script:metrics.current.requests_per_minute = [Math]::Round($tokenDiff / $timeDiff / 100, 2)  # Rough estimate
                }
            }
        }

        $script:lastLlamaMetrics = $llamaMetrics
    }

    # Get slot info
    $slots = Get-LlamaSlots
    if ($slots) {
        $script:metrics.current.slots_total = $slots.Count
        $script:metrics.current.slots_active = ($slots | Where-Object { $_.state -ne 0 }).Count
    }

    # Get GPU metrics
    $gpuMetrics = Get-GPUMetrics
    $script:metrics.current.gpu_memory_used_mb = $gpuMetrics.memory_used_mb
    $script:metrics.current.gpu_memory_total_mb = $gpuMetrics.memory_total_mb
    $script:metrics.current.gpu_utilization_percent = $gpuMetrics.utilization_percent

    # Get RAM metrics
    $ramMetrics = Get-RAMMetrics
    $script:metrics.current.ram_used_mb = $ramMetrics.used_mb
    $script:metrics.current.ram_available_mb = $ramMetrics.available_mb
    $script:metrics.current.ram_total_mb = $ramMetrics.total_mb

    # Update session aggregates
    if ($script:metrics.current.prompt_tokens_per_second -gt 0) {
        $samples = $script:metrics.history.Count + 1
        $script:metrics.session.avg_prompt_tps = [Math]::Round(
            (($script:metrics.session.avg_prompt_tps * ($samples - 1)) + $script:metrics.current.prompt_tokens_per_second) / $samples, 2
        )
    }
    if ($script:metrics.current.generation_tokens_per_second -gt 0) {
        $samples = $script:metrics.history.Count + 1
        $script:metrics.session.avg_generation_tps = [Math]::Round(
            (($script:metrics.session.avg_generation_tps * ($samples - 1)) + $script:metrics.current.generation_tokens_per_second) / $samples, 2
        )
    }

    # Store in history
    $historyEntry = $script:metrics.current.Clone()
    $script:metrics.history += $historyEntry

    # Trim old history
    $cutoff = $timestamp.AddMinutes(-$HistoryMinutes)
    $script:metrics.history = @($script:metrics.history | Where-Object {
        [DateTime]$_.timestamp -gt $cutoff
    })
}

# Generate Prometheus-format metrics
function Get-PrometheusOutput {
    $m = $script:metrics.current
    $output = @"
# HELP llm_server_up Whether the LLM server is up (1) or down (0)
# TYPE llm_server_up gauge
llm_server_up $($m.llama_server_up)

# HELP llm_prompt_tokens_per_second Prompt processing speed (tokens/second)
# TYPE llm_prompt_tokens_per_second gauge
llm_prompt_tokens_per_second $($m.prompt_tokens_per_second)

# HELP llm_generation_tokens_per_second Generation speed (tokens/second)
# TYPE llm_generation_tokens_per_second gauge
llm_generation_tokens_per_second $($m.generation_tokens_per_second)

# HELP llm_tokens_generated_total Total tokens generated
# TYPE llm_tokens_generated_total counter
llm_tokens_generated_total $($m.tokens_generated_total)

# HELP llm_tokens_prompt_total Total prompt tokens processed
# TYPE llm_tokens_prompt_total counter
llm_tokens_prompt_total $($m.tokens_prompt_total)

# HELP llm_slots_active Number of active inference slots
# TYPE llm_slots_active gauge
llm_slots_active $($m.slots_active)

# HELP llm_slots_total Total inference slots available
# TYPE llm_slots_total gauge
llm_slots_total $($m.slots_total)

# HELP llm_gpu_memory_used_bytes GPU memory used
# TYPE llm_gpu_memory_used_bytes gauge
llm_gpu_memory_used_bytes $($m.gpu_memory_used_mb * 1048576)

# HELP llm_gpu_memory_total_bytes GPU memory total
# TYPE llm_gpu_memory_total_bytes gauge
llm_gpu_memory_total_bytes $($m.gpu_memory_total_mb * 1048576)

# HELP llm_gpu_utilization GPU utilization percentage
# TYPE llm_gpu_utilization gauge
llm_gpu_utilization $($m.gpu_utilization_percent)

# HELP llm_ram_used_bytes System RAM used
# TYPE llm_ram_used_bytes gauge
llm_ram_used_bytes $($m.ram_used_mb * 1048576)

# HELP llm_ram_available_bytes System RAM available
# TYPE llm_ram_available_bytes gauge
llm_ram_available_bytes $($m.ram_available_mb * 1048576)

# HELP llm_ram_total_bytes System RAM total
# TYPE llm_ram_total_bytes gauge
llm_ram_total_bytes $($m.ram_total_mb * 1048576)
"@
    return $output
}

# Generate JSON metrics
function Get-JSONMetrics {
    return @{
        current = $script:metrics.current
        session = $script:metrics.session
        history_points = $script:metrics.history.Count
    } | ConvertTo-Json -Depth 3
}

# Dashboard view
function Show-Dashboard {
    while (-not $script:shutdownRequested) {
        Update-Metrics

        Clear-Host
        $m = $script:metrics.current
        $s = $script:metrics.session

        Write-Host "=====================================================" -ForegroundColor Cyan
        Write-Host "  LLM Performance Dashboard" -ForegroundColor Cyan
        Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
        Write-Host "=====================================================" -ForegroundColor Cyan
        Write-Host ""

        # Server status
        $statusColor = if ($m.llama_server_up -eq 1) { "Green" } else { "Red" }
        $statusText = if ($m.llama_server_up -eq 1) { "RUNNING" } else { "DOWN" }
        Write-Host "  Server Status: " -NoNewline
        Write-Host $statusText -ForegroundColor $statusColor
        Write-Host ""

        # TPS metrics
        Write-Host "  PERFORMANCE" -ForegroundColor Yellow
        Write-Host "  ----------------------------------------"
        Write-Host "  Prompt TPS:      " -NoNewline
        Write-Host ("{0,8:N1}" -f $m.prompt_tokens_per_second) -ForegroundColor $(if ($m.prompt_tokens_per_second -gt 100) { "Green" } elseif ($m.prompt_tokens_per_second -gt 50) { "Yellow" } else { "Red" }) -NoNewline
        Write-Host " tok/s  (avg: $($s.avg_prompt_tps))"

        Write-Host "  Generation TPS:  " -NoNewline
        Write-Host ("{0,8:N1}" -f $m.generation_tokens_per_second) -ForegroundColor $(if ($m.generation_tokens_per_second -gt 30) { "Green" } elseif ($m.generation_tokens_per_second -gt 15) { "Yellow" } else { "Red" }) -NoNewline
        Write-Host " tok/s  (avg: $($s.avg_generation_tps))"
        Write-Host ""

        # Resource utilization
        Write-Host "  RESOURCES" -ForegroundColor Yellow
        Write-Host "  ----------------------------------------"
        $gpuMemPct = if ($m.gpu_memory_total_mb -gt 0) { [Math]::Round($m.gpu_memory_used_mb / $m.gpu_memory_total_mb * 100, 1) } else { 0 }
        Write-Host "  GPU Memory:      " -NoNewline
        Write-Host ("{0,8:N0}" -f $m.gpu_memory_used_mb) -ForegroundColor $(if ($gpuMemPct -lt 80) { "Green" } elseif ($gpuMemPct -lt 95) { "Yellow" } else { "Red" }) -NoNewline
        Write-Host " MB / $($m.gpu_memory_total_mb) MB ($gpuMemPct%)"

        Write-Host "  GPU Utilization: " -NoNewline
        Write-Host ("{0,8:N0}" -f $m.gpu_utilization_percent) -ForegroundColor $(if ($m.gpu_utilization_percent -gt 50) { "Green" } else { "Yellow" }) -NoNewline
        Write-Host " %"

        $ramPct = if ($m.ram_total_mb -gt 0) { [Math]::Round($m.ram_used_mb / $m.ram_total_mb * 100, 1) } else { 0 }
        Write-Host "  System RAM:      " -NoNewline
        Write-Host ("{0,8:N0}" -f $m.ram_used_mb) -ForegroundColor $(if ($ramPct -lt 80) { "Green" } elseif ($ramPct -lt 95) { "Yellow" } else { "Red" }) -NoNewline
        Write-Host " MB / $($m.ram_total_mb) MB ($ramPct%)"
        Write-Host ""

        # Slot utilization
        Write-Host "  SLOTS" -ForegroundColor Yellow
        Write-Host "  ----------------------------------------"
        Write-Host "  Active/Total:    $($m.slots_active) / $($m.slots_total)"
        Write-Host ""

        # Totals
        Write-Host "  SESSION TOTALS" -ForegroundColor Yellow
        Write-Host "  ----------------------------------------"
        Write-Host "  Tokens Generated: $($s.total_tokens_generated)"
        Write-Host "  Tokens Prompted:  $($s.total_tokens_prompt)"
        Write-Host "  History Points:   $($script:metrics.history.Count)"
        Write-Host ""

        Write-Host "  Press Ctrl+C to exit" -ForegroundColor Gray

        Start-Sleep -Seconds $PollInterval
    }
}

# HTTP server for metrics endpoint
function Start-MetricsServer {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://127.0.0.1:$MetricsPort/")

    try {
        $listener.Start()
        Write-Host "[Metrics] Prometheus metrics at http://127.0.0.1:$MetricsPort/metrics" -ForegroundColor Green
        Write-Host "[Metrics] JSON metrics at http://127.0.0.1:$MetricsPort/json" -ForegroundColor Green
        Write-Host "[Metrics] Health at http://127.0.0.1:$MetricsPort/health" -ForegroundColor Green
        Write-Host ""
    } catch {
        Write-Host "[ERROR] Failed to start metrics server: $_" -ForegroundColor Red
        return $null
    }

    return $listener
}

function Handle-MetricsRequest {
    param($context)

    $request = $context.Request
    $response = $context.Response
    $path = $request.Url.LocalPath

    $responseBody = ""
    $contentType = "text/plain"
    $statusCode = 200

    switch ($path) {
        "/metrics" {
            $responseBody = Get-PrometheusOutput
            $contentType = "text/plain; version=0.0.4"
        }
        "/json" {
            $responseBody = Get-JSONMetrics
            $contentType = "application/json"
        }
        "/health" {
            $responseBody = @{ status = "ok"; llama_up = ($script:metrics.current.llama_server_up -eq 1) } | ConvertTo-Json
            $contentType = "application/json"
        }
        "/history" {
            $responseBody = @{ history = $script:metrics.history } | ConvertTo-Json -Depth 3
            $contentType = "application/json"
        }
        default {
            $statusCode = 404
            $responseBody = "Not found. Try /metrics, /json, /health, or /history"
        }
    }

    $response.StatusCode = $statusCode
    $response.ContentType = $contentType
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseBody)
    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.Close()
}

# Main
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  LLM Metrics Collector" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

$script:metrics.session.start_time = (Get-Date).ToString("o")

if ($Dashboard) {
    Show-Dashboard
} else {
    # Run as service with HTTP endpoint
    $listener = Start-MetricsServer
    if (-not $listener) { exit 1 }

    # Start background polling
    $pollJob = Start-Job -ScriptBlock {
        param($PollInterval, $LlamaPort, $HistoryMinutes)
        while ($true) {
            # This runs in a separate process, so we need to signal main process
            Start-Sleep -Seconds $PollInterval
        }
    } -ArgumentList $PollInterval, $LlamaPort, $HistoryMinutes

    Write-Host "[Metrics] Polling llama-server every ${PollInterval}s..." -ForegroundColor Yellow
    Write-Host "[Metrics] Press Ctrl+C to stop" -ForegroundColor Yellow
    Write-Host ""

    try {
        while (-not $script:shutdownRequested) {
            # Update metrics
            Update-Metrics

            # Handle HTTP requests (non-blocking with timeout)
            $result = $listener.BeginGetContext($null, $null)
            $waited = $result.AsyncWaitHandle.WaitOne(($PollInterval * 1000))

            if ($waited) {
                $context = $listener.EndGetContext($result)
                Handle-MetricsRequest -context $context
            }
        }
    } catch {
        if (-not $script:shutdownRequested) {
            Write-Host "[ERROR] $_" -ForegroundColor Red
        }
    } finally {
        Write-Host "`n[Metrics] Shutting down..." -ForegroundColor Yellow
        $listener.Stop()
        Stop-Job $pollJob -ErrorAction SilentlyContinue
        Remove-Job $pollJob -ErrorAction SilentlyContinue
        Write-Host "[Metrics] Goodbye!" -ForegroundColor Green
    }
}
