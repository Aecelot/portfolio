param(
    [switch]$Detailed,
    [switch]$Benchmark
)

# Hardware Detection and LLM Server Auto-Optimization Script
# Automatically configures LLM Server based on detected hardware

class HardwareProfile {
    [string]$ProfileName
    [string]$GPUType
    [int]$GPUVRAM
    [int]$CPUThreads
    [int]$CPUPhysicalCores
    [long]$TotalRAM
    [int]$RecommendedGPULayers
    [int]$RecommendedContextSize
    [int]$RecommendedThreads
    [string[]]$RecommendedFlags
}

function Get-GPUInfo {
    try {
        $wmiGPU = Get-CimInstance -ClassName Win32_VideoController
        $gpuInfo = $wmiGPU | Where-Object { $null -ne $_.AdapterDACType -or $_.Name -notlike "*Microsoft*" }

        $gpuName = $gpuInfo.Name
        $gpuRAM = if ($gpuInfo.AdapterRAM) { [int]($gpuInfo.AdapterRAM / 1MB) } else { 1024 }

        # Detect GPU type and VRAM
        if ($gpuName -like "*RTX*") {
            if ($gpuName -like "*RTX 4090*") { return @{ Type = "RTX_4090"; VRAM = 24576 } }
            elseif ($gpuName -like "*RTX 4080*") { return @{ Type = "RTX_4080"; VRAM = 16384 } }
            elseif ($gpuName -like "*RTX 4070*") { return @{ Type = "RTX_4070"; VRAM = 12288 } }
            elseif ($gpuName -like "*RTX 4060*") { return @{ Type = "RTX_4060"; VRAM = 8192 } }
            elseif ($gpuName -like "*RTX 3060*") { return @{ Type = "RTX_3060"; VRAM = 12288 } }
            elseif ($gpuName -like "*RTX 3050*") { return @{ Type = "RTX_3050"; VRAM = 8192 } }
            elseif ($gpuName -like "*RTX 20*") { return @{ Type = "RTX_20_Series"; VRAM = $gpuRAM } }
            else { return @{ Type = "RTX_Other"; VRAM = $gpuRAM } }
        }
        elseif ($gpuName -like "*GTX*") {
            if ($gpuName -like "*GTX 16*") { return @{ Type = "GTX_16_Series"; VRAM = $gpuRAM } }
            elseif ($gpuName -like "*GTX 10*") { return @{ Type = "GTX_10_Series"; VRAM = $gpuRAM } }
            else { return @{ Type = "GTX_Other"; VRAM = $gpuRAM } }
        }
        elseif ($gpuName -like "*Intel*") {
            return @{ Type = "Intel_Integrated"; VRAM = [Math]::Min($gpuRAM, 2048) }
        }
        elseif ($gpuName -like "*Radeon*" -and ($gpuName -like "*890M*" -or $gpuName -like "*AMD Radeon*Graphics*")) {
            # AMD Ryzen AI 300 Series iGPU (RDNA 3.5)
            $sharedRAM = if ($gpuInfo.AdapterRAM) { [int]($gpuInfo.AdapterRAM / 1MB) } else {
                # Estimate shared memory based on system RAM
                $totalRAM = (Get-CimInstance -ClassName Win32_ComputerSystem).TotalPhysicalMemory / 1MB
                [Math]::Min([int]($totalRAM * 0.5), 16384)  # Up to 16GB shared
            }
            return @{ Type = "AMD_Ryzen_AI_iGPU"; VRAM = $sharedRAM }
        }
        elseif ($gpuName -like "*Radeon*" -and $gpuName -like "*Graphics*") {
            # Generic AMD iGPU fallback
            return @{ Type = "AMD_iGPU"; VRAM = [Math]::Min($gpuRAM, 8192) }
        }
        else {
            return @{ Type = "Unknown_GPU"; VRAM = $gpuRAM }
        }
    }
    catch {
        return @{ Type = "Detection_Failed"; VRAM = 1024 }
    }
}

function Get-CPUInfo {
    $wmiCPU = Get-CimInstance -ClassName Win32_Processor
    $cpuCores = $wmiCPU.NumberOfCores
    $cpuThreads = $wmiCPU.NumberOfLogicalProcessors

    return @{
        PhysicalCores = $cpuCores
        LogicalProcessors = $cpuThreads
        RecommendedThreads = [Math]::Min($cpuThreads, 16)  # Cap at 16 for most workloads
    }
}

