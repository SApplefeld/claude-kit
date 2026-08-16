# The doctor's stop-failure watcher registrar: the scheduled task that runs
# stop-failure-watcher.ps1 on an interval, so a leashed unattended run that
# dies of a retryable API failure is resumed without an operator at the
# console.
#
# Dot-sourced by doctor.ps1, which reports the task's state in check mode and
# calls Install-StopFailureWatcher / Uninstall-StopFailureWatcher behind its
# own consent gates; the repo test suite dot-sources the same file and runs
# the same functions under a throwaway task name. No settings file is touched
# here: the one durable thing this file manages is the Task Scheduler entry.
# This file defines functions only; dot-sourcing it runs nothing and writes
# nothing.
#
# The registration pins MultipleInstances = IgnoreNew and ExecutionTimeLimit =
# PT8H explicitly rather than taking Task Scheduler's defaults, because the
# watcher's parked-child design depends on both: a second pass must not start
# beside a running one, and the task must be allowed to outlive a long wait.
# Both pins are verified by reading the task back after registering, so a host
# whose scheduler ignored either one is a refusal, not a silent divergence.

$script:StopFailureWatcherTaskName = "claude-kit-stop-failure-watcher"

# The task's repetition interval, read out of the watcher script's own
# $TaskIntervalMinutes so the interval has exactly one home. $null when the
# constant cannot be read, which the installer treats as a damaged payload and
# refuses to register against.
function Get-StopFailureWatcherInterval {
    param([Parameter(Mandatory = $true)][string]$WatcherPath)
    try {
        $source = [System.IO.File]::ReadAllText($WatcherPath)
        if ($source -match '\$TaskIntervalMinutes\s*=\s*(\d+)') { return [int]$Matches[1] }
    }
    catch { <# unreadable file: the $null below says so #> }
    return $null
}

# The task's state as the doctor reports it. queried = $false means the
# scheduler could not be asked at all (a locked-down host), which is an
# undetermined result, never a clean one. The enumerate-and-filter shape,
# rather than Get-ScheduledTask -TaskName, is what tells an absent task apart
# from a failed query without parsing a locale-dependent error message.
function Get-StopFailureWatcherStatus {
    param([string]$TaskName = $script:StopFailureWatcherTaskName)
    $found = @()
    try {
        $found = @(Get-ScheduledTask -ErrorAction Stop | Where-Object { $_.TaskName -eq $TaskName })
    }
    catch {
        return @{ queried = $false; present = $false; detail = $_.Exception.Message }
    }
    if ($found.Count -eq 0) { return @{ queried = $true; present = $false } }
    $task = $found[0]
    # The action and the trigger are each read behind their own catch, so a
    # same-named task that carries neither (or carries a kind this reads as
    # absent) reports empty fields rather than throwing out of a function whose
    # contract is to describe whatever it found.
    $interval = ""
    try { $interval = "" + $task.Triggers[0].Repetition.Interval } catch { $interval = "" }
    $execute = ""
    $arguments = ""
    try {
        $execute = "" + $task.Actions[0].Execute
        $arguments = "" + $task.Actions[0].Arguments
    }
    catch { $execute = ""; $arguments = "" }
    return @{
        queried            = $true
        present            = $true
        execute            = $execute
        arguments          = $arguments
        multipleInstances  = "" + $task.Settings.MultipleInstances
        executionTimeLimit = "" + $task.Settings.ExecutionTimeLimit
        repetitionInterval = $interval
    }
}

# Register (or re-register: -Force replaces an existing task, which is how a
# registration is repointed after the plugin payload moves) the watcher task
# for one project directory, then verify the pins by reading the task back.
# Returns @{ ok = $true; notes } or @{ ok = $false; reason } with, on a
# read-back mismatch, the task left in place for inspection.
#
# The action's argument string is built here by quoting two values, which is
# the one place this feature composes a command line: Task Scheduler stores an
# action as a string by design, and both values are machine paths this
# function resolved on disk, never content from the watcher's marker file.
# The task runs as the registering user with the interactive token (no stored
# credential, no elevation), so it fires only while that user is logged on,
# which is the standing state of an unattended-run machine.
function Install-StopFailureWatcher {
    param(
        [Parameter(Mandatory = $true)][string]$WatcherPath,
        [Parameter(Mandatory = $true)][string]$ProjectDir,
        [string]$TaskName = $script:StopFailureWatcherTaskName
    )
    if (-not (Test-Path -LiteralPath $WatcherPath -PathType Leaf)) {
        return @{ ok = $false; reason = "watcher script not found at $WatcherPath" }
    }
    if (-not (Test-Path -LiteralPath $ProjectDir -PathType Container)) {
        return @{ ok = $false; reason = "project directory not found: $ProjectDir" }
    }
    $interval = Get-StopFailureWatcherInterval -WatcherPath $WatcherPath
    if ($null -eq $interval) {
        return @{ ok = $false; reason = "could not read `$TaskIntervalMinutes out of the watcher script, so the payload is damaged; nothing was registered" }
    }
    try {
        $watcherFull = (Resolve-Path -LiteralPath $WatcherPath).Path
        $projectFull = (Resolve-Path -LiteralPath $ProjectDir).Path
        $argString = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $watcherFull + '" -ProjectDir "' + $projectFull + '"'
        $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argString
        # -Once with a repetition interval and no repetition duration repeats
        # indefinitely. [TimeSpan]::MaxValue as an explicit duration is
        # rejected by the scheduler ("incorrectly formatted or out of range"),
        # so the duration is omitted rather than stated.
        $trigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes $interval)
        $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 8)
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
    }
    catch {
        return @{ ok = $false; reason = $_.Exception.Message }
    }
    # Read the registered task back and hold it to the pinned settings; a
    # scheduler that kept the registration but dropped a pin is a failure the
    # caller must hear about, with the task left registered for inspection.
    $status = Get-StopFailureWatcherStatus -TaskName $TaskName
    if (-not $status.queried) {
        return @{ ok = $false; reason = "registered, but the task could not be read back: " + $status.detail }
    }
    if (-not $status.present) {
        return @{ ok = $false; reason = "Register-ScheduledTask reported success but the task did not read back" }
    }
    $expectedInterval = [System.Xml.XmlConvert]::ToString((New-TimeSpan -Minutes $interval))
    $gaps = @()
    if ($status.multipleInstances -ne "IgnoreNew") { $gaps += ("MultipleInstances read back as '" + $status.multipleInstances + "', not IgnoreNew") }
    if ($status.executionTimeLimit -ne "PT8H") { $gaps += ("ExecutionTimeLimit read back as '" + $status.executionTimeLimit + "', not PT8H") }
    if ($status.repetitionInterval -ne $expectedInterval) { $gaps += ("repetition interval read back as '" + $status.repetitionInterval + "', not " + $expectedInterval) }
    if ($gaps.Count -gt 0) {
        return @{ ok = $false; reason = "registered, but the read-back does not carry the pinned settings (" + ($gaps -join "; ") + "); the task is left in place for inspection" }
    }
    return @{
        ok    = $true
        notes = @(
            "Registered scheduled task '$TaskName': runs the watcher every $interval minutes for $projectFull.",
            "Pinned and verified by read-back: MultipleInstances IgnoreNew, ExecutionTimeLimit PT8H.",
            "Runs as the current user while logged on; it launches a resume only for a leashed run whose recorded failure is retryable."
        )
    }
}

# Remove the watcher task. @{ ok = $true; removed } on success (removed =
# $false when there was nothing to remove), @{ ok = $false; reason } when the
# scheduler could not be asked or the task survived the unregister.
function Uninstall-StopFailureWatcher {
    param([string]$TaskName = $script:StopFailureWatcherTaskName)
    $found = @()
    try {
        $found = @(Get-ScheduledTask -ErrorAction Stop | Where-Object { $_.TaskName -eq $TaskName })
    }
    catch {
        return @{ ok = $false; reason = "could not query scheduled tasks: " + $_.Exception.Message }
    }
    if ($found.Count -eq 0) { return @{ ok = $true; removed = $false } }
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
    }
    catch {
        return @{ ok = $false; reason = $_.Exception.Message }
    }
    $left = @()
    try { $left = @(Get-ScheduledTask -ErrorAction Stop | Where-Object { $_.TaskName -eq $TaskName }) } catch { $left = @() }
    if ($left.Count -gt 0) {
        return @{ ok = $false; reason = "the task is still present after Unregister-ScheduledTask" }
    }
    return @{ ok = $true; removed = $true }
}
