# The scheduled task's entry point for the judge daemon. The task engine gives
# no output redirection and no log rotation, so this wrapper owns both, and it
# owns the one guard the daemon does not carry itself: a check that no other
# copy of sidecar/daemon.js is already running on this machine, because two
# readers over one spool share one offsets file and would double-consume it.
# A by-hand daemon started from a terminal therefore wins over the task, and
# the task's tick quietly stands down until that process exits.
#
# The daemon log lives beside the state it describes, at
# ~/.claude/kit-sidecar/daemon.log, and rotates by rename to daemon.log.old
# when it passes the size cap. The daemon's own stderr discipline keeps spool
# content out of these lines, so the log is diagnostics, not a copy of the
# sensitive spool.
#
# Written for Windows PowerShell 5.1 as the floor, so the task action can name
# powershell.exe on a VM that has no pwsh.

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$daemonJs = Join-Path $PSScriptRoot 'daemon.js'
$logDir = Join-Path $env:USERPROFILE '.claude\kit-sidecar'
$logFile = Join-Path $logDir 'daemon.log'
$logCapBytes = 5MB

# Stand down if any daemon.js is already running, whatever started it. The
# match is on the command line, not the process name, so an unrelated node
# process never blocks the task.
$running = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'sidecar[\\/]daemon\.js' }
if ($running) { exit 0 }

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { exit 1 }

# The daemon creates the state root itself on a configured machine; the log
# directory is that same root, created here only so an unconfigured machine's
# stand-down line still has somewhere to land.
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force $logDir | Out-Null }

if ((Test-Path $logFile) -and (Get-Item $logFile).Length -gt $logCapBytes) {
    Move-Item -Force $logFile "$logFile.old"
}

Set-Location $repoRoot
& $node $daemonJs *>> $logFile
exit $LASTEXITCODE