function Get-RAMInfo {
    $totalRAM = (Get-CimInstance -ClassName Win32_ComputerSystem).TotalPhysicalMemory
    return [long]($totalRAM / 1MB)  # Return in MB
}

function Get-NPUInfo {
    try {
        # Try multiple methods to detect NPU
        $npuDevices = @()

        # Method 1: PnP entities with Neural/NPU keywords
        $pnpNPU = Get-CimInstance -ClassName Win32_PnPEntity |
            Where-Object { $_.Name -like "*Neural*" -or $_.Name -like "*NPU*" -or $_.Name -like "*XDNA*" -or $_.Name -like "*AI*" }

        if ($pnpNPU) {
            $npuDevices += $pnpNPU
        }

        # Method 2: Check for Ryzen AI in processor name
        $processor = Get-CimInstance -ClassName Win32_Processor
        if ($processor.Name -like "*Ryzen AI*") {
            return @{
                Detected = $true
                Type = "Ryzen_AI_NPU"
                TOPS = 50  # Ryzen AI 300 Series has 50 TOPS
                Status = "Integrated"
                Method = "Processor_Name"
            }
        }

        # Method 3: Check Windows ML workload
        try {
            $mlInfo = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-ML-Workload
            if ($mlInfo.State -eq "Enabled") {
                return @{
                    Detected = $true
                    Type = "Windows_ML_NPU"
                    TOPS = 50
                    Status = "Windows_ML_Enabled"
                    Method = "Windows_Feature"
                }
            }
        }
        catch {
            # Windows ML feature check failed, continue
        }

        if ($npuDevices.Count -gt 0) {
            return @{
                Detected = $true
                Type = "Generic_NPU"
                TOPS = 50
                Status = ($npuDevices[0]).Status
                Method = "PnP_Entity"
                Devices = $npuDevices.Count
            }
        }

        return @{
            Detected = $false
            Type = "None"
            TOPS = 0
            Status = "Not_Detected"
            Method = "None"
        }
    }
    catch {
        return @{
            Detected = $false
            Type = "Detection_Error"
            TOPS = 0
            Status = "Error"
            Method = "Exception"
            Error = $_.Exception.Message
        }
    }
}

