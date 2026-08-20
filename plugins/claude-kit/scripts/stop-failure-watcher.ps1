# Stop-failure watcher: resume a leashed unattended run after a retryable API
# death, from outside any session.
#
# An API-error turn end (the five-hour session limit above all) routes to the
# StopFailure hook event, not Stop, so the kit-goal Stop-hook leash never sees
# it and an unattended run simply strands. The stop-failure-log.js hook records
# the failure to .kit/stop-failure-latest.json; this script, run as a Windows
# scheduled task (install-stop-failure-watcher.ps1 registers it, behind doctor
# consent) and equally runnable by hand, reads that marker and owns every
# decision the hook cannot: whether the failure is retryable, whether the dead
# session is even in scope, when a launch is due, and the resume itself.
#
# The resume is `claude -p --resume <session id> "<prompt>"` run from the
# project directory with CLAUDE_CODE_RETRY_WATCHDOG=1 set in this process, and
# therefore in the child's environment, explicitly rather than inherited from
# whatever the machine happens to carry. With that variable set, a 429 (which
# a session limit is) does not count against the client's retry budget and the
# client sleeps to the reset instant it reads off the response's own rate-limit
# header, so this script computes no wake time: it launches promptly once the
# failure has settled, and the child does the waiting, bounded by
# ChildLifetimeBoundSeconds so a weekly-limit incident cannot park a claude for
# days. The prompt is the literal `/kit-goal <plan path> ...`, naming every
# plan of the armed queue from the current one on that still has work (a plan
# already reading Complete is skipped, because arming refuses such a plan and
# refuses the whole list with it), which re-arms the goal leash over the rest
# of the sequence and re-binds it to the resumed session (a slash command in a
# -p prompt executes and writes the user-typed command markup the leash claims
# on). A queue with no unfinished plan left in it is a finished run: no prompt
# is composed and nothing is launched.
#
# Security posture: the marker is a user-writable file feeding an unattended
# command execution, so nothing in it is trusted. The session id must match a
# strict grammar (hex and dashes, bounded length) before it goes anywhere near
# a command line, and a value outside it is refused outright, never
# quote-escaped into acceptability. Every plan path is validated by the same
# normalizePlanArg rule the goal state itself enforces (called out of
# kit-goal-lib.js under node rather than restated here, so the two rules
# cannot drift), must clear a conservative path grammar, and must name a plan
# file arming itself can open. The resume prompt is fixed text whose only interpolations are
# those validated plan paths, bounded in total length, and both values reach
# the child through environment variables read by a constant wrapper script, so
# no marker content is ever spliced into a command line. A plan path refused by
# any of those rules truncates the queue there, recorded to the events log with
# the cause, so an unattended run never drops armed plans silently. Every guard
# fails toward
# exit-without-acting: an absent, unparseable, ambiguous, or unexpected input
# ends the pass with exit 0 and no child launched.
#
# Operator rule, the residual fork risk: before answering a stale
# session-limit modal on a console, check .kit/stop-failure-resumed.json
# first. If the incident shows a resume, exit that console session instead of
# continuing it; continuing would fork the run against the watcher's resumed
# child, two continuations sharing one worktree.

param(
    # The project directory whose .kit/ state this pass reads. The scheduled
    # task bakes it into the action arguments; a by-hand run defaults to the
    # current directory.
    [string]$ProjectDir = (Get-Location).Path,

    # Test clock: an ISO 8601 UTC instant this pass treats as now. The repo
    # test suite drives the due-ness, spacing, and budget arithmetic through
    # it; a real run leaves it empty and takes the wall clock. Child runtime
    # is always measured on the wall clock regardless.
    [string]$NowUtc = "",

    # --- Config knobs ---

    # Error classifications the watcher resumes on. server_error stays out by
    # default: the in-session retry watchdog owns transient retries, and a
    # persistent network fault classifies as server_error, which no resume can
    # fix.
    [string[]]$RetryableErrors = @("rate_limit", "overloaded"),

    # A pass acts only once the marker is at least this old, so a
    # still-settling failure is not raced.
    [int]$SettleDelaySeconds = 120,

    # And only while the marker is at most this old. Within a live incident the
    # hook rewrites the marker on every re-death, so a legitimate marker is
    # always fresh; one nobody acted on for this long means the machine was
    # down or the task disabled, and the operator is back at the console with
    # the run theirs to take. Resuming past that point is the fork this whole
    # design exists to prevent.
    [int]$MarkerStalenessSeconds = 3600,

    # Minimum spacing between launches within one incident.
    [int]$RetrySpacingSeconds = 1200,

    # The incident ends after this many launches ...
    [int]$LaunchBackstop = 6,

    # ... or this much wall-clock time since the incident was first seen,
    # whichever comes first.
    [int]$IncidentBudgetHours = 8,

    # How long a resumed child may run before its process tree is killed.
    # Above the client's six-hour cap on sleeping to a rate-limit reset, plus
    # margin.
    [int]$ChildLifetimeBoundSeconds = 25200
)

