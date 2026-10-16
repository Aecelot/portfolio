# LLM Performance Benchmark Script
# Measures tokens per second (TPS) for both prompt processing and generation

param(
    [string]$Url = "http://127.0.0.1:5001/v1/chat/completions",
    [int]$Iterations = 5,
    [int]$MaxTokens = 512,
    [string]$OutputFile = "benchmark-results.json"
)

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  LLM Performance Benchmark" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Check if server is running
Write-Host "[1/4] Checking server availability..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-RestMethod -Uri "http://127.0.0.1:5001/health" -ErrorAction Stop
    Write-Host "      ✅ Server is running" -ForegroundColor Green
} catch {
    Write-Host "      ❌ Server not responding at http://127.0.0.1:5001" -ForegroundColor Red
    Write-Host "      Please start the server first: .\start-llama-server.ps1" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Test prompts of varying lengths (XML-formatted)
$testPrompts = @(
    @{
        Name = "Short Prompt (~50 tokens)"
        Content = @"
<task>
<instruction>Write a haiku about artificial intelligence</instruction>
<requirements>
    <format>3 lines (5-7-5 syllables)</format>
    <theme>AI and technology</theme>
    <tone>thoughtful</tone>
</requirements>
</task>
"@
    },
    @{
        Name = "Medium Prompt (~200 tokens)"
        Content = @"
<task>
<role>creative storyteller</role>
<instruction>Write a short story about a dragon discovering a modern city</instruction>
<context>
    <protagonist>
        <species>dragon</species>
        <personality>curious but cautious</personality>
        <background>first time seeing human civilization</background>
    </protagonist>
    <setting>
        <location>modern metropolitan city</location>
        <time>present day</time>
    </setting>
</context>
<requirements>
    <focus>
        <element>first impressions of cars</element>
        <element>reactions to streetlights</element>
        <element>confusion about smartphones</element>
    </focus>
    <tone>whimsical and family-friendly</tone>
    <length>300-400 words</length>
</requirements>
</task>
"@
    },
    @{
        Name = "Long Prompt (~500 tokens)"
        Content = @"
<task>
<role>expert software architect</role>
<instruction>Design a distributed system for real-time data stream processing</instruction>

<requirements>
    <performance>
        <throughput>10,000 events per second</throughput>
        <uptime>99.9% SLA</uptime>
        <latency>sub-second processing</latency>
    </performance>
    <distribution>
        <region name="US" load="40%"/>
        <region name="EU" load="35%"/>
        <region name="Asia" load="25%"/>
    </distribution>
    <data_retention>90 days</data_retention>
    <query_support>
        <type>real-time queries</type>
        <type>batch analytics</type>
    </query_support>
    <compliance>
        <standard>GDPR</standard>
        <standard>CCPA</standard>
    </compliance>
</requirements>

<current_stack>
    <component name="event_streaming">Apache Kafka</component>
    <component name="stream_processing">Apache Flink</component>
    <component name="persistent_storage">PostgreSQL</component>
    <component name="caching">Redis</component>
    <component name="orchestration">Kubernetes</component>
</current_stack>

<deliverables>
    <architecture_design>
        <section id="1">
            <title>Data Ingestion Pipeline</title>
            <details>event sources, message format, partitioning strategy</details>
        </section>
        <section id="2">
            <title>Processing Layer Architecture</title>
            <details>Flink job topology, state management, checkpointing</details>
        </section>
        <section id="3">
            <title>Storage Strategy</title>
            <details>
                <tier>hot data (last 7 days)</tier>
                <tier>warm data (8-30 days)</tier>
                <tier>cold data (31-90 days)</tier>
            </details>
        </section>
        <section id="4">
            <title>Failure Recovery Mechanisms</title>
            <details>replication, failover, disaster recovery</details>
        </section>
        <section id="5">
            <title>Monitoring and Observability</title>
            <details>metrics, logging, tracing, alerting</details>
        </section>
        <section id="6">
            <title>Security and Compliance</title>
            <details>encryption, access control, audit logging, data governance</details>
        </section>
    </architecture_design>
    <trade_offs>
        <explain>component choices and alternatives</explain>
        <explain>cost vs performance considerations</explain>
        <explain>scalability limitations</explain>
    </trade_offs>
</deliverables>

<constraints>
    <budget>moderate (not unlimited)</budget>
    <team_expertise>experienced with current stack</team_expertise>
    <timeline>production in 6 months</timeline>
</constraints>
</task>
"@
    }
)

Write-Host "[2/4] Running benchmark tests..." -ForegroundColor Yellow
Write-Host "      Iterations per prompt: $Iterations" -ForegroundColor Gray
Write-Host "      Max tokens per response: $MaxTokens" -ForegroundColor Gray
Write-Host ""

$allResults = @()

foreach ($testPrompt in $testPrompts) {
    Write-Host "  Testing: $($testPrompt.Name)" -ForegroundColor Cyan
    Write-Host "  " -NoNewline

    $promptResults = @()

    for ($i = 1; $i -le $Iterations; $i++) {
        Write-Host "." -NoNewline -ForegroundColor Gray

        # Build request
        $requestBody = @{
            model = "llama-3.2-3b-instruct"
            messages = @(
                @{
                    role = "user"
                    content = $testPrompt.Content
                }
            )
            max_tokens = $MaxTokens
            temperature = 0.7
            stream = $false
        } | ConvertTo-Json -Depth 10

        # Measure request time
        $startTime = Get-Date

        try {
            $response = Invoke-RestMethod `
                -Uri $Url `
                -Method Post `
                -ContentType "application/json" `
                -Body $requestBody `
                -ErrorAction Stop

            $endTime = Get-Date
            $duration = ($endTime - $startTime).TotalSeconds

            # Extract metrics
            $promptTokens = $response.usage.prompt_tokens
            $completionTokens = $response.usage.completion_tokens
            $totalTokens = $response.usage.total_tokens

            # Calculate TPS
            $promptTPS = if ($duration -gt 0) { $promptTokens / $duration } else { 0 }
            $completionTPS = if ($duration -gt 0) { $completionTokens / $duration } else { 0 }
            $totalTPS = if ($duration -gt 0) { $totalTokens / $duration } else { 0 }

            # Store result
            $promptResults += @{
                Iteration = $i
                Duration = $duration
                PromptTokens = $promptTokens
                CompletionTokens = $completionTokens
                TotalTokens = $totalTokens
                PromptTPS = $promptTPS
                CompletionTPS = $completionTPS
                TotalTPS = $totalTPS
                Success = $true
            }

        } catch {
            Write-Host "!" -NoNewline -ForegroundColor Red
            $promptResults += @{
                Iteration = $i
                Success = $false
                Error = $_.Exception.Message
            }
        }

        # Brief pause between requests
        Start-Sleep -Milliseconds 100
    }

    Write-Host " Done" -ForegroundColor Green

    # Calculate statistics for this prompt
    $successfulRuns = $promptResults | Where-Object { $_.Success -eq $true }

    if ($successfulRuns.Count -gt 0) {
        $stats = @{
            PromptName = $testPrompt.Name
            Iterations = $Iterations
            SuccessfulRuns = $successfulRuns.Count
            FailedRuns = $Iterations - $successfulRuns.Count

            # Duration stats
            AvgDuration = ($successfulRuns | Measure-Object -Property Duration -Average).Average
            MinDuration = ($successfulRuns | Measure-Object -Property Duration -Minimum).Minimum
            MaxDuration = ($successfulRuns | Measure-Object -Property Duration -Maximum).Maximum

            # Token stats
            AvgPromptTokens = ($successfulRuns | Measure-Object -Property PromptTokens -Average).Average
            AvgCompletionTokens = ($successfulRuns | Measure-Object -Property CompletionTokens -Average).Average
            AvgTotalTokens = ($successfulRuns | Measure-Object -Property TotalTokens -Average).Average

            # TPS stats
            AvgPromptTPS = ($successfulRuns | Measure-Object -Property PromptTPS -Average).Average
            MinPromptTPS = ($successfulRuns | Measure-Object -Property PromptTPS -Minimum).Minimum
            MaxPromptTPS = ($successfulRuns | Measure-Object -Property PromptTPS -Maximum).Maximum

            AvgCompletionTPS = ($successfulRuns | Measure-Object -Property CompletionTPS -Average).Average
            MinCompletionTPS = ($successfulRuns | Measure-Object -Property CompletionTPS -Minimum).Minimum
            MaxCompletionTPS = ($successfulRuns | Measure-Object -Property CompletionTPS -Maximum).Maximum

            AvgTotalTPS = ($successfulRuns | Measure-Object -Property TotalTPS -Average).Average
            MinTotalTPS = ($successfulRuns | Measure-Object -Property TotalTPS -Minimum).Minimum
            MaxTotalTPS = ($successfulRuns | Measure-Object -Property TotalTPS -Maximum).Maximum

            # Raw results
            RawResults = $promptResults
        }

        $allResults += $stats

        # Display summary for this prompt
        Write-Host "      Duration:        $([math]::Round($stats.AvgDuration, 2))s (avg)" -ForegroundColor White
        Write-Host "      Prompt TPS:      $([math]::Round($stats.AvgPromptTPS, 1)) tokens/sec" -ForegroundColor Cyan
        Write-Host "      Completion TPS:  $([math]::Round($stats.AvgCompletionTPS, 1)) tokens/sec" -ForegroundColor Green
        Write-Host "      Total TPS:       $([math]::Round($stats.AvgTotalTPS, 1)) tokens/sec" -ForegroundColor Yellow
        Write-Host ""

    } else {
        Write-Host "      ❌ All iterations failed!" -ForegroundColor Red
        Write-Host ""
    }
}

# Calculate overall statistics
Write-Host "[3/4] Calculating overall statistics..." -ForegroundColor Yellow
Write-Host ""

$overallStats = @{
    TestDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    ServerUrl = $Url
    MaxTokens = $MaxTokens
    IterationsPerPrompt = $Iterations

    # Overall averages
    OverallAvgPromptTPS = ($allResults | Measure-Object -Property AvgPromptTPS -Average).Average
    OverallAvgCompletionTPS = ($allResults | Measure-Object -Property AvgCompletionTPS -Average).Average
    OverallAvgTotalTPS = ($allResults | Measure-Object -Property AvgTotalTPS -Average).Average

    # Per-prompt results
    PromptResults = $allResults
}

# Display final results
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  BENCHMARK RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Overall Performance Metrics:" -ForegroundColor White
Write-Host ""
Write-Host "  Prompt Processing (Input):" -ForegroundColor Cyan
Write-Host "    Average: $([math]::Round($overallStats.OverallAvgPromptTPS, 1)) tokens/sec" -ForegroundColor White
Write-Host "    Range:   $([math]::Round(($allResults | Measure-Object -Property MinPromptTPS -Minimum).Minimum, 1)) - $([math]::Round(($allResults | Measure-Object -Property MaxPromptTPS -Maximum).Maximum, 1)) tokens/sec" -ForegroundColor Gray
Write-Host ""

Write-Host "  Text Generation (Output):" -ForegroundColor Green
Write-Host "    Average: $([math]::Round($overallStats.OverallAvgCompletionTPS, 1)) tokens/sec" -ForegroundColor White
Write-Host "    Range:   $([math]::Round(($allResults | Measure-Object -Property MinCompletionTPS -Minimum).Minimum, 1)) - $([math]::Round(($allResults | Measure-Object -Property MaxCompletionTPS -Maximum).Maximum, 1)) tokens/sec" -ForegroundColor Gray
Write-Host ""

Write-Host "  Combined Throughput:" -ForegroundColor Yellow
Write-Host "    Average: $([math]::Round($overallStats.OverallAvgTotalTPS, 1)) tokens/sec" -ForegroundColor White
Write-Host "    Range:   $([math]::Round(($allResults | Measure-Object -Property MinTotalTPS -Minimum).Minimum, 1)) - $([math]::Round(($allResults | Measure-Object -Property MaxTotalTPS -Maximum).Maximum, 1)) tokens/sec" -ForegroundColor Gray
Write-Host ""

# Per-prompt breakdown
Write-Host "Per-Prompt Breakdown:" -ForegroundColor White
Write-Host ""

foreach ($result in $allResults) {
    Write-Host "  $($result.PromptName):" -ForegroundColor Cyan
    Write-Host "    Prompt Tokens:     $([math]::Round($result.AvgPromptTokens, 0))" -ForegroundColor Gray
    Write-Host "    Completion Tokens: $([math]::Round($result.AvgCompletionTokens, 0))" -ForegroundColor Gray
    Write-Host "    Avg Duration:      $([math]::Round($result.AvgDuration, 2))s" -ForegroundColor Gray
    Write-Host "    Completion TPS:    $([math]::Round($result.AvgCompletionTPS, 1)) tokens/sec" -ForegroundColor Green
    Write-Host ""
}

# Performance rating
Write-Host "Performance Rating:" -ForegroundColor White
Write-Host ""

$completionTPS = $overallStats.OverallAvgCompletionTPS

if ($completionTPS -gt 150) {
    $rating = "Excellent (5/5 stars)"
    $color = "Green"
} elseif ($completionTPS -gt 100) {
    $rating = "Very Good (4/5 stars)"
    $color = "Green"
} elseif ($completionTPS -gt 70) {
    $rating = "Good (3/5 stars)"
    $color = "Cyan"
} elseif ($completionTPS -gt 40) {
    $rating = "Fair (2/5 stars)"
    $color = "Yellow"
} else {
    $rating = "Needs Optimization (1/5 stars)"
    $color = "Red"
}

Write-Host "  $rating" -ForegroundColor $color
Write-Host "  (Based on completion speed: $([math]::Round($completionTPS, 1)) TPS)" -ForegroundColor Gray
Write-Host ""

# Recommendations
Write-Host "Recommendations:" -ForegroundColor White
Write-Host ""

if ($completionTPS -lt 100) {
    Write-Host "  • Consider implementing Phase 1 optimizations:" -ForegroundColor Yellow
    Write-Host "    - Increase batch sizes (-b 2048 -ub 1024)" -ForegroundColor Gray
    Write-Host "    - Expand context window (LLM_CTX=16384)" -ForegroundColor Gray
    Write-Host "    - Enable explicit flash attention" -ForegroundColor Gray
    Write-Host ""
}

if ($completionTPS -lt 150) {
    Write-Host "  • For even better performance, consider:" -ForegroundColor Yellow
    Write-Host "    - Multi-slot serving (--parallel 4)" -ForegroundColor Gray
    Write-Host "    - Speculative decoding with draft model" -ForegroundColor Gray
    Write-Host ""
}

# Save results to file
Write-Host "[4/4] Saving results..." -ForegroundColor Yellow

$overallStats | ConvertTo-Json -Depth 10 | Out-File -FilePath $OutputFile -Encoding UTF8

Write-Host "      ✅ Results saved to: $OutputFile" -ForegroundColor Green
Write-Host ""

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Benchmark Complete" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Return stats object for pipeline use
return $overallStats