function Get-DeviceProfiles {
    $profiles = @{}

    # High-End Gaming/Desktop (RTX 4090/4080, 32GB+ RAM, 12+ cores)
    $profiles["RTX_4090"] = [HardwareProfile]@{
        ProfileName = "High-End_Gaming"
        GPUType = "RTX_4090"
        GPUVRAM = 24576
        RecommendedGPULayers = 50
        RecommendedContextSize = 8192
        RecommendedThreads = 16
        RecommendedFlags = @("--usemmapped", "--usemlock", "--no-kv-offload", "--flash-attention")
    }

    $profiles["RTX_4080"] = [HardwareProfile]@{
        ProfileName = "High-End_Gaming"
        GPUType = "RTX_4080"
        GPUVRAM = 16384
        RecommendedGPULayers = 45
        RecommendedContextSize = 8192
        RecommendedThreads = 16
        RecommendedFlags = @("--usemmapped", "--usemlock", "--no-kv-offload", "--flash-attention")
    }

    # Mid-Range Gaming (RTX 4070/4060/3060, 16-32GB RAM, 8-12 cores)
    $profiles["RTX_4070"] = [HardwareProfile]@{
        ProfileName = "Mid-Range_Gaming"
        GPUType = "RTX_4070"
        GPUVRAM = 12288
        RecommendedGPULayers = 35
        RecommendedContextSize = 4096
        RecommendedThreads = 12
        RecommendedFlags = @("--usemmapped", "--usemlock", "--no-kv-offload", "--flash-attention")
    }

    $profiles["RTX_4060"] = [HardwareProfile]@{
        ProfileName = "Mid-Range_Gaming"
        GPUType = "RTX_4060"
        GPUVRAM = 8192
        RecommendedGPULayers = 30
        RecommendedContextSize = 4096
        RecommendedThreads = 10
        RecommendedFlags = @("--usemmapped", "--usemlock", "--no-kv-offload", "--flash-attention")
    }

    $profiles["RTX_3060"] = [HardwareProfile]@{
        ProfileName = "Mid-Range_Gaming"
        GPUType = "RTX_3060"
        GPUVRAM = 12288
        RecommendedGPULayers = 30
        RecommendedContextSize = 4096
        RecommendedThreads = 12
        RecommendedFlags = @("--usemmapped", "--usemlock", "--no-kv-offload", "--flash-attention")
    }

    $profiles["RTX_3050"] = [HardwareProfile]@{
        ProfileName = "Mid-Range_Gaming"
        GPUType = "RTX_3050"
        GPUVRAM = 8192
        RecommendedGPULayers = 25
        RecommendedContextSize = 4096
        RecommendedThreads = 8
        RecommendedFlags = @("--usemmapped", "--usemlock", "--no-kv-offload")
    }

    # Entry-Level Gaming (GTX series, 8-16GB RAM, 4-8 cores)
    $profiles["GTX_16_Series"] = [HardwareProfile]@{
        ProfileName = "Entry_Gaming"
        GPUType = "GTX_16_Series"
        GPUVRAM = 6144
        RecommendedGPULayers = 20
        RecommendedContextSize = 2048
        RecommendedThreads = 8
        RecommendedFlags = @("--usemmapped", "--usemlock")
    }

    $profiles["GTX_10_Series"] = [HardwareProfile]@{
        ProfileName = "Entry_Gaming"
        GPUType = "GTX_10_Series"
        GPUVRAM = 4096
        RecommendedGPULayers = 15
        RecommendedContextSize = 2048
        RecommendedThreads = 6
        RecommendedFlags = @("--usemmapped", "--usemlock")
    }

    # Integrated Graphics (Intel iGPU, 8-16GB RAM, 4-8 cores)
    $profiles["Intel_Integrated"] = [HardwareProfile]@{
        ProfileName = "Integrated_Graphics"
        GPUType = "Intel_Integrated"
        GPUVRAM = 1024
        RecommendedGPULayers = 0
        RecommendedContextSize = 2048
        RecommendedThreads = 4
        RecommendedFlags = @("--usemmapped", "--usemlock")
    }

    # AMD Ryzen AI 300 Series iGPU (RDNA 3.5)
    $profiles["AMD_Ryzen_AI_iGPU"] = [HardwareProfile]@{
        ProfileName = "AMD_Ryzen_AI_300_iGPU"
        GPUType = "AMD_Ryzen_AI_iGPU"
        GPUVRAM = 16384  # Use up to 16GB shared memory for Ryzen AI 300
        RecommendedGPULayers = 45  # Aggressive but safe for RDNA 3.5
        RecommendedContextSize = 8192  # Utilize full context window
        RecommendedThreads = 12  # Use Zen 5 cores effectively
        RecommendedFlags = @("--useclblast", "0", "0", "--usemlock")  # OpenCL + memory optimizations for AMD iGPU
    }

    # Generic AMD iGPU fallback
    $profiles["AMD_iGPU"] = [HardwareProfile]@{
        ProfileName = "AMD_iGPU_Generic"
        GPUType = "AMD_iGPU"
        GPUVRAM = 4096
        RecommendedGPULayers = 25
        RecommendedContextSize = 2048
        RecommendedThreads = 8
        RecommendedFlags = @("--useclblast", "0", "0")
    }

    # Ryzen AI NPU Profile (for ONNX/DirectML workloads)
    $profiles["Ryzen_AI_NPU"] = [HardwareProfile]@{
        ProfileName = "AMD_Ryzen_AI_NPU"
        GPUType = "Ryzen_AI_NPU"
        GPUVRAM = 0  # NPU uses system memory
        RecommendedGPULayers = 0  # NPU via ONNX/DirectML
        RecommendedContextSize = 4096
        RecommendedThreads = 8  # Moderate CPU threads for NPU coordination
        RecommendedFlags = @("--onnx", "--directml")  # NPU-specific flags
    }

    # Fallback for unknown hardware
    $profiles["Unknown_GPU"] = [HardwareProfile]@{
        ProfileName = "Conservative"
        GPUType = "Unknown_GPU"
        GPUVRAM = 2048
        RecommendedGPULayers = 10
        RecommendedContextSize = 2048
        RecommendedThreads = 4
        RecommendedFlags = @("--usemmapped", "--usemlock")
    }

    return $profiles
}