# The scheduled task's repetition interval, in minutes. The installer
# (install-stop-failure-watcher.ps1) reads this value out of this file when it
# registers the task, so the interval has exactly one home.
$TaskIntervalMinutes = 15

# The ceiling on the resume prompt, in characters. The prompt crosses to the
# child as a single command-line argument, and a `claude` that resolves to a
# .cmd shim routes it through cmd.exe, whose line limit is an order of
# magnitude below the Win32 one, so an armed queue of any length cannot grow
# the command line without bound: the remainder is carried only as far as it
# fits and truncated there. The first plan carried is carried whatever its
# length, since dropping it would mean resuming with no plan at all; this
# bounds the queue tail.
$ResumePromptMaxChars = 1024

# The wrapper the child runs under. A constant script, encoded below, that
# reads the validated session id and the fixed prompt from the environment and
# passes each as its own argument, so nothing this watcher launches is built
# by string concatenation and PowerShell's own argument passing handles
# whatever `claude` resolves to (.exe, .cmd, or .ps1) uniformly. Stop-on-error
# so an unresolvable `claude` exits nonzero rather than falling through to a
# stale $LASTEXITCODE and a false success.
$WrapperScript = '$ErrorActionPreference = "Stop"; ' +
    '& claude -p --resume $env:KIT_STOP_FAILURE_RESUME_ID $env:KIT_STOP_FAILURE_RESUME_PROMPT; ' +
    'exit $LASTEXITCODE'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Read a JSON file into one of three states the callers must tell apart:
# absent (the ordinary no-work case), ok (with the parsed data), and bad (a
# present but unreadable or unparseable file, which is an anomaly every caller
# answers by exiting without acting).
function Read-JsonState {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return @{ state = "absent"; data = $null } }
    try {
        $raw = [System.IO.File]::ReadAllText($Path, $Utf8NoBom)
        $data = $raw | ConvertFrom-Json
        if ($null -eq $data) { return @{ state = "bad"; data = $null } }
        return @{ state = "ok"; data = $data }
    }
    catch { return @{ state = "bad"; data = $null } }
}

# A named property off a parsed JSON object, $null when the value is not an
# object or the property is absent, so a scalar or array where an object was
# expected reads as all-fields-missing rather than throwing.
function Get-JsonField {
    param($Object, [Parameter(Mandatory = $true)][string]$Name)
    if ($Object -isnot [System.Management.Automation.PSCustomObject]) { return $null }
    $prop = $Object.PSObject.Properties[$Name]
    if ($null -eq $prop) { return $null }
    return $prop.Value
}

# The same lookup with the value's collection shape intact. A PowerShell
# function's return unrolls a collection into the caller's pipeline, which
# would flatten a one-element JSON array into a bare string and make a queue of
# one indistinguishable from a queue field holding a string, so the value is
# returned wrapped in a one-element array that the unrolling opens back up.
function Get-JsonFieldArray {
    param($Object, [Parameter(Mandatory = $true)][string]$Name)
    if ($Object -isnot [System.Management.Automation.PSCustomObject]) { return , $null }
    $prop = $Object.PSObject.Properties[$Name]
    if ($null -eq $prop) { return , $null }
    return , $prop.Value
}

# Atomic JSON write, tmp plus rename with the pid in the tmp name, the
# writeCheckpoint pattern from kit-compact-lib.js: a reader that catches the
# write mid-flight sees the previous complete file, never a torn one.
function Write-JsonAtomic {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)]$Object)
    $tmp = $Path + ".tmp." + $PID
    # The tmp name is predictable, so anything already sitting at it that is
    # not a plain file is refused rather than written through: a symlink or a
    # junction planted there would send the write into whatever it points at.
    # Get-Item -Force so a hidden entry is seen too; an absent tmp is the
    # ordinary case and the write creates it. The throw ends the pass in the
    # outer catch, which launches nothing.
    $existing = Get-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    if ($null -ne $existing -and ($existing -isnot [System.IO.FileInfo] -or ($existing.Attributes -band [System.IO.FileAttributes]::ReparsePoint))) {
        throw "refusing to write through a non-regular temporary file at $tmp"
    }
    [System.IO.File]::WriteAllText($tmp, (ConvertTo-Json -InputObject $Object -Depth 10), $Utf8NoBom)
    Move-Item -LiteralPath $tmp -Destination $Path -Force
}

