# The scheduled task's entry point for the judge daemon. The task engine gives
# no output redirection and no log rotation, so this wrapper owns both, and it
# owns the one guard the daemon does not carry itself: a check that no other
# copy of sidecar/daemon.js is already running on this machine, because two
# readers over one spool share one offsets file and would double-consume it.
# A by-hand daemon started from a terminal therefore wins over the task, and
# the task's tick stands down until that process exits.
#
# TWO LOGS, BOTH BESIDE THE STATE THEY DESCRIBE, AND THEY ARE TWO BECAUSE OF A
# LOCK. `~/.claude/kit-sidecar/daemon.log` is the daemon's own stream: this
# wrapper opens it with the redirection at the foot of this file and holds it
# open for the whole life of the daemon it started, which is by design and is
# also what makes it unwritable by anyone else. Windows admits no second writer
# to it, so a later tick of this task cannot append a word to it while a daemon
# runs, which is precisely when a later tick has something to say.
# `~/.claude/kit-sidecar/daemon-task.log` is therefore this wrapper's own,
# holding the lines it writes about its own decisions, appendable at any tick
# because nothing holds it between them.
#
# The two rotate on different schedules, and only one of them is bounded. The
# task log is checked against the cap on every tick that writes to it, so it
# rotates to `daemon-task.log.old` within a line of the cap. The daemon log is
# checked once, on the start path, immediately before this wrapper opens it: a
# tick that stands down never reaches that check, and renaming a file another
# wrapper is holding open would fail anyway. So `daemon.log` grows unbounded for
# as long as one daemon lives and is rotated by the tick that starts the next
# one, which on a daemon left running for weeks is weeks of growth.
#
# Every line in either opens with the UTC instant it was written, ISO 8601,
# then `kit-sidecar:` for a line the daemon wrote or `kit-sidecar task:` for one
# this wrapper wrote. The daemon's own stderr discipline keeps spool content out
# of its lines, so neither log is a copy of the sensitive spool, and this
# wrapper holds itself to the same rule: pids, an instant and an age, never a
# byte of the heartbeat file repeated back.
#
# The stand-down says what it saw. A daemon that is present and wedged and one
# that is healthy look identical to this wrapper, which sees only that a
# process exists, so it writes down the pids it found and what the daemon's own
# liveness stamp says about them. Without that line a tick that found a daemon
# running and a tick that started one and lost it look the same on every
# surface: nothing at all. Standing down is not a failure, so a line that could
# not be written is dropped rather than raised, and the tick still exits 0. This
# wrapper never kills what it found; whether a non-progressing daemon should
# ever be killed is the operator's call, and this line is what makes that call
# possible.
#
# Written for Windows PowerShell 5.1 as the floor, so the task action can name
# powershell.exe on a VM that has no pwsh, and exercised on both hosts because
# the installed task prefers pwsh where it exists. The two disagree about the
# heartbeat file's contents, which Get-HeartbeatClause below is written around.

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$daemonJs = Join-Path $PSScriptRoot 'daemon.js'
$logDir = Join-Path $env:USERPROFILE '.claude\kit-sidecar'
$logFile = Join-Path $logDir 'daemon.log'
$taskLogFile = Join-Path $logDir 'daemon-task.log'
$logCapBytes = 5MB
$heartbeatFile = Join-Path $logDir 'logs\heartbeat.json'
# Nothing the daemon writes there reaches seventy bytes. The bound is on a file
# any process running as this user can rewrite, and this wrapper runs under a
# scheduled task with no execution time limit, so an enormous file planted at
# that name would otherwise be read whole into a tick that never ends.
$heartbeatMaxBytes = 4096
$invariant = [System.Globalization.CultureInfo]::InvariantCulture

# The daemon creates the state root itself on a configured machine; the log
# directory is that same root, created here only so an unconfigured machine's
# stand-down line still has somewhere to land.
if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Force $logDir | Out-Null }