function Get-OptimizedConfig {
    param(
        [string]$GPUType,
        [int]$GPUVRAM,
        [int]$CPUThreads,
        [int]$TotalRAM
    )

    $profiles = Get-DeviceProfiles
    $hardwareProfile = $profiles[$GPUType]

    if (-not $hardwareProfile) {
        $hardwareProfile = $profiles["Unknown_GPU"]
    }

    # Adjust based on actual RAM
    if ($TotalRAM -lt 8192) {  # Less than 8GB RAM
        $hardwareProfile.RecommendedGPULayers = [Math]::Min($hardwareProfile.RecommendedGPULayers, 15)
        $hardwareProfile.RecommendedContextSize = [Math]::Min($hardwareProfile.RecommendedContextSize, 2048)
        $hardwareProfile.RecommendedThreads = [Math]::Min($hardwareProfile.RecommendedThreads, 4)
    }
    elseif ($TotalRAM -lt 16384) {  # Less than 16GB RAM
        $hardwareProfile.RecommendedGPULayers = [Math]::Min($hardwareProfile.RecommendedGPULayers, 25)
        $hardwareProfile.RecommendedContextSize = [Math]::Min($hardwareProfile.RecommendedContextSize, 4096)
        $hardwareProfile.RecommendedThreads = [Math]::Min($hardwareProfile.RecommendedThreads, 8)
    }

    # Adjust GPU layers based on actual VRAM (with special handling for Ryzen AI)
    if ($GPUType -eq "AMD_Ryzen_AI_iGPU") {
        # Ryzen AI 300 uses shared memory - use aggressive settings
        $hardwareProfile.RecommendedGPULayers = [Math]::Min($hardwareProfile.RecommendedGPULayers, 45)
    }
    elseif ($GPUVRAM -lt 4096) {  # Less than 4GB VRAM
        $hardwareProfile.RecommendedGPULayers = [Math]::Min($hardwareProfile.RecommendedGPULayers, 10)
    }
    elseif ($GPUVRAM -lt 8192) {  # Less than 8GB VRAM
        $hardwareProfile.RecommendedGPULayers = [Math]::Min($hardwareProfile.RecommendedGPULayers, 20)
    }

    return $hardwareProfile
}

# Main execution
Write-Host " Detecting Hardware Configuration..." -ForegroundColor Cyan

$gpuInfo = Get-GPUInfo
$cpuInfo = Get-CPUInfo
$ramInfo = Get-RAMInfo
$npuInfo = Get-NPUInfo

Write-Host " Hardware Detected:" -ForegroundColor Green
Write-Host "  GPU: $($gpuInfo.Type) (${gpuInfo.VRAM}MB VRAM)"
Write-Host "  CPU: $($cpuInfo.PhysicalCores) physical cores, $($cpuInfo.LogicalProcessors) logical processors"
Write-Host "  RAM: $([Math]::Round($ramInfo/1024, 1))GB"
if ($npuInfo.Detected) {
    Write-Host "  NPU: $($npuInfo.Type) (${npuInfo.TOPS} TOPS) - $($npuInfo.Status)" -ForegroundColor Green
} else {
    Write-Host "  NPU: Not Detected" -ForegroundColor Yellow
}

$optimizedConfig = Get-OptimizedConfig -GPUType $gpuInfo.Type -GPUVRAM $gpuInfo.VRAM -CPUThreads $cpuInfo.LogicalProcessors -TotalRAM $ramInfo

Write-Host "`n Recommended LLM Server Configuration:" -ForegroundColor Green
Write-Host "  Profile: $($optimizedConfig.ProfileName)"
Write-Host "  GPU Layers: $($optimizedConfig.RecommendedGPULayers)"
Write-Host "  Context Size: $($optimizedConfig.RecommendedContextSize)"
Write-Host "  Threads: $($optimizedConfig.RecommendedThreads)"
Write-Host "  Flags: $($optimizedConfig.RecommendedFlags -join ', ')"

if ($Detailed) {
    Write-Host "`n Detailed Hardware Information:" -ForegroundColor Yellow
    Get-CimInstance -ClassName Win32_VideoController | Format-Table Name, AdapterRAM, DriverVersion
    Get-CimInstance -ClassName Win32_Processor | Format-Table Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed
    Get-CimInstance -ClassName Win32_ComputerSystem | Format-Table TotalPhysicalMemory, SystemType
}

if ($Benchmark) {
    Write-Host "`n Running Performance Benchmark..." -ForegroundColor Cyan
    # This would run a quick performance test
}

# Runtime memory check - get currently available memory
$os = Get-CimInstance -ClassName Win32_OperatingSystem
$availableRAM = [int]($os.FreePhysicalMemory / 1024)  # Convert KB to MB
$memoryPressure = $false

Write-Host "`n Runtime Memory Check:" -ForegroundColor Yellow
Write-Host "  Available RAM: $([Math]::Round($availableRAM/1024, 1))GB / $([Math]::Round($ramInfo/1024, 1))GB total"

