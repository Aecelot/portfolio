# Swap Model CLI - Quick model swap via command line
# Usage: .\scripts\swap-model.ps1 <model-name-or-path>
# Usage: .\scripts\swap-model.ps1 -List

param(
    [Parameter(Position=0)]
    [string]$Model,
    [switch]$List,
    [switch]$Status,
    [int]$AdminPort = 8081
)

$ErrorActionPreference = "Stop"
$AdminUrl = "http://127.0.0.1:$AdminPort"

function Test-ManagerRunning {
    try {
        $null = Invoke-RestMethod -Uri "$AdminUrl/status" -Method GET -TimeoutSec 2
        return $true
    } catch {
        return $false
    }
}

function Get-Status {
    try {
        $status = Invoke-RestMethod -Uri "$AdminUrl/status" -Method GET
        Write-Host ""
        Write-Host "Model Manager Status" -ForegroundColor Cyan
        Write-Host "--------------------"
        Write-Host "  Status:   $($status.status)" -ForegroundColor $(if ($status.status -eq 'running') { 'Green' } else { 'Red' })
        Write-Host "  Model:    $($status.modelName)" -ForegroundColor White
        Write-Host "  Swapping: $($status.isSwapping)" -ForegroundColor Gray
        Write-Host "  PID:      $($status.pid)" -ForegroundColor Gray
        Write-Host "  API Port: $($status.port)" -ForegroundColor Gray
        Write-Host ""
    } catch {
        Write-Host "[ERROR] Cannot connect to model manager at $AdminUrl" -ForegroundColor Red
        Write-Host "        Is the model manager running? Start it with:" -ForegroundColor Yellow
        Write-Host "        .\scripts\model-manager.ps1" -ForegroundColor White
    }
}

function Get-Models {
    try {
        $result = Invoke-RestMethod -Uri "$AdminUrl/models" -Method GET
        Write-Host ""
        Write-Host "Available Models" -ForegroundColor Cyan
        Write-Host "----------------"
        foreach ($model in $result.models) {
            $current = if ($model.name -eq $result.currentModel -or "$($model.name).gguf" -eq $result.currentModel) { " <-- current" } else { "" }
            $color = if ($current) { "Green" } else { "White" }
            Write-Host "  $($model.name) ($($model.sizeGB) GB)$current" -ForegroundColor $color
        }
        Write-Host ""
        Write-Host "Usage: .\scripts\swap-model.ps1 <model-name>" -ForegroundColor Gray
        Write-Host ""
    } catch {
        Write-Host "[ERROR] Cannot connect to model manager at $AdminUrl" -ForegroundColor Red
        Write-Host "        Is the model manager running?" -ForegroundColor Yellow
    }
}

function Invoke-Swap {
    param([string]$ModelPath)

    # Find model by name if not a path
    if (-not ($ModelPath -like "*.gguf") -and -not ($ModelPath -like "*\*") -and -not ($ModelPath -like "*/*")) {
        # Try to find model by name
        try {
            $result = Invoke-RestMethod -Uri "$AdminUrl/models" -Method GET
            $found = $result.models | Where-Object { $_.name -like "*$ModelPath*" } | Select-Object -First 1

            if ($found) {
                $ModelPath = $found.relativePath
                Write-Host "[Info] Found model: $($found.name)" -ForegroundColor Gray
            } else {
                Write-Host "[ERROR] Model not found: $ModelPath" -ForegroundColor Red
                Write-Host "        Use -List to see available models" -ForegroundColor Yellow
                return
            }
        } catch {
            Write-Host "[ERROR] Cannot connect to model manager" -ForegroundColor Red
            return
        }
    }

    Write-Host ""
    Write-Host "Swapping model to: $ModelPath" -ForegroundColor Cyan
    Write-Host "Please wait..." -ForegroundColor Yellow
    Write-Host ""

    try {
        $body = @{ model = $ModelPath } | ConvertTo-Json
        $result = Invoke-RestMethod -Uri "$AdminUrl/swap-model" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 120

        if ($result.success) {
            Write-Host "[SUCCESS] Model swapped in $($result.durationSeconds)s" -ForegroundColor Green
            Write-Host "          Old: $(Split-Path $result.oldModel -Leaf)" -ForegroundColor Gray
            Write-Host "          New: $(Split-Path $result.newModel -Leaf)" -ForegroundColor White
        } else {
            Write-Host "[ERROR] Swap failed: $($result.error)" -ForegroundColor Red
        }
    } catch {
        Write-Host "[ERROR] Swap failed: $_" -ForegroundColor Red
    }
    Write-Host ""
}

# Main
if (-not (Test-ManagerRunning)) {
    Write-Host ""
    Write-Host "[ERROR] Model manager is not running" -ForegroundColor Red
    Write-Host ""
    Write-Host "Start the model manager first:" -ForegroundColor Yellow
    Write-Host "  .\scripts\model-manager.ps1" -ForegroundColor White
    Write-Host ""
    exit 1
}

if ($List) {
    Get-Models
} elseif ($Status) {
    Get-Status
} elseif ($Model) {
    Invoke-Swap -ModelPath $Model
} else {
    # No args - show status and models
    Get-Status
    Get-Models
}