# One line into this wrapper's own log, timestamped, rotated and encoded.
#
# Every failure is swallowed. This function exists to make a stand-down visible,
# and a tick that failed to say something is a smaller loss than a scheduled
# task that reports a failure for a run in which nothing went wrong. The cap
# check runs immediately before the append so a line lands in the live
# generation rather than in the one about to be renamed away.
#
# UTF-8 with no byte-order mark, named rather than defaulted, so this file reads
# as the daemon's does: Out-File and `Add-Content -Encoding utf8` under Windows
# PowerShell 5.1 would write UTF-16 or plant a mark mid-file, and one log
# carrying two encodings is unreadable from either end.
function Write-TaskLine {
    param([string] $Text)

    try {
        $stamp = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ', $invariant)
        if ((Test-Path -LiteralPath $taskLogFile) -and (Get-Item -LiteralPath $taskLogFile).Length -gt $logCapBytes) {
            Move-Item -Force -LiteralPath $taskLogFile -Destination "$taskLogFile.old"
        }
        [System.IO.File]::AppendAllText($taskLogFile,
            "$stamp kit-sidecar task: $Text" + [Environment]::NewLine,
            (New-Object System.Text.UTF8Encoding($false)))
    } catch { }
}

# What the daemon's liveness stamp says about the daemon this tick found, as a
# clause for the stand-down line, or a named reason it says nothing usable.
#
# THE FILE IS DATA. It sits under the user's own home directory and anything
# running as that user can write it, so nothing read out of it is repeated into
# the log: the instant is re-formatted from a parsed value, the age is computed
# from that value, the pid is compared numerically, and every path that cannot
# get that far returns one of a fixed set of reasons carrying no file content.
# The reasons name the shape that stopped the read, so a reader can tell a stamp
# nobody wrote from one somebody broke.
#
# THE TWO HOSTS DISAGREE ABOUT `ts`, which is why the type is branched on rather
# than assumed. Windows PowerShell 5.1 leaves it the string the file holds;
# pwsh 7's ConvertFrom-Json recognizes an ISO instant and hands back a
# [DateTime] already in UTC. Spelling that object back into a string, as an
# obvious reading of "parse the ts field" would, drops the zone and formats to
# the current culture, and parsing THAT assumes local time: on a machine four
# hours off UTC the stand-down line then reports an instant four hours wrong and
# an age that can be negative. So each type is read in its own terms, and a
# value carrying no zone at all is refused rather than assumed to be local,
# which is the same rule the daemon applies to a spool line's own timestamp.
function Get-HeartbeatClause {
    param([string] $File, [long[]] $RunningPids)

    $item = $null
    try { $item = Get-Item -LiteralPath $File -Force -ErrorAction Stop } catch { return 'heartbeat unreadable (no file)' }
    # Attributes before content, and never Test-Path, which follows a reparse
    # point and answers about the target. A junction or symlink planted at this
    # name would otherwise have the tick read whatever it points at.
    if ($item.PSIsContainer) { return 'heartbeat unreadable (not a file)' }
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { return 'heartbeat unreadable (link)' }
    if ($item.Length -gt $heartbeatMaxBytes) { return 'heartbeat unreadable (oversized)' }

    $raw = $null
    try { $raw = Get-Content -LiteralPath $File -Raw -ErrorAction Stop } catch { return 'heartbeat unreadable (read failed)' }
    $parsed = $null
    try { $parsed = $raw | ConvertFrom-Json -ErrorAction Stop } catch { return 'heartbeat unreadable (not JSON)' }
    if ($null -eq $parsed -or -not $parsed.PSObject.Properties.Match('ts').Count) {
        return 'heartbeat unreadable (no ts field)'
    }
    if (-not $parsed.PSObject.Properties.Match('pid').Count) {
        return 'heartbeat unreadable (no pid field)'
    }

    $tsValue = $parsed.ts
    $utcInstant = [DateTime]::MinValue
    if ($tsValue -is [DateTime]) {
        if ($tsValue.Kind -eq [DateTimeKind]::Unspecified) { return 'heartbeat unreadable (ts carries no zone)' }
        $utcInstant = $tsValue.ToUniversalTime()
    } elseif ($tsValue -is [DateTimeOffset]) {
        $utcInstant = $tsValue.UtcDateTime
    } elseif ($tsValue -is [string]) {
        # The zone is required rather than assumed, on the daemon's own rule: a
        # zone-less instant parses fine and lands wrong by the machine's offset,
        # which is how a stamp minutes old reads as hours stale.
        if ($tsValue.Trim() -notmatch '(?:Z|z|[+-]\d{2}:?\d{2})$') { return 'heartbeat unreadable (ts carries no zone)' }
        $offsetValue = [DateTimeOffset]::MinValue
        $ok = [DateTimeOffset]::TryParse($tsValue, $invariant,
            [System.Globalization.DateTimeStyles]::RoundtripKind, [ref] $offsetValue)
        if (-not $ok) { return 'heartbeat unreadable (ts unparseable)' }
        $utcInstant = $offsetValue.UtcDateTime
    } else {
        return 'heartbeat unreadable (ts unparseable)'
    }

    # [long], never [int]. The span between now and a hand-written instant is
    # bounded only by what a DateTime can hold, and a stamp more than about
    # sixty-eight years out overflows an Int32 and takes the whole tick down
    # with it.
    $ageSeconds = [long] [Math]::Round(([DateTime]::UtcNow - $utcInstant).TotalSeconds)
    $instantText = $utcInstant.ToString('yyyy-MM-ddTHH:mm:ssZ', $invariant)

    # WHOSE HEARTBEAT IT IS. The stamp carries the pid that wrote it, and a
    # stamp belonging to some other process says nothing about the daemon this
    # tick found: a by-hand daemon pointed at a scratch state root writes no
    # stamp here at all, and last night's daemon leaves one that is fresh enough
    # to read and about a process that is gone. Reporting either as this
    # daemon's liveness is a confidently wrong wedged reading, so a mismatch is
    # named as the mismatch it is and still carries what it found.
    $stampPid = $parsed.pid
    if (-not ($stampPid -is [int] -or $stampPid -is [long] -or $stampPid -is [double] -or $stampPid -is [decimal])) {
        return 'heartbeat unreadable (pid not a number)'
    }
    # The cast is wrapped because the type test above is not a range test. A JSON
    # number too large for an Int64 arrives as a Double that passes that test and
    # then overflows the cast, and an overflow here is a terminating error that
    # unwinds past every fixed reason below into the caller, where the whole line
    # is lost: the silent stand-down this file exists to end. Not a number and
    # not a number this machine could ever have used as a pid are the same
    # reading, so both take the same reason.
    $stampPidValue = 0
    try { $stampPidValue = [long] $stampPid } catch { return 'heartbeat unreadable (pid not a number)' }
    if ($RunningPids -notcontains $stampPidValue) {
        return "heartbeat is from pid $stampPidValue, not pid $($RunningPids -join ', '), last heartbeat $instantText, age $($ageSeconds)s"
    }

    return "last heartbeat $instantText, age $($ageSeconds)s"
}