# Check if we're under memory pressure (less than 4GB available)
if ($availableRAM -lt 4096) {
    $memoryPressure = $true
    Write-Host "  [WARN] Low memory detected - reducing parallel slots" -ForegroundColor Yellow
}

# Determine multi-slot settings based on VRAM/memory
# More VRAM = more parallel slots (each slot needs its own KV cache)
$parallelSlots = 1
$batchSize = 512
$ubatchSize = 256
$contBatching = "0"

if ($gpuInfo.VRAM -ge 16384 -and -not $memoryPressure) {
    # High-end: 16GB+ VRAM - 4 slots
    $parallelSlots = 4
    $batchSize = 2048
    $ubatchSize = 1024
    $contBatching = "1"
} elseif (($gpuInfo.VRAM -ge 8192 -or $gpuInfo.Type -eq "AMD_Ryzen_AI_iGPU") -and -not $memoryPressure) {
    # Mid-range or Ryzen AI with shared memory: 8GB+ - 2 slots
    $parallelSlots = 2
    $batchSize = 1024
    $ubatchSize = 512
    $contBatching = "1"
} elseif ($gpuInfo.VRAM -ge 4096) {
    # Entry-level: 4-8GB - 1 slot with batching
    # Also used when under memory pressure
    $parallelSlots = 1
    $batchSize = 512
    $ubatchSize = 256
    $contBatching = "1"
}
# else: default 1 slot, no continuous batching for CPU-only

# Further reduce if severely memory constrained (< 2GB available)
if ($availableRAM -lt 2048) {
    Write-Host "  [WARN] Severe memory pressure - reducing batch sizes" -ForegroundColor Red
    $batchSize = [Math]::Min($batchSize, 256)
    $ubatchSize = [Math]::Min($ubatchSize, 128)
    $parallelSlots = 1
}

Write-Host "  Multi-Slot: $parallelSlots slots (continuous batching: $(if ($contBatching -eq '1') { 'enabled' } else { 'disabled' }))"

# Save configuration for use by start script
$config = @{
    LLM_HOST = "127.0.0.1"
    LLM_PORT = "5001"
    LLM_MODEL_PATH = "models\Llama-3.2-1B-Instruct-Q4_K_M.gguf"
    LLM_THREADS = $optimizedConfig.RecommendedThreads.ToString()
    LLM_CTX = $optimizedConfig.RecommendedContextSize.ToString()
    LLM_GPULAYERS = $optimizedConfig.RecommendedGPULayers.ToString()
    LLM_USEMMAP = "1"
    LLM_USEMLock = "1"
    LLM_FLASH_ATTENTION = if ($optimizedConfig.RecommendedFlags -contains "--flash-attention") { "1" } else { "0" }
    LLM_NO_KV_OFFLOAD = if ($optimizedConfig.RecommendedFlags -contains "--no-kv-offload") { "1" } else { "0" }
    # Multi-slot inference settings
    LLM_PARALLEL_SLOTS = $parallelSlots.ToString()
    LLM_CONT_BATCHING = $contBatching
    LLM_BATCH_SIZE = $batchSize.ToString()
    LLM_UBATCH_SIZE = $ubatchSize.ToString()
}

# Add AMD GPU acceleration flags if using CLBlast
if ($optimizedConfig.RecommendedFlags -contains "--useclblast") {
    $config["LLM_USECLBLAST"] = "1"
    # Extract platform and device from flags (they should be "0" and "0")
    $clblastIndex = [array]::IndexOf($optimizedConfig.RecommendedFlags, "--useclblast")
    if ($clblastIndex -ge 0 -and $clblastIndex + 2 -lt $optimizedConfig.RecommendedFlags.Count) {
        $config["LLM_CLBLAST_PLATFORM"] = $optimizedConfig.RecommendedFlags[$clblastIndex + 1]
        $config["LLM_CLBLAST_DEVICE"] = $optimizedConfig.RecommendedFlags[$clblastIndex + 2]
    }
}

# Save to auto-detected config file (remove old file first to avoid duplication)
$configPath = "config\env.auto"
if (Test-Path $configPath) {
    Remove-Item $configPath -Force
}
$config.GetEnumerator() | ForEach-Object {
    "$($_.Key)=$($_.Value)" | Out-File -FilePath $configPath -Encoding UTF8 -Append
}

Write-Host "`n Auto-detected configuration saved to: $configPath" -ForegroundColor Green

return $config