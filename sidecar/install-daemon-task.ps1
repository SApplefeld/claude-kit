# Registers the scheduled task that keeps the judge daemon running on this
# machine. Run once per VM, as the user whose ~/.claude the daemon should
# serve; no elevation is needed because the task runs as that same user on an
# interactive trigger.
#
# The task starts sidecar/daemon-task.ps1 at logon and again every 15 minutes,
# with new starts ignored while one is running: the tick is a no-op while the
# daemon is alive and a resurrection when it is not. On a machine with no
# endpoint config the daemon exits 0 without creating anything, so installing
# the task fleet-wide turns nothing on by itself; the ~/.claude/kit-endpoint.json
# file remains the per-machine switch.
#
# The clone is resolved from the machine signpost ~/.claude/claude-kit.local.json
# (kitRepoPath), falling back to this script's own location, so the same
# command line works on every VM regardless of where the clone sits.
#
# Uninstall: Unregister-ScheduledTask -TaskName 'claude-kit-sidecar-daemon' -Confirm:$false
# (then stop any running daemon and, to disarm capture, delete ~/.claude/kit-sidecar).

$ErrorActionPreference = 'Stop'

$taskName = 'claude-kit-sidecar-daemon'

# Resolve the clone: signpost first, this script's parent as the fallback.
$repoRoot = Split-Path -Parent $PSScriptRoot
$signpost = Join-Path $env:USERPROFILE '.claude\claude-kit.local.json'
if (Test-Path $signpost) {
    try {
        $configured = (Get-Content $signpost -Raw | ConvertFrom-Json).kitRepoPath
        if ($configured -and (Test-Path (Join-Path $configured 'sidecar\daemon.js'))) {
            $repoRoot = $configured
        }
    } catch { }
}

$wrapper = Join-Path $repoRoot 'sidecar\daemon-task.ps1'
if (-not (Test-Path $wrapper)) {
    Write-Error "sidecar\daemon-task.ps1 not found under '$repoRoot'; pull the clone first or fix kitRepoPath in $signpost"
}

# pwsh where it exists, Windows PowerShell everywhere else; the wrapper is
# written to the 5.1 floor so either host runs it.
$shell = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
if (-not $shell) { $shell = (Get-Command powershell -ErrorAction SilentlyContinue).Source }

$action = New-ScheduledTaskAction -Execute $shell `
    -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$wrapper`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$trigger.Repetition = (New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 15)).Repetition

$settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances IgnoreNew `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Description 'claude-kit judge daemon: consumes the tool-call spool and judges it against the machine''s configured model endpoint. Managed by sidecar/install-daemon-task.ps1 in the kit clone.' `
    -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Write-Host "Task '$taskName' registered (clone: $repoRoot) and started."
Write-Host "Log: $(Join-Path $env:USERPROFILE '.claude\kit-sidecar\daemon.log')"