# Stand down if any daemon.js is already running, whatever started it, and say
# so. The match is on the command line, not the process name, so an unrelated
# node process never blocks the task. A by-hand daemon started from a terminal
# therefore wins over the task, and this wrapper's own log now carries which pid
# won and how long ago that pid last proved it was alive.
$running = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'sidecar[\\/]daemon\.js' })
if ($running.Count -gt 0) {
    # The clause is composed inside the try with the write. Every branch of it
    # reads a file this wrapper does not control, so a shape nobody anticipated
    # must end as a missing line rather than as a terminating error that takes
    # the tick down before its exit.
    try {
        $runningPids = [long[]] @($running | ForEach-Object { [long] $_.ProcessId })
        $clause = Get-HeartbeatClause -File $heartbeatFile -RunningPids $runningPids
        Write-TaskLine "stood down: daemon pid $($runningPids -join ', ') running, $clause"
    } catch { }
    exit 0
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { exit 1 }

# The daemon's own log, rotated on the start path alone: this wrapper is about
# to open it for the life of the daemon it starts, and a tick that stood down
# above never reaches here, so nothing tries to rename a file another wrapper is
# holding open.
#
# A rotation that fails is reported and stepped over rather than raised. Raising
# would mean no daemon is started by this tick, and the condition that stopped
# the rename (a locked file, a permission) is one that outlives the tick, so
# every later tick would fail the same way and the machine would sit with no
# daemon at all because a log file could not be renamed.
try {
    if ((Test-Path -LiteralPath $logFile) -and (Get-Item -LiteralPath $logFile).Length -gt $logCapBytes) {
        Move-Item -Force -LiteralPath $logFile -Destination "$logFile.old"
    }
} catch {
    Write-TaskLine 'could not rotate daemon.log past its cap; starting the daemon and appending to it as it stands'
}

Set-Location $repoRoot
& $node $daemonJs *>> $logFile
exit $LASTEXITCODE