# Append one JSON line to the shared events log, best-effort, honoring the
# same 4 MB ceiling stop-failure-log.js applies so the two writers cannot
# disagree about when the log stops growing.
function Add-WatcherEvent {
    param([Parameter(Mandatory = $true)][string]$KitDir, [Parameter(Mandatory = $true)][hashtable]$Record)
    try {
        $events = Join-Path $KitDir "stop-failure-events.jsonl"
        $size = 0
        if (Test-Path -LiteralPath $events) { $size = (Get-Item -LiteralPath $events).Length }
        if ($size -ge 4MB) { return }
        [System.IO.File]::AppendAllText($events, ((ConvertTo-Json -InputObject $Record -Compress -Depth 10) + "`n"), $Utf8NoBom)
    }
    catch { <# the log is observability; a failed append changes nothing #> }
}

# A value rendered safe to record in the events log: printable ASCII, capped,
# the safeForReason convention from kit-goal-lib.js. Goal-state plan paths are
# free text until they clear Resolve-PlanRel, and the ones that fail it are
# exactly the ones the log has to name, so a refused value is recorded in a
# form that cannot carry more than its own characters.
function Get-SafeForLog {
    param($Value)
    $text = [string]$Value
    $text = [System.Text.RegularExpressions.Regex]::Replace($text, '[^\x20-\x7E]', '')
    if ($text.Length -gt 120) { $text = $text.Substring(0, 120) }
    return $text
}

# Opaque case-insensitive session-id compare, the sameSessionId convention
# from kit-compact-lib.js (session UUIDs surface in mixed case across the
# harness). False when either side is missing.
function Test-SameSessionId {
    param([string]$A, [string]$B)
    if (-not $A -or -not $B) { return $false }
    return $A.Trim().ToLowerInvariant() -eq $B.Trim().ToLowerInvariant()
}

# Parse an ISO 8601 instant to a UTC DateTimeOffset, $null when it does not
# parse, which every caller treats as a guard failure.
function Read-IsoInstant {
    param([string]$Value)
    if (-not $Value) { return $null }
    $parsed = [DateTimeOffset]::MinValue
    $styles = [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal
    if ([DateTimeOffset]::TryParse($Value, [System.Globalization.CultureInfo]::InvariantCulture, $styles, [ref]$parsed)) { return $parsed }
    return $null
}

# Whether the sentinel's recorded wrapper pid is a live wrapper. The name
# check narrows pid reuse: a recycled pid belonging to anything but a
# PowerShell host reads as dead, so a stale in-flight sentinel self-heals
# instead of blocking every future pass.
function Test-WrapperAlive {
    param($RecordedPid)
    $procId = 0
    try { $procId = [int]$RecordedPid } catch { return $false }
    if ($procId -le 0) { return $false }
    try { $proc = Get-Process -Id $procId -ErrorAction Stop } catch { return $false }
    return ($proc.ProcessName -eq "powershell" -or $proc.ProcessName -eq "pwsh")
}

# One plan path, put through the exact rules the goal state enforces
# (normalizePlanArg and planHead in kit-goal-lib.js, run under node with the
# values as argv so nothing is interpolated into the -e source) plus a
# conservative path grammar. Returns @{ rel; status; reason }: on success rel is
# the repo-relative path, status is the plan's own Status header as the rest of
# the kit classifies it ("complete", "in progress", or "unknown"), and reason is
# "ok". On any refusal rel is $null and reason names the check that refused
# ("not-a-path", "refused", "grammar", or "existence"), which every caller
# answers by carrying no further plan into the prompt and recording the named
# cause.
#
# Two checks close the free-text channel, because plan paths are the only
# project-state values that reach the resume prompt. Existence: a shape-valid
# path naming nothing on disk would be a way to deliver prose to an unattended
# session as operator instruction. It is planHead's own existence answer that
# decides, the one arming reads, so the file must be openable and not merely
# present: a path arming would refuse (an exclusive share, a deny ACL) refuses
# here too, which is what keeps this rule from composing a prompt the resumed
# session's arm rejects all-or-nothing. Grammar: a FILENAME is itself free text,
# so the normalized path must be letters, digits, underscore, dot, hyphen, and
# forward slash and nothing else, anchored at the very ends of the string
# (\A/\z, so a trailing newline cannot ride through the $ anchor's
# end-of-line allowance). That also rejects a space, which matters beyond
# injection: the prompt joins paths with spaces, so a path carrying one would
# split into two unparseable arguments on the receiving side and the arm would
# fail naming paths nobody wrote. A control character is rejected up front,
# before node, because it could not survive the command-line crossing intact
# enough to be judged.
#
# The grammar is deliberately stricter than what arming accepts, so a legal
# plan filename outside the class (a space, parentheses, a non-ASCII letter) is
# refused here even though `/kit-goal` would take it. That is the trade the
# unattended path is held to: the class admits nothing a cmd.exe re-parse
# through a .cmd shim could act on, and being ASCII-only it makes the bytes
# PowerShell decodes off node's stdout byte-identical to what node wrote
# whatever the console codepage is. What makes it acceptable is that the
# refusal is loud: a queue-truncated record naming cause "grammar" and the
# failing plan.
function Resolve-PlanRel {
    param(
        [Parameter(Mandatory = $true)][string]$NodeExe,
        [Parameter(Mandatory = $true)][string]$LibPath,
        [Parameter(Mandatory = $true)][string]$ProjectDir,
        $Plan
    )
    if ($Plan -isnot [string] -or $Plan -eq "") { return @{ rel = $null; reason = "not-a-path" } }
    if ($Plan -match '[\x00-\x1F]') { return @{ rel = $null; reason = "not-a-path" } }
    # Three lines out, path then status then existence, so a status carrying a
    # space ("in progress") stays whole and no value has to be delimited inside
    # a line. The separator is built with String.fromCharCode because this
    # source crosses to node as a native-command argument, where a double quote
    # does not survive PowerShell's argument quoting intact.
    $normalizeSrc = 'const lib = require(process.argv[1]); ' +
        'const rel = lib.normalizePlanArg(process.argv[2], process.argv[3]); ' +
        'if (rel === null) process.exit(1); ' +
        'const nl = String.fromCharCode(10); ' +
        'const head = lib.planHead(process.argv[2], rel); ' +
        'process.stdout.write(rel + nl + head.status + nl + (head.exists ? 1 : 0));'
    # The rules run with errors non-terminating and their stderr discarded:
    # Windows PowerShell wraps each stderr line of a native command as an error
    # record, which under Stop would turn any byte node writes there (a
    # deprecation or experimental warning) into a terminating error and end
    # every pass on that host without acting. The preference is restored
    # immediately, so every guard around this one still fails toward exit.
    $out = @()
    try {
        $ErrorActionPreference = "Continue"
        $out = @(& $NodeExe "-e" $normalizeSrc $LibPath $ProjectDir $Plan 2>$null)
    }
    finally { $ErrorActionPreference = "Stop" }
    if ($LASTEXITCODE -ne 0 -or $out.Count -lt 3) { return @{ rel = $null; reason = "refused" } }
    $rel = [string]$out[0]
    $status = [string]$out[1]
    $exists = (([string]$out[2]).Trim() -eq "1")
    if ([string]::IsNullOrEmpty($rel)) { return @{ rel = $null; reason = "refused" } }
    if ($rel -notmatch '\A[A-Za-z0-9_./-]+\z') { return @{ rel = $null; reason = "grammar" } }
    if (-not $exists) { return @{ rel = $null; reason = "existence" } }
    return @{ rel = $rel; status = $status; reason = "ok" }
}

try {
    # --- The pass. Numbered guards; every failure exits without acting.
    # Stop-on-error so a failed cmdlet (a write that did not land, a process
    # that did not start) terminates into the catch below instead of sailing
    # on toward a launch built on a missed step.
    $ErrorActionPreference = "Stop"

    if (-not (Test-Path -LiteralPath $ProjectDir -PathType Container)) { exit 0 }
    $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir).Path
    $kitDir = Join-Path $ProjectDir ".kit"
    $markerPath = Join-Path $kitDir "stop-failure-latest.json"
    $attemptsPath = Join-Path $kitDir "stop-failure-attempts.json"
    $sentinelPath = Join-Path $kitDir "stop-failure-resumed.json"

    $now = $null
    if ($NowUtc -ne "") { $now = Read-IsoInstant $NowUtc }
    else { $now = [DateTimeOffset]::UtcNow }
    if ($null -eq $now) { exit 0 }
    $nowIso = $now.UtcDateTime.ToString("o")

    # 1. The marker. Absent or unparseable: nothing to do.
    $marker = Read-JsonState $markerPath
    if ($marker.state -ne "ok") { exit 0 }
    $sessionId = Get-JsonField $marker.data "session_id"
    if ($sessionId -isnot [string]) { exit 0 }

    # 2. Session-id grammar, before the id goes anywhere near a command line:
    # a leading hex digit then hex and dashes, bounded length, matched against
    # the very ends of the string (\A/\z, so a trailing newline cannot ride
    # through the $ anchor's end-of-line allowance). The leading digit is what
    # keeps a value that is all dashes at the front from reaching `claude` as
    # its own argv element and being read there as an option rather than an id.
    # Anything else is refused outright.
    if ($sessionId -notmatch '\A[0-9a-fA-F][0-9a-fA-F-]{7,63}\z') { exit 0 }

    # 3. Scope: only a leashed unattended run auto-resumes. The goal state
    # must hold an armed plan whose bound session is the marker's session.
    # An interactive session that died on an API error is the operator's to
    # resume, and this guard is the main fork-risk mitigation: the stranded
    # console case is precisely the armed-run case.
    #
    # The one accepted unbound case is a goal this watcher's own child armed.
    # An in-session arm normally binds the arming session at arm time, so a
    # resumed child that re-arms and dies matches on boundSession directly and
    # never needs this branch. The branch serves the arm the CLI could not
    # corroborate (no usable session id in its shell, or no transcript on disk
    # for it): that arm writes boundSession = null and the leash is claimed at
    # the session's first stop or its first auto-compaction offer, so a child
    # in that state that re-arms and then dies (or reaches the lifetime bound)
    # before either of those leaves the goal armed-unbound, and a match-only
    # rule would refuse every later pass with the incident budget unspent. The sentinel naming this same session as the
    # one it launched is what makes that run unattended by construction. An
    # original unattended run that dies before it can claim the leash at all,
    # at a stop or at an auto-compaction offer, is deliberately not covered: covering it would mean accepting any unbound
    # goal, and an unbound goal in a project where an interactive session died
    # is exactly the fork this guard refuses.
    $goal = Read-JsonState (Join-Path $kitDir "goal-state.json")
    if ($goal.state -ne "ok") { exit 0 }
    $plan = Get-JsonField $goal.data "plan"
    if ($plan -isnot [string] -or $plan -eq "") { exit 0 }
    $boundSession = [string](Get-JsonField $goal.data "boundSession")
    if (-not (Test-SameSessionId $boundSession $sessionId)) {
        if ($boundSession.Trim() -ne "") { exit 0 }
        $launcher = Read-JsonState $sentinelPath
        if ($launcher.state -ne "ok") { exit 0 }
        if (-not (Test-SameSessionId ([string](Get-JsonField $launcher.data "oldSessionId")) $sessionId)) { exit 0 }
    }

    # 4. Retryability: the classification must be a string in the configured
    # retryable set. Missing, non-string, or unrecognized reads as
    # unclassifiable and is left for the operator.
    $errorClass = Get-JsonField $marker.data "error"
    if ($errorClass -isnot [string]) { exit 0 }
    if ($RetryableErrors -notcontains $errorClass) { exit 0 }

    # 5. Due-ness, not wake-time arithmetic: the payload carries no reset
    # timestamp and the resumed child reads the true one for itself, so the
    # only timing here is that the failure has settled.
    $recordedAt = Read-IsoInstant ([string](Get-JsonField $marker.data "recordedAt"))
    if ($null -eq $recordedAt) { exit 0 }
    if ($now -lt $recordedAt.AddSeconds($SettleDelaySeconds)) { exit 0 }
    # The other end of the same window: a marker past the staleness ceiling is
    # not acted on at all. See MarkerStalenessSeconds for why an old marker
    # means the run is the operator's rather than this watcher's.
    if ($now -gt $recordedAt.AddSeconds($MarkerStalenessSeconds)) { exit 0 }

    # 6. The incident budget, keyed on the session id rather than the marker:
    # --resume preserves the session id, so a resumed run that re-dies of the
    # same limit writes a fresh but indistinguishable marker, and a per-marker
    # counter would reset on every death and never bind. A budget record for
    # some other session is a finished incident's leftover and this failure
    # starts fresh.
    $attempts = Read-JsonState $attemptsPath
    if ($attempts.state -eq "bad") { exit 0 }
    $priorLaunches = 0
    $firstSeen = $now
    $firstSeenIso = $nowIso
    if ($attempts.state -eq "ok" -and (Test-SameSessionId ([string](Get-JsonField $attempts.data "sessionId")) $sessionId)) {
        $priorFirstSeenIso = [string](Get-JsonField $attempts.data "firstSeen")
        $priorFirstSeen = Read-IsoInstant $priorFirstSeenIso
        if ($null -eq $priorFirstSeen) { exit 0 }
        $withinBudget = ($now -le $priorFirstSeen.AddHours($IncidentBudgetHours))
        if (Get-JsonField $attempts.data "exhausted") {
            # A spent incident is left alone for as long as its own budget
            # window stands. Past that window the record is a finished
            # incident's leftover, and since a marker only reaches this guard
            # while it is fresh, a failure still on the marker here is a new
            # incident: it falls through to a launch on a fresh budget rather
            # than blocking this session id for the life of the machine.
            if ($withinBudget) { exit 0 }
        }
        else {
            $firstSeenIso = $priorFirstSeenIso
            $firstSeen = $priorFirstSeen
            try { $priorLaunches = [int](Get-JsonField $attempts.data "launches") } catch { exit 0 }
            if ($priorLaunches -ge $LaunchBackstop -or -not $withinBudget) {
                # Spent. Mark the incident exhausted so the note below lands
                # once, note it, and leave the incident alone thereafter.
                Write-JsonAtomic $attemptsPath @{
                    sessionId  = $sessionId
                    firstSeen  = $firstSeenIso
                    launches   = $priorLaunches
                    lastLaunch = [string](Get-JsonField $attempts.data "lastLaunch")
                    exhausted  = $true
                }
                Add-WatcherEvent $kitDir @{
                    watcher    = "incident-exhausted"
                    sessionId  = $sessionId
                    launches   = $priorLaunches
                    firstSeen  = $firstSeenIso
                    recordedAt = $nowIso
                }
                exit 0
            }
            $lastLaunchRaw = Get-JsonField $attempts.data "lastLaunch"
            if ($null -ne $lastLaunchRaw) {
                $lastLaunch = Read-IsoInstant ([string]$lastLaunchRaw)
                if ($null -eq $lastLaunch) { exit 0 }
                if ($now -lt $lastLaunch.AddSeconds($RetrySpacingSeconds)) { exit 0 }
            }
        }
    }

    # 7. The in-flight sentinel: a resumed child already running means this
    # pass has nothing to add, which is what keeps two scheduled passes from
    # launching two children. An in-flight record with no live wrapper is a
    # crashed pass's leftover and does not block.
    #
    # An in-flight record with no pid at all is another pass caught between its
    # two sentinel writes, and the yield it earns is bounded by its age the
    # same way a dead pid's is bounded by liveness: a pass that died in that
    # window (a launch that threw before the second write) leaves a pid-less
    # record no later pass can ever clear, so only a record written within one
    # pass interval yields. A missing or unparseable launchedAt does not block.
    $sentinel = Read-JsonState $sentinelPath
    if ($sentinel.state -eq "bad") { exit 0 }
    if ($sentinel.state -eq "ok" -and ([string](Get-JsonField $sentinel.data "state")) -eq "in-flight") {
        $sentinelPid = Get-JsonField $sentinel.data "pid"
        if ($null -eq $sentinelPid) {
            $launchedAt = Read-IsoInstant ([string](Get-JsonField $sentinel.data "launchedAt"))
            if ($null -ne $launchedAt -and $now -le $launchedAt.AddMinutes($TaskIntervalMinutes)) { exit 0 }
        }
        elseif (Test-WrapperAlive $sentinelPid) { exit 0 }
    }

    # 8. The plan paths that will be re-armed, each through Resolve-PlanRel
    # (the goal state's own normalizePlanArg rule, the path grammar, and the
    # existence check that keep free text out of the prompt, plus the plan's
    # own Status). node or the lib missing exits without acting.
    #
    # This is the last guard because it is the only one that both costs and
    # speaks: it spawns a node per candidate, and it records to the events log
    # what the queue lost. Above the guards it would resolve the queue on every
    # scheduled pass and append a truncation record on each, so one unhealing
    # incident (a renamed plan, a queue whose every plan reads Complete, a
    # resumed child running for hours) would fill the log with identical lines
    # and eventually push it past the 4 MB ceiling that silences it. Below them,
    # only a pass that would actually launch resolves anything, so each record
    # in the log belongs to a pass that acted on it.
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($null -eq $node) { exit 0 }
    $libPath = Join-Path (Split-Path $PSScriptRoot -Parent) "hooks\kit-goal-lib.js"
    if (-not (Test-Path -LiteralPath $libPath)) { exit 0 }

    # The candidates, in armed order: the current plan, then whatever remains
    # of the armed queue. Re-arming is wholesale: `/kit-goal` naming one plan
    # replaces the queue with a queue of one, so a resume that named the
    # current plan alone would finish it, release the leash, and lose the plans
    # after it with no signal anywhere. Naming the remainder is the same
    # recovery an operator performs by hand.
    #
    # The queue fields are read defensively and any doubt falls back to the
    # current plan alone, which is exactly the pre-queue prompt: a state file
    # without them predates the queue, and one whose queue disagrees with plan
    # is a hand edit rather than a sequence to re-arm from.
    $candidates = @($plan)
    $queueValue = Get-JsonFieldArray $goal.data "queue"
    $queueIndexValue = Get-JsonField $goal.data "queueIndex"
    if ($queueValue -is [System.Collections.IList] -and ($queueIndexValue -is [int] -or $queueIndexValue -is [long])) {
        $queueIndex = [int]$queueIndexValue
        if ($queueIndex -ge 0 -and $queueIndex -lt $queueValue.Count -and ([string]$queueValue[$queueIndex]) -eq $plan) {
            for ($i = $queueIndex + 1; $i -lt $queueValue.Count; $i++) { $candidates += $queueValue[$i] }
        }
    }

    # The prompt carries only plans that still have work. `/kit-goal` refuses,
    # all-or-nothing, an arm naming any plan whose Status reads Complete, and a
    # run that died with its current plan just marked Complete and the advance
    # not yet recorded is the single likeliest state this watcher meets, so
    # leading with that plan would have the whole arm refused and the entire
    # remainder lost with no signal. A plan whose Status cannot be classified
    # counts as not Complete: arming accepts it, so dropping it would lose work
    # the operator armed, and this rule skips exactly what arming refuses.
    #
    # The two ways a candidate leaves the prompt split on certainty. Doubt
    # truncates: a path that fails the rule, or that would carry the prompt
    # past its ceiling, ends the remainder there rather than being stepped
    # over, because the queue is ordered, so a prefix of it is still a sequence
    # the operator armed while a gapped one is not, and resuming with fewer
    # plans is recoverable by a re-arm where resuming out of order is not.
    # Proof of done skips: a Complete plan is known-finished work rather than
    # an uncertain entry, carrying it would have arming refuse the whole list,
    # and truncating there would drop the unfinished plans after it for no
    # safety gain, so it is skipped wherever it sits.
    #
    # Every truncation is recorded, on this one shared path so the causes
    # cannot drift apart: the plans lost are plans the operator armed, and this
    # watcher exists for runs nobody is watching, so a silent truncation would
    # leave no record anywhere of what the resume dropped.
    $planRels = @()
    $promptLength = "/kit-goal ".Length
    $truncation = $null
    for ($i = 0; $i -lt $candidates.Count; $i++) {
        $resolved = Resolve-PlanRel $node.Source $libPath $ProjectDir $candidates[$i]
        if ($null -eq $resolved.rel) {
            $truncation = @{ plan = $candidates[$i]; cause = $resolved.reason; index = $i }
            break
        }
        if ($resolved.status -eq "complete") { continue }
        # The first plan carried is carried whatever its length, since a prompt
        # without it would arm nothing; the ceiling bounds the tail.
        $addition = $resolved.rel.Length
        if ($planRels.Count -gt 0) {
            $addition += 1
            if (($promptLength + $addition) -gt $ResumePromptMaxChars) {
                $truncation = @{ plan = $resolved.rel; cause = "ceiling"; index = $i }
                break
            }
        }
        $promptLength += $addition
        $planRels += $resolved.rel
    }
    if ($null -ne $truncation) {
        Add-WatcherEvent $kitDir @{
            watcher    = "queue-truncated"
            sessionId  = $sessionId
            plan       = (Get-SafeForLog $truncation.plan)
            cause      = $truncation.cause
            dropped    = $candidates.Count - $truncation.index
            recordedAt = $nowIso
        }
    }
    if ($planRels.Count -eq 0) {
        # Nothing left to arm: every remaining plan reads Complete (the run
        # finished and the release is all that is missing) or the first one is
        # not a usable plan path. Either way a resume would carry an arm that
        # names nothing, so this pass launches nothing and notes why.
        Add-WatcherEvent $kitDir @{
            watcher    = "no-plans-to-resume"
            sessionId  = $sessionId
            candidates = $candidates.Count
            recordedAt = $nowIso
        }
        exit 0
    }

    # 9. Launch. The incident record is written before the child starts, so a
    # watcher that dies mid-launch has still spent the attempt, and the
    # sentinel goes down before the child starts because it exists to keep an
    # operator from forking the run: it must cover the whole window in which
    # a fork is possible.
    $launches = $priorLaunches + 1
    Write-JsonAtomic $attemptsPath @{
        sessionId  = $sessionId
        firstSeen  = $firstSeenIso
        launches   = $launches
        lastLaunch = $nowIso
    }

    # The resume prompt: the /kit-goal invocation and nothing else, the
    # validated plan paths its only interpolation. Re-arming is the whole job
    # here, because --resume carries the prior conversation and the SessionStart
    # resume hook re-states the plan and the completion contract, so explanatory
    # prose would add nothing the resumed session does not already have. It
    # would also be read as part of the command's argument span, where the
    # plan paths are expected to stand alone, so trailing prose risks the arm
    # failing and the recovery running unleashed. One line by construction,
    # which is also what survives a `claude` that resolves to a .cmd shim: that
    # call routes through cmd.exe, which truncates an argument at its first
    # newline.
    $resumePrompt = "/kit-goal " + ($planRels -join " ")

    Write-JsonAtomic $sentinelPath @{
        launchedAt   = $nowIso
        pid          = $null
        oldSessionId = $sessionId
        state        = "in-flight"
    }

    $env:CLAUDE_CODE_RETRY_WATCHDOG = "1"
    $env:KIT_STOP_FAILURE_RESUME_ID = $sessionId
    $env:KIT_STOP_FAILURE_RESUME_PROMPT = $resumePrompt
    $encodedWrapper = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($WrapperScript))

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    # The host is spelled absolutely, as the taskkill call below is: a bare
    # name resolves through PATH, and this process launches unattended under
    # whatever environment the scheduled task inherits.
    $powershell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    $child = Start-Process -FilePath $powershell `
        -ArgumentList @("-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encodedWrapper) `
        -WorkingDirectory $ProjectDir -WindowStyle Hidden -PassThru

    Write-JsonAtomic $sentinelPath @{
        launchedAt   = $nowIso
        pid          = $child.Id
        oldSessionId = $sessionId
        state        = "in-flight"
    }
    Add-WatcherEvent $kitDir @{
        watcher    = "launched"
        sessionId  = $sessionId
        plan       = $planRels[0]
        pid        = $child.Id
        recordedAt = $nowIso
    }

    if (-not $child.WaitForExit($ChildLifetimeBoundSeconds * 1000)) {
        # Past the lifetime bound: kill the whole tree, record it, and leave
        # both the marker (no successful resume happened) and the incident
        # record (the launch is spent) in place.
        $taskkill = Join-Path $env:SystemRoot "System32\taskkill.exe"
        # Its own try: a taskkill complaint on stderr must not skip the
        # recording below, which is the whole point of this branch.
        try { & $taskkill /PID $child.Id /T /F 2>$null | Out-Null } catch { <# recorded below either way #> }
        # Whether the kill landed decides what the sentinel says. A wrapper
        # that survived it is still a live child, so the record stays in-flight
        # with its pid and guard 7 blocks the next pass on that live process
        # instead of starting a second child beside it; killed-timeout, which
        # does not block, is only for a tree that genuinely ended.
        $killed = $child.WaitForExit(15000)
        $killRecord = @{
            launchedAt     = $nowIso
            pid            = $child.Id
            oldSessionId   = $sessionId
            state          = "in-flight"
            runtimeSeconds = [int]$stopwatch.Elapsed.TotalSeconds
        }
        if ($killed) {
            $killRecord.state = "killed-timeout"
            $killRecord.endedAt = [DateTimeOffset]::UtcNow.UtcDateTime.ToString("o")
        }
        Write-JsonAtomic $sentinelPath $killRecord
        Add-WatcherEvent $kitDir @{
            watcher        = "killed-timeout"
            sessionId      = $sessionId
            pid            = $child.Id
            killed         = $killed
            runtimeSeconds = [int]$stopwatch.Elapsed.TotalSeconds
            recordedAt     = $nowIso
        }
        exit 0
    }

    $exitCode = $null
    try { $exitCode = $child.ExitCode } catch { $exitCode = $null }
    $runtimeSeconds = [int]$stopwatch.Elapsed.TotalSeconds
    Write-JsonAtomic $sentinelPath @{
        launchedAt     = $nowIso
        pid            = $child.Id
        oldSessionId   = $sessionId
        state          = "exited"
        exitCode       = $exitCode
        endedAt        = [DateTimeOffset]::UtcNow.UtcDateTime.ToString("o")
        runtimeSeconds = $runtimeSeconds
    }
    Add-WatcherEvent $kitDir @{
        watcher        = "exited"
        sessionId      = $sessionId
        exitCode       = $exitCode
        runtimeSeconds = $runtimeSeconds
        recordedAt     = $nowIso
    }

    # A zero exit is the only outcome that clears anything. On any other one
    # both records stay, so the next due pass retries within the incident
    # budget: runtime is no evidence of progress here, because the retry
    # watchdog this watcher sets on the child makes the client sleep to the
    # rate-limit reset, so a child that parks for hours and then re-dies on the
    # still-active limit has done nothing but wait. Runtime rides in the
    # sentinel and the events log as observability and gates nothing.
    #
    # The marker clears only while it is still the record this pass acted on.
    # The child may have run for hours, and a marker replaced in the meantime
    # is a newer failure the next pass owns.
    if ($exitCode -eq 0) {
        $current = Read-JsonState $markerPath
        if ($current.state -eq "ok" -and
            (Test-SameSessionId ([string](Get-JsonField $current.data "session_id")) $sessionId) -and
            ([string](Get-JsonField $current.data "recordedAt")) -eq ([string](Get-JsonField $marker.data "recordedAt"))) {
            Remove-Item -LiteralPath $markerPath -Force -ErrorAction SilentlyContinue
        }
        Remove-Item -LiteralPath $attemptsPath -Force -ErrorAction SilentlyContinue
    }
    exit 0
}
catch {
    # Fail toward exit-without-acting: whatever broke, this pass launches
    # nothing more and says nothing; the next scheduled pass re-reads the
    # state fresh.
    exit 0
}
