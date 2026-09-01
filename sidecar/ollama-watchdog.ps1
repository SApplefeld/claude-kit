# Ollama generation watchdog. Runs ON the endpoint host (not a VM), probes the
# generation lane with a tiny request, and restarts the Ollama service when the
# lane is wedged while the HTTP layer still answers. Two wedge shapes motivate
# it, both observed on this host: a runtime that returns HTTP 200 with empty
# responses, and a scheduler that returns no response headers at all while
# /api/ps shows the model resident. Both read as "generation dead, transport
# healthy", which is exactly the signature this script keys on.
#
# Restart discipline: a restart fires only after two CONSECUTIVE failed probe
# cycles. A genuinely busy serial lane can starve one probe behind a long
# generation, but something completes across two whole cycles on a healthy
# runner; total silence across both is the wedge. A probe that fails because
# the HTTP layer itself is down counts the same way, since a dead service
# deserves the same restart.
#
# Install (elevated, on the host), probing every 5 minutes:
#   Register-ScheduledTask -TaskName "OllamaWatchdog" `
#     -Action (New-ScheduledTaskAction -Execute "powershell.exe" `
#       -Argument "-NoProfile -ExecutionPolicy Bypass -File C:\Tools\ollama-watchdog.ps1") `
#     -Trigger (New-ScheduledTaskTrigger -Once -At (Get-Date) `
#       -RepetitionInterval (New-TimeSpan -Minutes 5)) `
#     -User "SYSTEM" -RunLevel Highest
#
# Tunables are the params below; the strike state and log live beside neither
# the script nor the service, in %ProgramData%, so reinstalling either loses
# nothing. If your Ollama runs as a user process rather than a service, replace
# Restart-Service with a Stop-Process/Start-Process pair for your setup.

param(
    [string]$BaseUrl = 'http://localhost:11434',
    [string]$Model = 'qwen3.8:27b',
    [string]$ServiceName = 'Ollama',
    [int]$ProbeTimeoutSec = 60,
    [int]$StrikesToRestart = 2,
    [string]$StateDir = (Join-Path $env:ProgramData 'OllamaWatchdog')
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $StateDir)) { New-Item -ItemType Directory -Force $StateDir | Out-Null }
$strikeFile = Join-Path $StateDir 'strikes.txt'
$logFile = Join-Path $StateDir 'watchdog.log'

function Write-Log([string]$line) {
    $stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    Add-Content -Path $logFile -Value "$stamp $line"
    # Keep the log bounded: past ~2000 lines, keep the newest 1000.
    $lines = @(Get-Content $logFile)
    if ($lines.Count -gt 2000) { $lines[-1000..-1] | Set-Content $logFile }
}

function Get-Strikes {
    if (Test-Path $strikeFile) { [int](Get-Content $strikeFile -TotalCount 1) } else { 0 }
}

function Set-Strikes([int]$n) { Set-Content -Path $strikeFile -Value $n }

# The probe: smallest possible generation, thinking off, deterministic.
$probeBody = @{
    model = $Model; prompt = 'Reply with the single word ok.'
    stream = $false; think = $false
    options = @{ num_predict = 4; temperature = 0 }
} | ConvertTo-Json -Compress

$probeOk = $false
$reason = ''
try {
    $resp = Invoke-RestMethod -Uri "$BaseUrl/api/generate" -Method Post `
        -ContentType 'application/json' -Body $probeBody -TimeoutSec $ProbeTimeoutSec
    if ($null -ne $resp.response -and $resp.response.Trim().Length -gt 0) {
        $probeOk = $true
    } else {
        $reason = 'empty response (the 200-empty wedge shape)'
    }
} catch {
    $reason = "no usable answer within ${ProbeTimeoutSec}s ($($_.Exception.Message))"
}

if ($probeOk) {
    if ((Get-Strikes) -gt 0) { Write-Log 'probe OK, strikes reset' }
    Set-Strikes 0
    exit 0
}

$strikes = (Get-Strikes) + 1
Set-Strikes $strikes
Write-Log "probe FAILED (strike $strikes of $StrikesToRestart): $reason"

if ($strikes -ge $StrikesToRestart) {
    Write-Log "restarting service '$ServiceName'"
    try {
        Restart-Service -Name $ServiceName -Force -ErrorAction Stop
        Set-Strikes 0
        Write-Log 'restart issued, strikes reset'
    } catch {
        Write-Log "restart FAILED: $($_.Exception.Message)"
    }
}
