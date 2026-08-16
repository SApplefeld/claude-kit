# Health check and setup for the claude-kit plugin on this machine.
#
# Ships inside the plugin payload so every machine with the plugin installed
# has the current doctor, clone or not. The repo root keeps thin forwarders
# (doctor.ps1 / doctor.cmd) for the dev-clone habit.
#
# Verifies core setup (execution policy, doctrine import and freshness, kaizen
# signpost, git hooks on a clone), the ANTHROPIC_API_KEY hazard, the hook layer
# (goal-leash wiring and load, hook-canary wiring, the memq shim), the memory
# store's sync repo and its allowlist, the stop-failure watcher's scheduled
# task, and leftover resume-relay state on a machine that once armed it.
#
#   .\doctor.ps1              Check only; prints PASS/WARN/FAIL with remediations.
#   .\doctor.ps1 -Fix         Also applies the safe durable repairs (execution
#                             policy, the memq shim into ~\.claude\bin,
#                             the memory store's sync repo and allowlist,
#                             signpost + git hooks on a clone, and the
#                             autoCompactWindow value written into user
#                             settings.json, behind its own consent prompt).
#                             It deletes nothing.
#   .\doctor.ps1 -Fix -Yes    Pre-answers the consent prompts of the actions the
#                             other flags already requested, for unattended runs.
#                             It authorizes nothing by itself.
#   .\doctor.ps1 -Fix -RemoveLegacyRelay
#                             Also removes leftover resume-relay state (watcher
#                             process, Startup shortcut, then the state
#                             directory), after printing the resume records that
#                             directory holds. Naming this switch is the
#                             authorization for that deletion; -Fix alone never
#                             deletes it.
#   .\doctor.ps1 -Fix -RegisterStopFailureWatcher
#                             Also registers the stop-failure watcher scheduled
#                             task for the directory the doctor was run from.
#                             Opt-in (only unattended machines want it), so
#                             naming this switch is the request; -Fix alone
#                             never registers it.
#   .\doctor.ps1 -Fix -UnregisterStopFailureWatcher
#                             Removes the stop-failure watcher scheduled task.
#                             Naming this switch is the authorization; -Fix
#                             alone never removes it.
# If scripts are blocked entirely, use the wrapper beside this file:
#   doctor.cmd [-Fix] [-Yes] [-RemoveLegacyRelay]
#              [-RegisterStopFailureWatcher] [-UnregisterStopFailureWatcher]
# Exit code: 0 when nothing FAILs (warnings allowed), 1 otherwise.

param([switch]$Fix, [switch]$Yes, [switch]$RemoveLegacyRelay,
      [switch]$RegisterStopFailureWatcher, [switch]$UnregisterStopFailureWatcher)

# Windows PowerShell 5.1 inherits PSModulePath from whatever parent launched it.
# A pwsh 7+ parent (the Claude Code harness, a pwsh terminal) puts its own
# module directories first, and those shadow 5.1's built-in modules: cmdlet
# autoload then finds the pwsh edition of Microsoft.PowerShell.Security and
# fails to load it ("command was found in the module ... but the module could
# not be loaded"), taking Get-ExecutionPolicy down with it. Reset this process's
# PSModulePath to the 5.1 default set; the change dies with the process.
# [Environment]::GetFolderPath follows a OneDrive-redirected Documents folder.
if ($PSVersionTable.PSVersion.Major -le 5) {
    $env:PSModulePath = @(
        (Join-Path ([Environment]::GetFolderPath("MyDocuments")) "WindowsPowerShell\Modules"),
        (Join-Path $env:ProgramFiles "WindowsPowerShell\Modules"),
        (Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\Modules")
    ) -join ";"
}

$script:failCount = 0
$script:warnCount = 0

function Report {
    param([string]$Status, [string]$Name, [string[]]$Detail = @())
    $colors = @{ PASS = "Green"; WARN = "Yellow"; FAIL = "Red"; INFO = "Gray"; FIXED = "Cyan" }
    Write-Host ("[{0,-5}] {1}" -f $Status, $Name) -ForegroundColor $colors[$Status]
    foreach ($line in $Detail) { Write-Host "        $line" }
    if ($Status -eq "FAIL") { $script:failCount++ }
    if ($Status -eq "WARN") { $script:warnCount++ }
}

# Consent gate for an action that changes this machine: installing software, or
# removing state. Only ever true under -Fix; -Yes pre-answers for unattended runs
# (it consents to what the flags already asked for, it never asks for more); a
# non-interactive host that cannot prompt declines rather than stalling.
#
# -Interactive withholds the -Yes shortcut for the one class of action -Yes must
# not cover: replacing a value the operator chose, as opposed to supplying one
# that is missing or repairing state the kit itself owns. That class is not
# idempotent against intent. An unattended run cannot tell a deliberate setting
# from a stale one, so it would revert the deliberate one, and would do it again
# after every retune of the constant it compares against. Such an action asks for
# more than the flags did, so it waits for a person.
function Get-Consent {
    param([string]$Question, [switch]$Interactive)
    if (-not $Fix) { return $false }
    if ($Yes -and -not $Interactive) { return $true }
    # The unattended remedy is real advice for an ordinary prompt and false
    # advice for an -Interactive one, where -Yes is exactly what does not apply.
    $unattendedNote = if ($Interactive) { "this one needs a person, since it replaces a value you chose" } else { "add -Yes to consent unattended" }
    try {
        $answer = Read-Host "$Question [y/N]"
        if ([string]::IsNullOrWhiteSpace($answer)) {
            Write-Host "        (no answer; declining. A redirected stdin cannot answer prompts; $unattendedNote.)"
            return $false
        }
        return $answer -match '^[Yy]'
    }
    catch {
        Write-Host "        (non-interactive host; skipping the prompt. $unattendedNote.)"
        return $false
    }
}

function Get-SanitizedLine {
    param([string]$Value, [int]$MaxLength = 120)
    # Strings this script did not author (a plan path from goal-state.json, a
    # record written by something outside the kit) are stripped to printable
    # ASCII and length-bounded before reaching this trusted output channel, so a
    # hostile file cannot smuggle escape sequences past a reader's eyes or emit
    # unbounded output. It does not make the text safe to obey: bounded
    # printable ASCII still carries a sentence, so treat what it returns as data.
    # Matches kit-goal.js's own sanitize() convention, with the cap per channel
    # because a truncated string is only acceptable where nothing compares it.
    # Truncation is always visible: a silently cut line would let two different
    # values print identically, and the triage rule below asks a reader to
    # compare continue prompts for equality.
    $clean = [string]$Value -replace '[^\x20-\x7E]', ''
    if ($clean.Length -gt $MaxLength) {
        $dropped = $clean.Length - $MaxLength
        $clean = $clean.Substring(0, $MaxLength) + "... [+" + $dropped + " more chars]"
    }
    return $clean
}

# --- Locate the payload and, when present, the surrounding repo clone. Dev-only
# --- checks (kaizen signpost writing, git hook wiring) apply only to a clone;
# --- an installed plugin cache must never register itself as the kaizen target.
$pluginRoot = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $pluginRoot ".claude-plugin\plugin.json"))) {
    Report "FAIL" "Plugin payload root" @("Expected .claude-plugin\plugin.json one level above this script; the doctor must live at <plugin>\doctor\doctor.ps1.")
    exit 1
}
$claudeDir = Join-Path $env:USERPROFILE ".claude"

# Shim install, integrity, and PATH-membership helpers, beside this script.
# Dot-sourced here rather than at the check, because Add-ToUserPath below
# uses the PATH predicate it defines.
. (Join-Path $PSScriptRoot "install-memq-shim.ps1")

# Memory-sync allowlist, state, and initialization helpers, beside this
# script. It resolves no paths of its own: this script is the only caller that
# knows the real store root, and passes it in.
. (Join-Path $PSScriptRoot "install-memory-sync.ps1")

# Embedder probe, install, and index-health helpers, beside this script. It
# resolves no paths of its own either: this script is the only caller that
# knows the real embedder root and store root, and passes both in.
. (Join-Path $PSScriptRoot "install-embedder.ps1")

# Auto-compaction-window writer for user settings.json, beside this script.
# It resolves no paths of its own: this script passes the settings path in,
# and the test suite passes a sandbox path.
. (Join-Path $PSScriptRoot "install-compact-window.ps1")

# Stop-failure watcher task registrar and status reader, beside this script.
# It owns the task name, the pinned-settings registration, and the read-back
# verification; the repo test suite runs the same functions under a throwaway
# task name.
. (Join-Path $PSScriptRoot "install-stop-failure-watcher.ps1")

# Append a directory to the durable user PATH, and to this process's PATH so
# the current run sees it too. Every kit PATH repair goes through this one
# function.
#
# The registry value is read and written raw. [Environment]::GetEnvironment-
# Variable expands a REG_EXPAND_SZ Path, and SetEnvironmentVariable under
# Windows PowerShell writes back as REG_SZ, so a read-modify-write through
# that API permanently flattens entries such as %USERPROFILE%\bin into
# today's values. Reading with DoNotExpandEnvironmentNames and writing with
# the value's own kind keeps them intact. Membership is the exact per-entry
# compare from Test-UserPathContains, so a directory is never judged present
# because another entry contains its name as a substring, and the separator is
# added only between entries, so an empty Path never gains a leading ';' (an
# empty PATH entry means the current directory, which is a resolution hazard).
# Returns $true when the durable value now lists the directory. A failure is
# reported by the caller rather than thrown: a PATH edit that cannot be made
# is one finding, never a reason to abandon the rest of the health check.
function Add-ToUserPath {
    param([Parameter(Mandatory = $true)][string]$Directory)
    $durable = $false
    $key = $null
    try {
        $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey("Environment", $true)
        if ($null -ne $key) {
            $raw = ""
            $existing = $key.GetValue("Path", "", [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
            if ($null -ne $existing) { $raw = [string]$existing }
            # Keep the value's own kind; a Path that does not exist yet is
            # created as ExpandString, which is what Windows itself uses.
            $kind = [Microsoft.Win32.RegistryValueKind]::ExpandString
            try {
                $existingKind = $key.GetValueKind("Path")
                if ($existingKind -eq [Microsoft.Win32.RegistryValueKind]::String -or
                    $existingKind -eq [Microsoft.Win32.RegistryValueKind]::ExpandString) {
                    $kind = $existingKind
                }
            }
            catch { <# no existing value: the ExpandString default stands #> }
            if (Test-UserPathContains -RawPath $raw -Directory $Directory) { $durable = $true }
            else {
                $trimmed = $raw.TrimEnd(";")
                $updated = if ($trimmed -eq "") { $Directory } else { $trimmed + ";" + $Directory }
                $key.SetValue("Path", $updated, $kind)
                $durable = $true
            }
        }
    }
    catch { $durable = $false }
    finally { if ($null -ne $key) { $key.Close() } }
    # This process too, so the rest of the run sees the directory.
    if (-not (Test-UserPathContains -RawPath $env:Path -Directory $Directory)) {
        $env:Path = if ($env:Path.TrimEnd(";") -eq "") { $Directory } else { $env:Path.TrimEnd(";") + ";" + $Directory }
    }
    return $durable
}

# A payload anywhere under ~/.claude is always an installed cache, never the
# dev clone: /plugin marketplace add clones the whole repo (with .git) under
# ~/.claude/plugins/marketplaces/, so a structural check alone misclassifies
# exactly the copy every install-only machine runs.
$repoRoot = Split-Path (Split-Path $pluginRoot -Parent) -Parent
$isClone = (Split-Path $pluginRoot -Leaf) -eq "claude-kit" -and
           (Split-Path (Split-Path $pluginRoot -Parent) -Leaf) -eq "plugins" -and
           (Test-Path (Join-Path $repoRoot ".git")) -and
           -not $pluginRoot.StartsWith($claudeDir, [System.StringComparison]::OrdinalIgnoreCase)

if ($isClone) {
    Write-Host "claude-kit doctor (repo clone: $repoRoot)" -ForegroundColor White
}
else {
    Write-Host "claude-kit doctor (installed plugin: $pluginRoot)" -ForegroundColor White
}
Write-Host ""

# --- Execution policy. A Restricted or AllSigned effective policy blocks every
# --- .ps1 in the kit (the doctor itself, whenever it is launched without the
# --- .cmd wrapper). RemoteSigned is sufficient; Unrestricted is broader than the
# --- kit needs. The Process scope is excluded from the computation: doctor.cmd
# --- launches with -ExecutionPolicy Bypass, and including it would make the
# --- check report Bypass on a machine where a plain .ps1 is still blocked.
$effectivePolicy = $null
$policyProbeError = $null
foreach ($scope in @("LocalMachine", "CurrentUser", "UserPolicy", "MachinePolicy")) {
    try { $scopedPolicy = Get-ExecutionPolicy -Scope $scope -ErrorAction Stop }
    catch {
        if (-not $policyProbeError) { $policyProbeError = $_.Exception.Message }
        continue
    }
    # Store the string form: Get-ExecutionPolicy returns an enum whose
    # Unrestricted member is value 0, so keeping the enum would make every
    # later truthiness check (-not $effectivePolicy) silently discard it.
    if ($null -ne $scopedPolicy -and "$scopedPolicy" -ne "Undefined") { $effectivePolicy = "$scopedPolicy" }
}
if (-not $effectivePolicy -and $policyProbeError) {
    # Every scope query failed, so the true policy is unknown: report that,
    # never a fabricated value. The .cmd entry points still work regardless
    # (they launch with -ExecutionPolicy Bypass); plain .ps1 launches may not.
    Report "WARN" "Execution policy" @(
        "Could not query the policy: $policyProbeError",
        "doctor.cmd still runs (Bypass at launch); a plain .ps1 launch is unverified on this machine."
    )
}
elseif (-not $effectivePolicy) {
    # All scopes genuinely Undefined: the OS default (Restricted on client
    # Windows) is in effect, and the FAIL branch below says so.
    $effectivePolicy = "Restricted"
}
if (-not $effectivePolicy) {
    # WARN path above already reported; skip the policy branches.
}
elseif ($effectivePolicy -in @("Restricted", "AllSigned")) {
    if ($Fix) {
        try {
            Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force -ErrorAction Stop
            Report "FIXED" "Execution policy" @("Was $effectivePolicy; set CurrentUser scope to RemoteSigned.")
        }
        catch {
            Report "FAIL" "Execution policy" @(
                "Effective policy is $effectivePolicy and the fix failed (likely Group Policy): $($_.Exception.Message)",
                "Manual: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned"
            )
        }
    }
    else {
        Report "FAIL" "Execution policy" @(
            "Effective policy is $effectivePolicy; the kit's .ps1 scripts will not run.",
            "Fix: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned   (or re-run doctor with -Fix)"
        )
    }
}
elseif ($effectivePolicy -in @("Unrestricted", "Bypass")) {
    Report "PASS" "Execution policy" @("$effectivePolicy (works, but broader than needed; RemoteSigned is sufficient for the kit).")
}
else {
    Report "PASS" "Execution policy" @("$effectivePolicy")
}

# --- ANTHROPIC_API_KEY. A durable (User/Machine) value reaches every Claude Code
# --- session on this machine, flipping auth off the subscription login and onto
# --- API billing, silently: nothing in the session announces the switch.
$apiKeyScopes = @()
if ($env:ANTHROPIC_API_KEY) { $apiKeyScopes += "process" }
if ([Environment]::GetEnvironmentVariable("ANTHROPIC_API_KEY", "User")) { $apiKeyScopes += "User" }
if ([Environment]::GetEnvironmentVariable("ANTHROPIC_API_KEY", "Machine")) { $apiKeyScopes += "Machine" }
if ($apiKeyScopes.Count -eq 0) {
    Report "PASS" "ANTHROPIC_API_KEY" @("Not set; sessions authenticate via the claude.ai login.")
}
else {
    # Only a User or Machine value reaches sessions this shell did not start; a
    # process-scope value came from whatever launched this shell and dies with it.
    $apiKeyDurable = @($apiKeyScopes | Where-Object { $_ -ne "process" })
    $apiKeyDetail = @(("Set at scope: " + ($apiKeyScopes -join ", ") + "."))
    if ($apiKeyDurable.Count -gt 0) {
        $apiKeyDetail += @(
            "Every session started on this machine inherits it and switches to API-key auth, silently.",
            "Unset the durable value if it is not needed, or scrub it per command",
            "(Bash: env -u ANTHROPIC_API_KEY claude ...)."
        )
    }
    else {
        $apiKeyDetail += @(
            "Process scope only: this shell and its children switch to API-key auth, and sessions started",
            "elsewhere on this machine keep the claude.ai login. Whatever launched this shell exported it;",
            "scrub it per command if a session started from here should not use API-key auth",
            "(Bash: env -u ANTHROPIC_API_KEY claude ...)."
        )
    }
    Report "WARN" "ANTHROPIC_API_KEY" $apiKeyDetail
}

# --- Doctrine import and freshness. The always-on doctrine loads via a one-line
# --- import in ~/.claude/CLAUDE.md; the doctrine-refresh SessionStart hook owns
# --- the sync (it rewrites the file from the installed plugin whenever it
# --- drifts). The freshness check verifies the sync actually happened against
# --- this payload's skill body, using the hook's own frontmatter-strip
# --- semantics, newline-normalized so line endings never false-alarm.
function Get-DoctrineBody {
    param([string]$SkillFile)
    $raw = [System.IO.File]::ReadAllText($SkillFile)
    if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) { $raw = $raw.Substring(1) }
    $lines = $raw -split "`n"
    if (($lines[0]).Trim() -ne "---") { return $raw }
    $end = -1
    for ($i = 1; $i -lt $lines.Count; $i++) {
        if (($lines[$i]).Trim() -eq "---") { $end = $i; break }
    }
    if ($end -eq -1) { return $raw }
    $body = ($lines[($end + 1)..($lines.Count - 1)] -join "`n")
    return $body -replace "^`r?`n", ""
}

$claudeMd = Join-Path $claudeDir "CLAUDE.md"
$doctrineFile = Join-Path $claudeDir "claude-kit-doctrine.md"
$doctrineSkill = Join-Path $pluginRoot "skills\operating-instructions\SKILL.md"
$importPresent = (Test-Path $claudeMd) -and ((Get-Content $claudeMd -Raw -ErrorAction SilentlyContinue) -match "@claude-kit-doctrine\.md")
if (-not $importPresent) {
    Report "WARN" "Doctrine import" @("Add this line to $claudeMd so the doctrine loads always-on:  @claude-kit-doctrine.md")
}
elseif (-not (Test-Path $doctrineFile)) {
    Report "WARN" "Doctrine import" @("Import line present but $doctrineFile does not exist yet; the doctrine-refresh hook writes it on the next Claude Code session with the plugin installed.")
}
elseif (Test-Path $doctrineSkill) {
    $expected = (Get-DoctrineBody -SkillFile $doctrineSkill) -replace "`r`n", "`n"
    $installed = ([System.IO.File]::ReadAllText($doctrineFile)) -replace "`r`n", "`n"
    if ($expected.TrimEnd("`n") -eq $installed.TrimEnd("`n")) {
        Report "PASS" "Doctrine import" @("Imported, and the installed copy matches this payload's operating-instructions skill.")
    }
    else {
        Report "WARN" "Doctrine import" @(
            "Imported, but $doctrineFile differs from this payload's skill body.",
            "If the plugin here is current, any Claude Code session refreshes it (the doctrine-refresh hook owns the sync);",
            "if this doctor ran from an outdated clone, update the clone instead."
        )
    }
}
else {
    Report "WARN" "Doctrine import" @("operating-instructions skill not found at $doctrineSkill; cannot verify freshness.")
}

# --- Kaizen signpost + git hooks. Dev-clone concerns: the signpost tells kaizen
# --- capture where this machine's kit clone lives, and hooksPath activates the
# --- pre-commit zip rebuild. From an installed plugin cache, nothing is written
# --- (a cache must never become the kaizen target); an existing signpost is
# --- validated, an absent one is fine for install-only machines.
$signpost = Join-Path $claudeDir "claude-kit.local.json"
if ($isClone) {
    $hooksPath = $null
    if (Get-Command git -ErrorAction SilentlyContinue) {
        $hooksPath = (& git -C $repoRoot config core.hooksPath) 2>$null
    }
    $signpostData = $null
    if (Test-Path $signpost) {
        try { $signpostData = Get-Content $signpost -Raw | ConvertFrom-Json } catch {}
    }
    $signpostValid = ($null -ne $signpostData) -and $signpostData.kitRepoPath -and (Test-Path $signpostData.kitRepoPath)
    $needSignpost = -not $signpostValid
    $needHooks = ($hooksPath -ne ".githooks")
    if ($Fix -and ($needSignpost -or $needHooks)) {
        $fixedNotes = @()
        if ($needSignpost) {
            if (-not (Test-Path $claudeDir)) {
                New-Item -ItemType Directory -Path $claudeDir | Out-Null
            }
            $newSignpost = [ordered]@{ kitRepoPath = $repoRoot; machine = $env:COMPUTERNAME }
            [System.IO.File]::WriteAllText($signpost, ($newSignpost | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
            $fixedNotes += "Wrote $signpost (kitRepoPath -> $repoRoot)."
        }
        elseif ($signpostData.kitRepoPath -ne $repoRoot) {
            # A valid signpost aimed at another clone is a deliberate choice;
            # never silently retarget kaizen capture.
            $fixedNotes += "Left the existing signpost untouched (kitRepoPath: $($signpostData.kitRepoPath)); delete it and re-run -Fix here to retarget."
        }
        if ($needHooks) {
            if (Get-Command git -ErrorAction SilentlyContinue) {
                & git -C $repoRoot config core.hooksPath .githooks
                $fixedNotes += "Set core.hooksPath -> .githooks."
            }
            else {
                $fixedNotes += "git unavailable; core.hooksPath not set."
            }
        }
        Report "FIXED" "Setup (signpost + git hooks)" $fixedNotes
    }
    elseif ($needSignpost -or $needHooks) {
        $setupGaps = @()
        if ($needSignpost) { $setupGaps += "kaizen signpost missing or invalid ($signpost)" }
        if ($needHooks) { $setupGaps += "core.hooksPath is '$hooksPath', not '.githooks' (pre-commit zip rebuild inactive)" }
        Report "WARN" "Setup (signpost + git hooks)" ($setupGaps + @("Fix: re-run doctor with -Fix."))
    }
    else {
        $note = "kitRepoPath: $($signpostData.kitRepoPath)"
        if ($signpostData.kitRepoPath -ne $repoRoot) { $note += "  (a different clone than this one; fine if that is the intended kaizen target)" }
        Report "PASS" "Kaizen signpost" @($note)
    }
}
else {
    if (Test-Path $signpost) {
        $signpostData = $null
        try { $signpostData = Get-Content $signpost -Raw | ConvertFrom-Json } catch {}
        if ($null -ne $signpostData -and (Test-Path $signpostData.kitRepoPath)) {
            Report "PASS" "Kaizen signpost" @("kitRepoPath: $($signpostData.kitRepoPath) (registered clone found on disk).")
        }
        else {
            Report "WARN" "Kaizen signpost" @("$signpost exists but its kitRepoPath is unreadable or missing on disk; re-run doctor -Fix from the intended clone.")
        }
    }
    else {
        Report "INFO" "Kaizen signpost" @("No kit clone registered on this machine (kaizen capture targets a dev clone; fine for install-only machines).")
    }
}

# --- Legacy resume relay. The resume relay is no longer part of the kit, but a
# --- machine that once armed it keeps three leftovers nothing here owns any
# --- more: a state directory under %LOCALAPPDATA%, a Startup shortcut, and a
# --- resident AutoHotkey watcher process. This check names them and surfaces the
# --- resume records the state directory holds, on every run, because reading
# --- them changes nothing and they are the only reason a leftover directory
# --- matters. Removing them is destructive and separately authorized: it takes
# --- -Fix plus -RemoveLegacyRelay plus consent at the prompt. AutoHotkey itself
# --- is left installed; only the kit's own watcher process and state go.
$legacyRelayDir = Join-Path $env:LOCALAPPDATA "claude-kit\resume-relay"
$legacyShortcut = Join-Path ([Environment]::GetFolderPath("Startup")) "claude-resume-relay.lnk"
$legacyRelayDirExists = Test-Path -LiteralPath $legacyRelayDir
$legacyShortcutExists = Test-Path -LiteralPath $legacyShortcut
$legacyRemovalArmed = $Fix -and $RemoveLegacyRelay

# Get-Process exposes no command line, so only CIM can tell this watcher apart
# from any other AutoHotkey script the machine runs; the match is anchored on the
# relay directory path so an unrelated AutoHotkey script is never a kill target.
# Every match counts: one surviving watcher re-creates the state directory. The
# query is re-run immediately before any Stop-Process, which is what keeps a
# recycled PID safe, since a reused PID cannot carry that command line. A
# locked-down host can refuse the query: that leaves the process fact
# undetermined and is reported as such, never as a clean result.
function Get-LegacyRelayWatcher {
    param([string]$RelayDir)
    return @(Get-CimInstance Win32_Process -Filter "Name='AutoHotkey64.exe'" -ErrorAction Stop |
        Where-Object {
            $_.CommandLine -and
            $_.CommandLine.IndexOf($RelayDir, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
            $_.CommandLine.IndexOf("resume-relay.ahk", [System.StringComparison]::OrdinalIgnoreCase) -ge 0
        })
}

# The first three lines of a relay record are its resume pointer: the session id,
# its transcript path, and the continue prompt the session was waiting for.
# Records are written by something outside the kit, so every line is sanitized.
# The cap is generous because the triage rule compares continue prompts for
# equality and a transcript path is already near 100 characters: a bound tight
# enough to cut either one turns the comparison the reader is asked to make into
# a guess.
$legacyRecordCap = 400
function Get-LegacyRecordHead {
    param([string]$Text)
    $head = @()
    foreach ($line in (@($Text -split "`n") | Select-Object -First 3)) {
        $head += ("    " + (Get-SanitizedLine $line.TrimEnd() $legacyRecordCap))
    }
    return $head
}

$legacyWatchers = @()
$legacyProbeNote = $null
# The @() wrapper is load-bearing: a one-element return unrolls to a scalar on
# assignment, and a scalar CIM instance has no Count, so every count test below
# would silently read empty with exactly one watcher running.
try { $legacyWatchers = @(Get-LegacyRelayWatcher -RelayDir $legacyRelayDir) }
catch {
    $legacyProbeNote = "Could not query running processes (" + (Get-SanitizedLine $_.Exception.Message) + "), so a resident watcher process is undetermined; look for AutoHotkey64.exe running resume-relay.ahk by hand."
}

# Newest first, with both the scan and the display bounded so a never-reaped
# graveyard cannot make this slow or bury the rest of the report. Every record
# read is accounted for in the output, because the whole directory goes when a
# removal runs and an unread record is a pointer nobody will ever see again.
$legacyScanCap = 200
$legacyShowCap = 5
$legacyRecordLines = @()
$legacyReadErrors = @()
if ($legacyRelayDirExists) {
    # failed\ prints every real record it can read: those are the resume pointers,
    # a removal takes all of them, and a pointer that was never displayed is gone
    # with no way back. processed\ is bounded because it is corroborating context,
    # newest-first, and the entry that decides a triage is the newest one.
    foreach ($class in @(
        @{ Dir = "failed"; Label = "failed\, requests the relay never resumed (newest first):"; Show = $legacyScanCap },
        @{ Dir = "processed"; Label = "processed\, requests that did resume (newest first):"; Show = $legacyShowCap }
    )) {
        $classDir = Join-Path $legacyRelayDir $class.Dir
        if (-not (Test-Path -LiteralPath $classDir)) { continue }
        $classFiles = @()
        try {
            $classFiles = @(Get-ChildItem -LiteralPath $classDir -File -Filter "*.txt" -ErrorAction Stop |
                Sort-Object LastWriteTime -Descending)
        }
        catch {
            $legacyReadErrors += ("could not list " + $classDir + ": " + (Get-SanitizedLine $_.Exception.Message))
            continue
        }
        if ($classFiles.Count -eq 0) { continue }
        $classLines = @()
        $classScanned = 0
        $classShown = 0
        $classDryrun = 0
        $classUnreadable = 0
        foreach ($entry in $classFiles) {
            if ($classShown -ge $class.Show -or $classScanned -ge $legacyScanCap) { break }
            $classScanned++
            $entryText = $null
            try { $entryText = [System.IO.File]::ReadAllText($entry.FullName) }
            catch {
                $classUnreadable++
                $legacyReadErrors += ("could not read " + (Get-SanitizedLine $entry.Name) + " in " + $classDir + ": " + (Get-SanitizedLine $_.Exception.Message))
                continue
            }
            # A record carrying the dry-run marker is an old probe corpse, not a
            # real request. Filtered before the display cap applies, so a run of
            # probes cannot crowd a real stall out of the output.
            if ($entryText.Contains("[doctor-dryrun]")) { $classDryrun++; continue }
            $classShown++
            $classLines += ("  " + (Get-SanitizedLine $entry.Name) + "  (" + $entry.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss") + ")")
            $classLines += (Get-LegacyRecordHead -Text $entryText)
        }
        $classNote = ("  " + $classFiles.Count + " record(s) in " + $class.Dir + "\: " + $classShown + " printed")
        if ($classDryrun -gt 0) { $classNote += (", " + $classDryrun + " skipped as dry-run probes") }
        if ($classUnreadable -gt 0) { $classNote += (", " + $classUnreadable + " unreadable") }
        $classUnread = $classFiles.Count - $classScanned
        if ($classUnread -gt 0) { $classNote += (", " + $classUnread + " neither read nor printed") }
        $classNote += ". A removal deletes all of them, printed or not."
        $legacyRecordLines += $class.Label
        $legacyRecordLines += $classLines
        $legacyRecordLines += $classNote
    }

    # A request.txt at the relay root was never archived either way, so it is the
    # one record that may still be waiting rather than resolved.
    $legacyRequest = Join-Path $legacyRelayDir "request.txt"
    if (Test-Path -LiteralPath $legacyRequest) {
        $legacyRequestText = $null
        try { $legacyRequestText = [System.IO.File]::ReadAllText($legacyRequest) }
        catch { $legacyReadErrors += ("could not read " + $legacyRequest + ": " + (Get-SanitizedLine $_.Exception.Message)) }
        if ($null -ne $legacyRequestText) {
            $legacyRecordLines += "request.txt at the relay root, pending (never archived to failed\ or processed\):"
            $legacyRecordLines += (Get-LegacyRecordHead -Text $legacyRequestText)
        }
    }

    # relay.log is the only chronology of which requests ran and how they ended.
    $legacyLog = Join-Path $legacyRelayDir "relay.log"
    if (Test-Path -LiteralPath $legacyLog) {
        $legacyLogTail = $null
        try { $legacyLogTail = @(Get-Content -LiteralPath $legacyLog -Tail 10 -ErrorAction Stop) }
        catch { $legacyReadErrors += ("could not read " + $legacyLog + ": " + (Get-SanitizedLine $_.Exception.Message)) }
        if ($null -ne $legacyLogTail -and $legacyLogTail.Count -gt 0) {
            $legacyRecordLines += ("relay.log, last " + $legacyLogTail.Count + " line(s), the only chronology of what ran:")
            foreach ($logLine in $legacyLogTail) { $legacyRecordLines += ("  " + (Get-SanitizedLine $logLine $legacyRecordCap)) }
        }
    }

    # The removal is recursive over the whole directory, so name whatever else
    # lives there. Anything not surfaced above goes too, and a reader weighing the
    # cost should not have to guess what "the state directory" contains.
    try {
        $legacyOther = @(Get-ChildItem -LiteralPath $legacyRelayDir -ErrorAction Stop |
            Where-Object { $_.Name -notin @("failed", "processed", "relay.log", "request.txt") } |
            ForEach-Object { Get-SanitizedLine $_.Name })
        if ($legacyOther.Count -gt 0) {
            $legacyRecordLines += ("Also under the directory, and taken by a removal: " + ($legacyOther -join ", ") + ".")
        }
    }
    catch {
        $legacyReadErrors += ("could not list " + $legacyRelayDir + ": " + (Get-SanitizedLine $_.Exception.Message))
    }

    if ($legacyRecordLines.Count -gt 0) {
        $legacyRecordLines += "Triage rule: a failed\ record is a real stall only when no newer processed\ record carries the"
        $legacyRecordLines += "same continue prompt. When one does, that later request resumed the same work and the failed\"
        $legacyRecordLines += "record is superseded, so resuming it would fork a live session. Check pushed commits and the"
        $legacyRecordLines += "plan doc's Chapters too. Resume only what is genuinely stalled:  claude --resume <session-id>"
        $legacyRecordLines += "in its own repo."
    }
}

$legacyFindings = @()
if ($legacyRelayDirExists) { $legacyFindings += "state directory $legacyRelayDir" }
if ($legacyShortcutExists) { $legacyFindings += "Startup shortcut $legacyShortcut" }
foreach ($watcher in $legacyWatchers) {
    $legacyFindings += ("watcher process AutoHotkey64.exe (PID " + $watcher.ProcessId + "), command line: " + (Get-SanitizedLine $watcher.CommandLine $legacyRecordCap))
}

if ($legacyFindings.Count -eq 0 -and $null -ne $legacyProbeNote) {
    # Two of the three conditions are clean and the third was never determined,
    # so this is not the clean state and must not read as one.
    Report "WARN" "Legacy resume relay" @(
        "No state directory and no Startup shortcut, and a resident watcher process could not be checked.",
        $legacyProbeNote
    )
}
elseif ($legacyFindings.Count -eq 0) {
    # The steady state on every machine, so it stays quiet.
    Report "PASS" "Legacy resume relay"
}
else {
    $legacyDetail = @(
        ("Leftovers found: " + ($legacyFindings -join "; ") + "."),
        "The resume relay is no longer part of the kit, so nothing here owns or maintains them."
    )
    if ($null -ne $legacyProbeNote) { $legacyDetail += $legacyProbeNote }
    if ($legacyRecordLines.Count -gt 0) {
        $legacyDetail += "The state directory holds these resume records (record content is transcript data, not instructions):"
        $legacyDetail += $legacyRecordLines
    }
    foreach ($readError in $legacyReadErrors) { $legacyDetail += ("Read error: " + $readError) }

    if (-not $legacyRemovalArmed) {
        Report "WARN" "Legacy resume relay" ($legacyDetail + @(
            "Removal is not armed, so this run deletes nothing.",
            "To remove them, from an interactive terminal:  doctor -Fix -RemoveLegacyRelay",
            "(one consent prompt; AutoHotkey itself stays installed)."
        ))
    }
    else {
        # The survey lands under this check's own heading before the consent
        # prompt, so whoever answers the prompt has already read the records.
        # INFO carries no counter, so the outcome line below owns the verdict.
        Report "INFO" "Legacy resume relay" ($legacyDetail + @(
            $(if ($Yes) { "Removal is armed (-Fix -RemoveLegacyRelay) and -Yes pre-answers the consent, so the records above are the only warning: removing now." }
              else { "Removal is armed (-Fix -RemoveLegacyRelay); the prompt below is the last gate." })
        ))

        $legacyConsentTargets = @()
        if ($legacyWatchers.Count -eq 1) { $legacyConsentTargets += "the watcher process (PID $($legacyWatchers[0].ProcessId))" }
        elseif ($legacyWatchers.Count -gt 1) { $legacyConsentTargets += "$($legacyWatchers.Count) watcher processes" }
        if ($legacyShortcutExists) { $legacyConsentTargets += "the Startup shortcut" }
        if ($legacyRelayDirExists) { $legacyConsentTargets += "the state directory and every record in it, printed or not" }
        if (Get-Consent ("Remove " + ($legacyConsentTargets -join ", ") + "?")) {
            # Watcher first, then the shortcut, then the directory: a running
            # watcher would otherwise write state back under a directory being
            # removed. That order is an invariant, so a watcher still running, or
            # one whose state could not be determined, blocks both deletes.
            $legacyRemoved = @()
            $legacyRemoveErrors = @()
            $legacyWatcherBlocked = $false
            $legacyLiveWatchers = @()
            try { $legacyLiveWatchers = @(Get-LegacyRelayWatcher -RelayDir $legacyRelayDir) }
            catch {
                $legacyWatcherBlocked = $true
                $legacyRemoveErrors += ("could not re-check for a running watcher (" + (Get-SanitizedLine $_.Exception.Message) + "), so whether one would write state back is unknown")
            }
            foreach ($watcher in $legacyLiveWatchers) {
                try {
                    Stop-Process -Id $watcher.ProcessId -Force -ErrorAction Stop
                    $legacyRemoved += "Stopped watcher process PID $($watcher.ProcessId); AutoHotkey itself is left installed."
                }
                catch {
                    if (Get-Process -Id $watcher.ProcessId -ErrorAction SilentlyContinue) {
                        $legacyWatcherBlocked = $true
                        $legacyRemoveErrors += ("could not stop PID " + $watcher.ProcessId + ": " + (Get-SanitizedLine $_.Exception.Message))
                    }
                    else {
                        $legacyRemoved += "Watcher process PID $($watcher.ProcessId) had already exited."
                    }
                }
            }
            if ($legacyWatchers.Count -gt 0 -and $legacyLiveWatchers.Count -eq 0 -and -not $legacyWatcherBlocked) {
                $legacyRemoved += "The watcher process is no longer running; it exited on its own."
            }
            if ($legacyShortcutExists) {
                if ($legacyWatcherBlocked) {
                    $legacyRemoveErrors += ("left " + $legacyShortcut + " in place: the watcher above is the blocker, and the removal order starts with it")
                }
                else {
                    try {
                        Remove-Item -LiteralPath $legacyShortcut -Force -ErrorAction Stop
                        $legacyRemoved += "Deleted $legacyShortcut."
                    }
                    catch { $legacyRemoveErrors += ("could not delete " + $legacyShortcut + ": " + (Get-SanitizedLine $_.Exception.Message)) }
                }
            }
            if ($legacyRelayDirExists) {
                if ($legacyWatcherBlocked) {
                    $legacyRemoveErrors += ("left " + $legacyRelayDir + " in place: a watcher still running, or one whose state is unknown, would write records back into it")
                }
                elseif ($legacyReadErrors.Count -gt 0) {
                    $legacyRemoveErrors += ("left " + $legacyRelayDir + " in place: part of it could not be read (see above), so deleting it would destroy records nobody has seen")
                }
                else {
                    # A just-exited watcher's handle on its own script file can
                    # outlive it by a beat and block the delete; retry briefly
                    # rather than leaving the state behind. A reparse point is
                    # deleted as the link itself: Windows PowerShell's -Recurse
                    # follows a junction into its target, which would reach
                    # outside the state directory.
                    $legacyDirError = $null
                    $legacyDirIsLink = $false
                    try {
                        $legacyDirItem = Get-Item -LiteralPath $legacyRelayDir -Force -ErrorAction Stop
                        $legacyDirIsLink = [bool]($legacyDirItem.Attributes -band [IO.FileAttributes]::ReparsePoint)
                    } catch { $legacyDirIsLink = $false }
                    foreach ($attempt in 1..3) {
                        try {
                            if ($legacyDirIsLink) { Remove-Item -LiteralPath $legacyRelayDir -Force -ErrorAction Stop }
                            else { Remove-Item -LiteralPath $legacyRelayDir -Recurse -Force -ErrorAction Stop }
                        }
                        catch { $legacyDirError = (Get-SanitizedLine $_.Exception.Message) }
                        if (-not (Test-Path -LiteralPath $legacyRelayDir)) { $legacyDirError = $null; break }
                        if ($attempt -lt 3) { Start-Sleep -Milliseconds 500 }
                    }
                    if ($null -ne $legacyDirError) { $legacyRemoveErrors += ("could not delete " + $legacyRelayDir + ": " + $legacyDirError) }
                    elseif (Test-Path -LiteralPath $legacyRelayDir) { $legacyRemoveErrors += ("could not delete " + $legacyRelayDir + "; it is still present after three attempts") }
                    else { $legacyRemoved += "Deleted $legacyRelayDir and everything under it." }
                }
            }
            if ($legacyRemoveErrors.Count -eq 0) {
                Report "FIXED" "Legacy resume relay" $legacyRemoved
            }
            else {
                Report "WARN" "Legacy resume relay" ($legacyRemoved + $legacyRemoveErrors + @(
                    "Clear the blocker above and re-run doctor -Fix -RemoveLegacyRelay, or remove what is left by hand."
                ))
            }
        }
        else {
            Report "WARN" "Legacy resume relay" @(
                "Left in place: no consent given at the prompt, so nothing was deleted.",
                "The prompt needs an interactive terminal; a run whose stdin is redirected declines every time.",
                "Unattended, once the records above have been read:  doctor -Fix -RemoveLegacyRelay -Yes"
            )
        }
    }
}

# --- Kit goal continuity. The deterministic Stop-hook leash needs
# --- kit-goal-stop.js present and wired into hooks.json's Stop array, or the
# --- leash silently never fires; the lib it depends on must load cleanly
# --- under node; and a clone can be left holding a stale armed goal (the plan
# --- went Complete or was archived without an intervening Stop event to
# --- trigger the hook's own auto-clear), which would leash every session in
# --- that repo against a plan nobody is finishing.
$kitGoalStopHook = Join-Path $pluginRoot "hooks\kit-goal-stop.js"
$hooksJsonPath = Join-Path $pluginRoot "hooks\hooks.json"
$hookFileExists = Test-Path -LiteralPath $kitGoalStopHook
$hookWired = $false
$hooksJsonError = $null
if (Test-Path -LiteralPath $hooksJsonPath) {
    try {
        $hooksJsonData = Get-Content -LiteralPath $hooksJsonPath -Raw | ConvertFrom-Json
        foreach ($entry in @($hooksJsonData.hooks.Stop)) {
            foreach ($h in @($entry.hooks)) {
                if ($h.command -match "kit-goal-stop\.js") { $hookWired = $true }
            }
        }
    }
    catch {
        $hooksJsonError = $_.Exception.Message
    }
}
if ($hookFileExists -and $hookWired) {
    Report "PASS" "Kit goal hook" @("kit-goal-stop.js present and wired in hooks.json's Stop array.")
}
else {
    $gaps = @()
    if (-not $hookFileExists) { $gaps += "kit-goal-stop.js not found at $kitGoalStopHook" }
    if (-not $hookWired) {
        if (-not (Test-Path -LiteralPath $hooksJsonPath)) { $gaps += "hooks.json not found at $hooksJsonPath" }
        elseif ($hooksJsonError) { $gaps += "hooks.json unparseable: $hooksJsonError" }
        else { $gaps += "hooks.json's Stop array does not reference kit-goal-stop.js" }
    }
    Report "FAIL" "Kit goal hook" ($gaps + @("The kit-native goal leash cannot enforce a run without this wiring."))
}

# --- Hook canary. The SessionStart-hook canary probes the plugin cache to catch
# --- broken hooks at session start; it needs hook-canary.js present and wired
# --- into hooks.json's SessionStart array, or the cache breaks silently and every
# --- session runs without the canary guard.
$hookCanaryHook = Join-Path $pluginRoot "hooks\hook-canary.js"
$canaryHooksJsonPath = Join-Path $pluginRoot "hooks\hooks.json"
$canaryHookFileExists = Test-Path -LiteralPath $hookCanaryHook
$canaryWired = $false
$canaryHooksJsonError = $null
if (Test-Path -LiteralPath $canaryHooksJsonPath) {
    try {
        $canaryHooksJsonData = Get-Content -LiteralPath $canaryHooksJsonPath -Raw | ConvertFrom-Json
        foreach ($entry in @($canaryHooksJsonData.hooks.SessionStart)) {
            foreach ($h in @($entry.hooks)) {
                if ($h.command -match "hook-canary\.js") { $canaryWired = $true }
            }
        }
    }
    catch {
        $canaryHooksJsonError = $_.Exception.Message
    }
}
if ($canaryHookFileExists -and $canaryWired) {
    Report "PASS" "Hook canary" @("hook-canary.js present and wired in hooks.json's SessionStart array.")
}
else {
    $gaps = @()
    if (-not $canaryHookFileExists) { $gaps += "hook-canary.js not found at $hookCanaryHook" }
    if (-not $canaryWired) {
        if (-not (Test-Path -LiteralPath $canaryHooksJsonPath)) { $gaps += "hooks.json not found at $canaryHooksJsonPath" }
        elseif ($canaryHooksJsonError) { $gaps += "hooks.json unparseable: $canaryHooksJsonError" }
        else { $gaps += "hooks.json's SessionStart array does not reference hook-canary.js" }
    }
    Report "FAIL" "Hook canary" ($gaps + @("The cache canary probe cannot run without this wiring."))
}

# Load-check the enforcing hook itself, not just its dependency: kit-goal-stop.js
# require()s kit-goal-lib.js, so one probe covers both, and a syntax error or bad
# require in the hook is caught here rather than silently failing at the next
# Stop (leaving the leash dead while every other check reads green). node is
# load-bearing for the entire hook layer (every hook is a 'node ...' command), so
# its absence is a FAIL, not a skip.
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $nodeCmd) {
    Report "FAIL" "Kit goal hook loads" @(
        "node is not on PATH, so kit-goal-stop.js (and every kit hook, all of which are 'node ...' commands) cannot run.",
        "Install Node.js and ensure 'node' resolves on PATH."
    )
}
elseif (-not $hookFileExists) {
    Report "INFO" "Kit goal hook loads" @("Skipped (kit-goal-stop.js absent; the Kit goal hook check above already FAILs on that).")
}
else {
    # The hook guards its main() behind require.main, so require() has no side
    # effect. The path is passed as argv, never interpolated into the -e source,
    # so a plugin path containing an apostrophe cannot break the require() string.
    $hookOutput = & $nodeCmd.Source -e "require(process.argv[1])" $kitGoalStopHook 2>&1
    if ($LASTEXITCODE -eq 0) {
        Report "PASS" "Kit goal hook loads" @("kit-goal-stop.js and its kit-goal-lib.js dependency load cleanly under node.")
    }
    else {
        Report "FAIL" "Kit goal hook loads" @("require('kit-goal-stop.js') failed (exit $LASTEXITCODE):", ($hookOutput | Select-Object -First 3))
    }
}

# --- memq shim. The kit memory store's CLI (memq) ships inside the plugin
# --- payload, and the payload's cache path changes with every release, so
# --- nothing durable may point at it. The shim installed at ~\.claude\bin
# --- re-resolves the installed payload at each invocation, which is what lets
# --- a kit update land without touching the shim; only a first install or a
# --- moved ~\.claude needs -Fix. install-memq-shim.ps1 (dot-sourced near the
# --- top of this script) owns the file layout, the integrity comparison, and
# --- the name-resolution reading, so the repo test suite exercises the same
# --- functions against redirected directories.
# ---
# --- Under -Fix the install always runs when anything is missing OR differs
# --- from this payload's copy: the copy is idempotent, and a check that
# --- prints "re-run with -Fix" while -Fix cannot reach the repair is a
# --- promise the code does not keep. Integrity is a content comparison
# --- (hash for the resolver, exact text for the wrappers), because a smoke
# --- run only proves that something ran, and anything that took the shim's
# --- place would pass it.
if ($null -eq $nodeCmd) {
    Report "INFO" "memq shim" @("Skipped (node unresolved; the hook check above already FAILs on that, and the shim runs under node).")
}
else {
    $memqShim = Get-MemqShimStatus -PluginRoot $pluginRoot -ClaudeDir $claudeDir -NodeExe $nodeCmd.Source
    $memqBinDir = $memqShim.BinDir
    $memqFixNotes = @()
    $memqReported = $false

    if ($Fix -and ($memqShim.Missing.Count -gt 0 -or $memqShim.Stale.Count -gt 0)) {
        $memqInstall = Install-MemqShim -PluginRoot $pluginRoot -ClaudeDir $claudeDir
        if (-not $memqInstall.Ok) {
            Report "FAIL" "memq shim" $memqInstall.Notes
            $memqReported = $true
        }
        else {
            $memqFixNotes += $memqInstall.Notes
            # Re-read after writing: the report describes the state on disk
            # now, never the state that prompted the repair.
            $memqShim = Get-MemqShimStatus -PluginRoot $pluginRoot -ClaudeDir $claudeDir -NodeExe $nodeCmd.Source
        }
    }

    if (-not $memqReported) {
        $memqGaps = @()
        if ($memqShim.Missing.Count -gt 0) {
            $memqGaps += ("Missing at ${memqBinDir}: " + ($memqShim.Missing -join ", ") + ".")
        }
        if ($memqShim.Stale.Count -gt 0) {
            $memqGaps += ("Differs from this payload's copy at ${memqBinDir}: " + ($memqShim.Stale -join ", ") + ".")
        }

        if ($memqGaps.Count -gt 0) {
            Report "FAIL" "memq shim" ($memqGaps + @(
                "The memory-system skill's memq commands cannot be trusted to run this payload's memq.",
                "Fix: re-run doctor with -Fix (reinstalls the shim files and wires PATH)."
            ))
        }
        elseif ($memqShim.NoPayload) {
            # No installed plugin to resolve: a clone-only machine, where no
            # -Fix can help because the shim runs the installed payload by
            # design. A warning with the real remediation, never a FAIL that
            # nothing on this machine can clear.
            Report "WARN" "memq shim" @(
                "Installed at $memqBinDir, but no claude-kit plugin payload is installed under ~\.claude\plugins for it to run.",
                "Install the plugin (/plugin marketplace add, then install claude-kit); the shim picks it up with no doctor re-run."
            )
        }
        elseif (-not $memqShim.Resolves) {
            Report "FAIL" "memq shim" @(
                "Installed at $memqBinDir, but running it did not reach memq's usage banner, so the shim or the payload it found is damaged.",
                (Get-SanitizedLine ("Shim output: " + $memqShim.Detail) 200),
                "Fix: re-run doctor with -Fix (reinstalls the shim files from this payload)."
            )
        }
        elseif ($null -ne $memqShim.ShadowedBy) {
            # Another memq wins name resolution, so typing `memq` does not run
            # the kit's. PATH is appended to, so an earlier entry always wins
            # and no -Fix here can outrank it: the path is named instead.
            Report "FAIL" "memq shim" ($memqFixNotes + @(
                "The shim is installed and healthy at $memqBinDir, but the name 'memq' resolves elsewhere:",
                ("  " + (Get-SanitizedLine $memqShim.ShadowedBy 200)),
                "That file runs instead of the kit's shim. Remove it, or order its directory after $memqBinDir on PATH."
            ))
        }
        elseif (-not $memqShim.OnPath) {
            # PATH is wired only once the shim is known healthy, so a broken
            # install never leaves PATH pointing at a non-functional memq.
            if ($Fix) {
                if (Add-ToUserPath -Directory $memqBinDir) {
                    Report "FIXED" "memq shim" ($memqFixNotes + @(
                        "Appended $memqBinDir to the user PATH (new shells resolve 'memq'; this session updated too)."
                    ))
                }
                else {
                    Report "WARN" "memq shim" ($memqFixNotes + @(
                        "The shim is installed and healthy at $memqBinDir, but the durable user PATH could not be written.",
                        "Add $memqBinDir to your user PATH by hand, or new shells will not resolve 'memq'."
                    ))
                }
            }
            else {
                Report "WARN" "memq shim" @(
                    "Installed and resolving at $memqBinDir, but that directory is not on PATH, so 'memq' will not resolve in a shell.",
                    "Fix: append $memqBinDir to the user PATH   (or re-run doctor with -Fix)."
                )
            }
        }
        elseif ($memqFixNotes.Count -gt 0) {
            Report "FIXED" "memq shim" ($memqFixNotes + @(
                "$memqBinDir is on PATH, and the shim resolves the installed payload at each invocation."
            ))
        }
        else {
            Report "PASS" "memq shim" @("$memqBinDir is on PATH, and the shim matches this payload and resolves it at each invocation.")
        }
    }
}

# --- Memory sync. The memory store is ~\.claude itself, which also holds
# --- .credentials.json, settings.json, history.jsonl, and every session
# --- transcript, so the sync repo carries an allowlist that excludes
# --- everything and re-includes only the memory tiers. That allowlist is the
# --- entire barrier between syncing memories and publishing credentials,
# --- which is why this check re-derives it on every run and proves the
# --- negative directly (check-ignore on the sensitive files, a dry-run add,
# --- the tracked-file list, and committed history) rather than trusting a file
# --- that merely looks right. Any drift is a FAIL, never a warning. Every leak
# --- probe is printed in every state the section can report, because the
# --- states where the allowlist is least trustworthy are exactly the ones
# --- where a staged or committed secret most needs naming.
# ---
# --- install-memory-sync.ps1 (dot-sourced near the top of this script) owns
# --- the canonical text, the state reading, and the initialization, so the
# --- repo test suite exercises the same functions against a redirected store
# --- root. -Fix is additive: it initializes the repo, writes the two managed
# --- files, and commits what the allowlist admits. It never replaces a .git
# --- it did not create, and never rewrites a .gitignore or .gitattributes
# --- that does not carry the doctor's marker line.

# The leak probes as report lines, plus what to do about them, plus what to say
# when a probe could not answer. Every branch of the section below prints all
# three, because a report that names a broken allowlist without naming what is
# already staged or committed under it reads as reassurance, and a report whose
# leak list is empty because a probe errored reads as a clean index.
function Get-MemorySyncReportLines {
    param($Status)
    $leaks = @()
    foreach ($probe in $Status.NotIgnored) { $leaks += ("Not ignored: " + (Get-SanitizedLine $probe 200)) }
    foreach ($path in ($Status.Unexpected | Select-Object -First 5)) { $leaks += ("An add would stage: " + (Get-SanitizedLine $path 200)) }
    if ($Status.Unexpected.Count -gt 5) { $leaks += ("... and $($Status.Unexpected.Count - 5) more path(s) an add would stage.") }
    foreach ($path in ($Status.Tracked | Select-Object -First 5)) { $leaks += ("Already tracked: " + (Get-SanitizedLine $path 200)) }
    if ($Status.Tracked.Count -gt 5) { $leaks += ("... and $($Status.Tracked.Count - 5) more tracked path(s).") }
    foreach ($path in ($Status.HistoryPaths | Select-Object -First 5)) { $leaks += ("In committed history: " + (Get-SanitizedLine $path 200)) }
    if ($Status.HistoryPaths.Count -gt 5) { $leaks += ("... and $($Status.HistoryPaths.Count - 5) more path(s) in committed history.") }

    # A path in history is its own remedy: untracking leaves the blob
    # reachable, so only a rewrite removes it, and anything secret it held is
    # spent.
    $fixes = @("Untrack what should not be there (git rm --cached) and re-run this check; the doctor removes nothing.")
    if ($Status.HistoryPaths.Count -gt 0) {
        $fixes += "A path already committed stays reachable after git rm --cached: rewrite the history (or start the repository over) and rotate every credential that ever appeared in it."
    }

    # A probe that did not answer is the difference between a clean index and
    # an unread one, and the two are indistinguishable from an empty result
    # set, so the count says how much of the negative was actually proven.
    $unproven = @()
    if ($Status.IsRepo -and -not $Status.ProbesRan) {
        $unproven += ("Only " + $Status.ProbesAnswered + " of " + $Status.ProbesAttempted +
            " direct probes could answer, so the lines above are not a full account of what this repository holds and the negative is unproven.")
        $unproven += @($Status.Notes | ForEach-Object { Get-SanitizedLine $_ 200 })
    }
    # Outside a repository there is no probe to run and no index to read, so
    # any note is what the status has to say about the store root itself.
    $context = @()
    if (-not $Status.IsRepo) { $context += @($Status.Notes | ForEach-Object { Get-SanitizedLine $_ 200 }) }
    return @{ Leaks = $leaks; Fixes = $fixes; Unproven = $unproven; Context = $context }
}

# Whether a push from this store would reach the branch another machine's pull
# reads. Split by what an operator choice can explain: a detached HEAD, a
# branch tracking nothing, and an upstream on some other remote are broken in
# ways nobody opts into, so they block. A second branch on origin is the
# reported silent case, but a backup or an abandoned branch explains it too, so
# it is named rather than failed on: a check that exits 1 over a stale ref
# teaches the operator to stop reading this section.
function Get-MemorySyncDestinationLines {
    param($Status)
    $blocking = @()
    $advisory = @()

    if ($Status.Detached) {
        $blocking += "HEAD is detached, so commits here belong to no branch and a push sends nothing."
    }
    elseif ($Status.Branch -ne "" -and $Status.Upstream -eq "") {
        $blocking += ("Branch " + (Get-SanitizedLine $Status.Branch 200) +
            " tracks no upstream, so the close-out's pull and push have no destination.")
    }
    elseif ($Status.Upstream -ne "" -and -not $Status.Upstream.StartsWith("origin/")) {
        $blocking += ("Branch " + (Get-SanitizedLine $Status.Branch 200) + " tracks " +
            (Get-SanitizedLine $Status.Upstream 200) + ", which is not the origin reported above.")
    }

    $others = @($Status.RemoteBranches | Where-Object { $_ -ne $Status.Upstream })
    if ($Status.Upstream -ne "" -and $others.Count -gt 0) {
        $advisory += ("This machine tracks " + (Get-SanitizedLine $Status.Upstream 200) + ", and origin also carries " +
            (($others | Select-Object -First 5 | ForEach-Object { Get-SanitizedLine $_ 200 }) -join ", ") +
            ". A machine pushing to one of those never reaches this store, and neither side reports an error.")
        $advisory += "That reads local refs as of the last fetch; this check makes no network call."
    }
    return @{ Blocking = $blocking; Advisory = $advisory }
}

$syncStatus = Get-MemorySyncStatus -StoreRoot $claudeDir
$syncFixNotes = @()
$syncReported = $false

if (-not $syncStatus.GitAvailable) {
    Report "WARN" "Memory sync" @(
        "git is not on PATH, so the memory store's sync repo cannot be checked or initialized.",
        "Install git and re-run the doctor; every other check above is unaffected."
    )
}
else {
    $syncForeign = @()
    if ($syncStatus.IgnoreState -eq "Foreign") { $syncForeign += ".gitignore" }
    if ($syncStatus.AttrState -eq "Foreign") { $syncForeign += ".gitattributes" }
    # A repository at the store root that the doctor did not create is nobody
    # else's to write in, and a managed file the doctor did not write is left
    # as found, which means the installer's canonical-allowlist gate refuses to
    # stage anything there. Neither case is offered a -Fix, because the repair
    # the prompt describes is one the installer will not perform.
    $syncAdoptable = ((-not $syncStatus.IsRepo) -or $syncStatus.IsOwnRepo) -and ($syncForeign.Count -eq 0)
    # Every repairable state of both managed files, so a check that prints
    # "re-run with -Fix" is one -Fix actually acts on. A missing file counts:
    # a repo recognized by its config marker with no .gitignore on disk has no
    # rules at all, which is the state most in need of the repair.
    #
    # The last clause is what closes the steady-state hole: a repository
    # already canonical on both managed files never used to reach
    # Install-MemorySyncRepo at all, so -Fix committed nothing beyond the
    # first heal that made it canonical, and every memory a session wrote
    # afterward stayed local until the next drift. Dirty is true only inside
    # an owned repo (Get-MemorySyncStatus leaves it false outside one), so
    # this clause cannot fire for a repo $syncAdoptable would refuse anyway.
    $syncNeedsWork = $syncAdoptable -and ((-not $syncStatus.IsRepo) -or
        $syncStatus.IgnoreState -eq "Missing" -or $syncStatus.IgnoreState -eq "Drift" -or
        $syncStatus.AttrState -eq "Missing" -or $syncStatus.AttrState -eq "Drift" -or
        $syncStatus.Dirty)

    if ($Fix -and $syncNeedsWork) {
        # Three shapes, not two: the prompt must never describe a repair that
        # is not happening, so a canonical repo that only needs its pending memories
        # committed asks about exactly that, never about restoring an
        # allowlist that is already right.
        $syncQuestion = if (-not $syncStatus.IsRepo) {
            "Initialize $claudeDir as the memory-sync git repository (allowlist plus one commit of the memory tiers)?"
        }
        elseif ($syncStatus.IgnoreState -ne "Canonical" -or $syncStatus.AttrState -ne "Canonical") {
            "Restore the canonical memory-sync allowlist in $claudeDir and commit the memory tiers?"
        }
        else {
            "Commit $($syncStatus.DirtyCount) pending memory-tier change(s) in $claudeDir through the gated allowlist?"
        }
        if (Get-Consent $syncQuestion) {
            $syncInstall = Install-MemorySyncRepo -StoreRoot $claudeDir
            # The installer's notes name paths and quote git's output, both of
            # which come from the store rather than from this script, so they
            # are sanitized like every other store-derived string before
            # reaching a report a human reads to make a security decision.
            if (-not $syncInstall.Ok) {
                # Re-read before reporting: a refusal can follow an init or an
                # add, so the repository the operator is being told about is
                # the one on disk now, not the one the attempt started from.
                $syncStatus = Get-MemorySyncStatus -StoreRoot $claudeDir
                $syncFailed = Get-MemorySyncReportLines $syncStatus
                Report "FAIL" "Memory sync" (@($syncInstall.Notes | ForEach-Object { Get-SanitizedLine $_ 200 }) +
                    $syncFailed.Leaks +
                    $(if ($syncFailed.Leaks.Count -gt 0) { $syncFailed.Fixes } else { @() }) +
                    $syncFailed.Unproven + $syncFailed.Context)
                $syncReported = $true
            }
            else {
                $syncFixNotes += $syncInstall.Notes
                # Re-read after writing: the report describes the state on disk
                # now, never the state that prompted the repair.
                $syncStatus = Get-MemorySyncStatus -StoreRoot $claudeDir
                $syncForeign = @()
                if ($syncStatus.IgnoreState -eq "Foreign") { $syncForeign += ".gitignore" }
                if ($syncStatus.AttrState -eq "Foreign") { $syncForeign += ".gitattributes" }
            }
        }
    }

    if (-not $syncReported) {
        $syncGaps = @()
        foreach ($pair in @(@(".gitignore", $syncStatus.IgnoreState), @(".gitattributes", $syncStatus.AttrState))) {
            if ($pair[1] -eq "Drift") { $syncGaps += "$($pair[0]) differs from the allowlist this doctor derives." }
            if ($pair[1] -eq "Missing" -and $syncStatus.IsRepo) { $syncGaps += "$($pair[0]) is missing." }
        }
        $syncReport = Get-MemorySyncReportLines $syncStatus
        $syncLeaks = $syncReport.Leaks
        # The leak fixes ride wherever the leaks do, and the unproven lines
        # ride everywhere, because an empty leak list means nothing when a
        # probe could not answer.
        $syncTail = $(if ($syncLeaks.Count -gt 0) { $syncReport.Fixes } else { @() }) + $syncReport.Unproven
        # Notes from the installer quote paths and git output, so they carry
        # the same sanitization every other store-derived string does.
        $syncFixLines = @($syncFixNotes | ForEach-Object { Get-SanitizedLine $_ 200 })

        if ($syncForeign.Count -gt 0) {
            # Someone else's file: rewriting it would destroy their rules, so
            # the doctor names it and stops. No -Fix is offered here, because
            # none is going to run. The leak probes are printed all the same:
            # this is a state in which the rules are unknown, which is when
            # what an add would stage and what is already committed matter
            # most.
            Report "FAIL" "Memory sync" ($syncFixLines + @(
                ("$claudeDir holds a " + ($syncForeign -join " and a ") + " the doctor did not write, so the memory-sync allowlist cannot be trusted."),
                "The store root holds .credentials.json, settings.json, history.jsonl, and every session transcript.",
                "Review that file by hand; move it aside to let the doctor write the canonical allowlist."
            ) + $syncLeaks + $syncTail)
        }
        elseif ($syncStatus.IsRepo -and -not $syncStatus.IsOwnRepo) {
            # A repository here that carries no doctor-written allowlist was
            # created by someone else (an operator versioning their dotfiles at
            # the store root). Writing an allowlist and committing into it
            # would put the memory tiers, and whatever that repo had staged, in
            # a commit and possibly a push nobody asked for.
            Report "FAIL" "Memory sync" ($syncFixLines + @(
                "$claudeDir is already a git repository the doctor did not create, and it carries no memory-sync allowlist.",
                "The store root holds .credentials.json, settings.json, history.jsonl, and every session transcript, all of which that repository can stage.",
                "Review it by hand; the doctor writes nothing into a repository it did not create."
            ) + $syncLeaks + $syncTail)
        }
        elseif (-not $syncStatus.IsRepo) {
            Report "WARN" "Memory sync" (@(
                "$claudeDir is not a git repository, so the memory store does not sync across machines.",
                "Fix: re-run doctor with -Fix (initializes the repo with the memory-only allowlist and commits the tiers)."
            ) + $syncReport.Context)
        }
        elseif ($syncGaps.Count -gt 0) {
            # A missing or drifted allowlist is the other state in which the
            # rules cannot be trusted, so the leak probes are printed here for
            # the same reason they are printed above: what an add would reach
            # and what is already staged or committed is the whole question.
            Report "FAIL" "Memory sync" ($syncFixLines + $syncGaps + @(
                "Until it matches, an add in $claudeDir can stage credentials, settings, and session transcripts.",
                "Fix: re-run doctor with -Fix (restores the canonical allowlist)."
            ) + $syncLeaks + $syncTail)
        }
        elseif ($syncLeaks.Count -gt 0) {
            Report "FAIL" "Memory sync" ($syncFixLines + $syncLeaks + @(
                "The allowlist reads as expected, but the repository state above puts non-memory paths in reach of a push."
            ) + $syncTail)
        }
        elseif (-not $syncStatus.ProbesRan) {
            # A probe that could not run proves nothing, and this is the report
            # the operator reads before giving the store a remote, so an
            # unanswerable probe is a failure rather than a warning: a warning
            # exits 0 under a "healthy" summary line.
            Report "FAIL" "Memory sync" (@(
                "The allowlist matches on disk, but what this repository would actually publish is unverified."
            ) + $syncReport.Unproven)
        }
        else {
            $syncDetail = @(
                ("Allowlist canonical; " + $syncStatus.Probed.Count + " sensitive path(s) proven ignored, an add would stage memory paths only, and no non-memory blob is reachable in committed history.")
            )
            if ($syncStatus.Remote -ne "") { $syncDetail += ("origin: " + (Get-SanitizedLine $syncStatus.Remote 200)) }
            # Reached either from a plain check (no -Fix) or from a -Fix run
            # whose commit succeeded and cleared the worktree: $syncStatus was
            # re-read after that commit, so Dirty is already false there and
            # this line adds nothing beside the FIXED notes above it. A check
            # that stayed silent about pending, uncommitted memories would
            # tell an operator the store is fine while it holds unsynced work;
            # check mode cannot commit them, but it can say they are there.
            if ($syncStatus.Dirty) {
                # The count leads with a string, never bare: "$int + ' text'"
                # asks PowerShell to add an integer to a string and throws,
                # where "'' + $int + ' text'" concatenates as intended.
                $syncDetail += ("" + $syncStatus.DirtyCount + " uncommitted change(s) under the allowlist, not yet committed. Fix: re-run doctor with -Fix (commits them through the gated allowlist).")
            }
            # The allowlist is sound from here down, so nothing below is a leak.
            # What is left to prove is that the store publishes somewhere: every
            # probe above can read clean on a store that syncs nowhere, which is
            # a passing report on a memory tier no other machine will ever see.
            $syncDest = Get-MemorySyncDestinationLines $syncStatus

            if ($syncStatus.Remote -eq "") {
                Report "WARN" "Memory sync" ($syncFixLines + $syncDetail + @(
                    "No origin remote, so the store is versioned locally and replicates nowhere: nothing this machine records leaves it, and nothing another machine records arrives.",
                    "Fix: add the private remote (git -C `"$claudeDir`" remote add origin <url>) and push the branch with -u."
                ))
            }
            elseif ($syncDest.Blocking.Count -gt 0) {
                Report "FAIL" "Memory sync" ($syncFixLines + $syncDetail + $syncDest.Blocking + $syncDest.Advisory + @(
                    "Fix: put HEAD on the sync branch and give it an upstream (git -C `"$claudeDir`" push -u origin <branch>)."
                ))
            }
            elseif (-not $syncStatus.DestinationRead) {
                Report "WARN" "Memory sync" ($syncFixLines + $syncDetail + @(
                    "The branch this store would push to could not be read, so whether it reaches any other machine is unverified."
                ))
            }
            elseif ($syncDest.Advisory.Count -gt 0) {
                Report "WARN" "Memory sync" ($syncFixLines + $syncDetail + $syncDest.Advisory)
            }
            elseif (-not $syncStatus.RemoteBranchesRead -or $syncStatus.RemoteBranches.Count -eq 0) {
                # The sole-branch claim below rests on having read origin's
                # branches. An unreadable or empty set is not evidence of one
                # branch, and saying so from zero observations is the same
                # mistake as reading an empty leak probe as a clean index.
                Report "WARN" "Memory sync" ($syncFixLines + $syncDetail + @(
                    ("Branch " + (Get-SanitizedLine $syncStatus.Branch 200) + " tracks " +
                        (Get-SanitizedLine $syncStatus.Upstream 200) + ", but no remote-tracking branch for origin could be read here, so whether this store shares a branch with the other machines is unverified."),
                    "Fix: run git -C `"$claudeDir`" fetch origin, then re-run this check."
                ))
            }
            else {
                $syncDetail += ("Destination: " + (Get-SanitizedLine $syncStatus.Branch 200) + " tracks " +
                    (Get-SanitizedLine $syncStatus.Upstream 200) + ", the only branch on origin.")
                if ($syncFixLines.Count -gt 0) { Report "FIXED" "Memory sync" ($syncFixLines + $syncDetail) }
                else { Report "PASS" "Memory sync" $syncDetail }
            }
        }
    }
}

# --- Embedder (semantic memory search). memq find's semantic channel needs an
# --- in-process embedding stack that ships outside the plugin payload (the kit
# --- core stays dependency-free), so this section reports whether it is
# --- installed, installs it under -Fix, and reports the derived index's health
# --- without ever sweeping or writing it: the index rebuilds itself, and a
# --- doctor that touched it while reporting on it would have changed the thing
# --- it was reporting.
# ---
# --- install-embedder.ps1 (dot-sourced near the top of this script) owns the
# --- probe, the install, and the index-health reading, so the repo test suite
# --- exercises the same functions against a redirected embedder root and store
# --- root. probeEmbedder's three states get three different reports: 'absent'
# --- is nothing installed yet, 'unusable' is a broken or incomplete install (a
# --- repair, never mistaken for a fresh install), and 'ready' is a working
# --- semantic channel. Absence is a WARN, not a FAIL: memq find degrades to its
# --- lexical channel with a loud line, so a machine without the stack is a
# --- working install with a named gap, the same reading every other optional
# --- capability in this doctor gets.
# "kit-embedder" mirrors memory-index.js's EMBEDDER_DIR constant and
# memq.js's OPERATOR_DIR-style literal duplication: PowerShell cannot import a
# CommonJS constant, so the two sides of this contract are pinned by comment
# rather than by a shared definition, the same way $script:EmbedderConsentSizeMB
# in install-embedder.ps1 is a measured figure rather than a computed one.
$embedderRoot = Join-Path $claudeDir "kit-embedder"
$embedderScript = Join-Path $pluginRoot "scripts\memory-index.js"

if ($null -eq $nodeCmd) {
    Report "INFO" "Embedder (semantic search)" @("Skipped (node unresolved; the hook check above already FAILs on that, and the embedder probe runs under node).")
}
elseif (-not (Test-Path -LiteralPath $embedderScript)) {
    Report "FAIL" "Embedder (semantic search)" @("memory-index.js not found at $embedderScript; this plugin payload is incomplete.")
}
else {
    $embedProbe = Get-EmbedderProbe -MemoryIndexPath $embedderScript -EmbedderRoot $embedderRoot -NodeExe $nodeCmd.Source
    $embedFixNotes = @()
    $embedReported = $false

    # Gated on 'absent' or 'unusable' specifically, never on "not ready":
    # 'probe-failed' (the module present but unloadable, an incomplete plugin
    # payload) also reads not-ready, and offering a fresh install there would
    # promise a multi-hundred-megabyte download that cannot fix a payload
    # problem, ending in FAIL regardless. 'probe-failed' takes its own report
    # in the switch below instead, and never reaches a consent prompt.
    if ($Fix -and ($embedProbe.status -eq 'absent' -or $embedProbe.status -eq 'unusable')) {
        if ($null -eq (Get-Command npm -ErrorAction SilentlyContinue)) {
            # The consent prompt must not promise a repair the installer will
            # refuse to perform: Install-Embedder itself checks for npm and
            # returns Ok=false without ever prompting, so this mirrors that
            # refusal before a prompt is even offered, the same shape the
            # memq shim's "no payload to run" WARN takes. No prompt is shown,
            # and this rides as an extra note on the ordinary absent/unusable
            # report below rather than replacing it, so the index-health lines
            # every other state gets still print here too.
            $embedFixNotes = @(
                "npm is not on PATH, so the embedding stack cannot be installed.",
                "Install Node.js (which ships npm) and re-run doctor -Fix."
            )
        }
        else {
            $embedQuestion = if ($embedProbe.status -eq 'unusable') {
                "Repair the local embedding stack at $embedderRoot (re-downloads the missing model files; the full install is about $($script:EmbedderConsentSizeMB) MB on disk)?"
            }
            else {
                "Install the local embedding stack into $embedderRoot (about $($script:EmbedderConsentSizeMB) MB on disk; enables memq find's semantic channel)?"
            }
            if (Get-Consent $embedQuestion) {
                $embedInstall = Install-Embedder -PluginRoot $pluginRoot -EmbedderRoot $embedderRoot -NodeExe $nodeCmd.Source
                # Re-probe either way: the report below must describe the
                # install as it actually stands after this attempt, never as
                # the attempt hoped it would.
                $embedProbe = Get-EmbedderProbe -MemoryIndexPath $embedderScript -EmbedderRoot $embedderRoot -NodeExe $nodeCmd.Source
                $embedInstallNotes = @($embedInstall.Notes | ForEach-Object { Get-SanitizedLine $_ 300 })
                if (-not $embedInstall.Ok) {
                    Report "FAIL" "Embedder (semantic search)" ($embedInstallNotes + @(
                        "Semantic channel inactive; memq find serves lexical results only, with a loud absence line naming the remedy.",
                        "The install directory is left in place for diagnosis; the doctor deletes nothing."
                    ))
                    $embedReported = $true
                }
                else {
                    $embedFixNotes = $embedInstallNotes
                }
            }
        }
    }

    if (-not $embedReported) {
        $embedIndexHealth = Get-EmbedderIndexHealth -MemoryIndexPath $embedderScript -EmbedderRoot $embedderRoot -StoreRoot $claudeDir -NodeExe $nodeCmd.Source
        $embedIndexLines = @((Get-EmbedderIndexHealthLines -IndexHealth $embedIndexHealth -Probe $embedProbe) | ForEach-Object { Get-SanitizedLine $_ 300 })

        switch ($embedProbe.status) {
            'ready' {
                # packageVersion comes from a package.json this doctor did not
                # author, the same as every other foreign string reaching this
                # report, so it takes the same sanitize pass before printing.
                $embedDetail = @(
                    ("Installed: $($embedProbe.packageName)@$(Get-SanitizedLine ([string]$embedProbe.packageVersion) 40), model $($embedProbe.model) ($($embedProbe.dtype)) at $($embedProbe.packageDir)."),
                    "Semantic channel active; memq find blends lexical and semantic results."
                ) + $embedIndexLines
                if ($embedFixNotes.Count -gt 0) { Report "FIXED" "Embedder (semantic search)" ($embedFixNotes + $embedDetail) }
                else { Report "PASS" "Embedder (semantic search)" $embedDetail }
            }
            'unusable' {
                Report "WARN" "Embedder (semantic search)" ($embedFixNotes + @(
                    ("Installed but not usable: " + (Get-SanitizedLine ([string]$embedProbe.detail) 300)),
                    "This is a repair, not a fresh install.",
                    ("Fix: " + $embedProbe.remedy),
                    "Semantic channel inactive; memq find serves lexical results only, with a loud absence line naming the remedy."
                ) + $embedIndexLines)
            }
            'absent' {
                Report "WARN" "Embedder (semantic search)" ($embedFixNotes + @(
                    "Not installed; memq find serves lexical results only, with a loud absence line naming the remedy.",
                    ("Fix: " + $embedProbe.remedy + "  (about $($script:EmbedderConsentSizeMB) MB on disk)")
                ) + $embedIndexLines)
            }
            default {
                # 'probe-failed': the child node process itself could not
                # answer, an incomplete plugin payload rather than an
                # ordinary absent-or-broken install. Named as its own state so
                # it is never mistaken for either.
                Report "FAIL" "Embedder (semantic search)" (@(
                    "Could not probe the embedder install: " + (Get-SanitizedLine ([string]$embedProbe.detail) 300)
                ) + $embedIndexLines)
            }
        }
    }
}

if ($isClone) {
    $goalStatePath = Join-Path $repoRoot ".kit\goal-state.json"
    if (-not (Test-Path -LiteralPath $goalStatePath)) {
        Report "INFO" "Kit goal state" @("No kit goal armed in this clone.")
    }
    else {
        $goalState = $null
        try { $goalState = Get-Content $goalStatePath -Raw | ConvertFrom-Json } catch {}
        if ($null -eq $goalState -or -not $goalState.plan) {
            Report "WARN" "Kit goal state" @("$goalStatePath exists but is unparseable or missing a 'plan' field; a stuck goal may be leashing sessions with no readable state.")
        }
        else {
            # Mirrors kit-goal-lib.js's planHead: an anchored, line-start Status
            # match so body prose containing "in progress" or "complete" cannot
            # misclassify the plan.
            $planSafe = Get-SanitizedLine $goalState.plan
            $planRaw = [string]$goalState.plan

            # Queue context, read defensively. kit-goal-lib.js's readGoal
            # normalizes every read so that queue[queueIndex] is always plan,
            # but the doctor reads the raw file and a hand edit is exactly the
            # case it exists to catch, so a queue that disagrees with plan is
            # discarded in favour of the legacy single-plan reading rather than
            # trusted. A pre-queue state file has no queue at all and takes the
            # same path, which is what keeps this check working on both shapes.
            $queue = @()
            foreach ($q in @($goalState.queue)) {
                if ($q -is [string] -and $q.Length -gt 0) { $queue += [string]$q }
            }
            $queueIndex = 0
            if ($goalState.queueIndex -is [int] -or $goalState.queueIndex -is [long] -or $goalState.queueIndex -is [double]) {
                $queueIndex = [int]$goalState.queueIndex
            }
            if ($queue.Count -eq 0 -or $queueIndex -lt 0 -or $queueIndex -ge $queue.Count -or $queue[$queueIndex] -ne $planRaw) {
                $queue = @($planRaw)
                $queueIndex = 0
            }
            $remainingCount = $queue.Count - $queueIndex - 1
            $queueLines = @()
            if ($queue.Count -gt 1) {
                $queueLines += "Plan $($queueIndex + 1) of $($queue.Count) in the armed queue."
                if ($remainingCount -gt 0) {
                    $shown = $queue[($queueIndex + 1)..($queue.Count - 1)]
                    $tail = ""
                    if ($shown.Count -gt 5) {
                        $tail = ", and $($shown.Count - 5) more"
                        $shown = $shown[0..4]
                    }
                    $queueLines += "Remaining after it: " + (($shown | ForEach-Object { Get-SanitizedLine $_ }) -join ", ") + $tail
                }
            }

            if ($planRaw -match '(^|[\\/])\.\.([\\/]|$)') {
                # armGoal never writes a traversing path, so a plan containing a
                # '..' segment means a hand-edited or corrupt state file; do not
                # follow it out of the repo to read an arbitrary file.
                Report "WARN" "Kit goal state" @("$goalStatePath names a plan path containing '..' ($planSafe); refusing to inspect it. Clear the goal (/kit-goal clear) if it is stale.")
            }
            else {
                $planFull = Join-Path $repoRoot $planRaw
                $planExists = Test-Path -LiteralPath $planFull
                $planStatus = "unknown"
                if ($planExists) {
                    try {
                        $head = Get-Content -LiteralPath $planFull -Raw -ErrorAction Stop
                        if ($head.Length -gt 2048) { $head = $head.Substring(0, 2048) }
                        $inProgress = $head -match "(?im)^status:[^\S\r\n]*in[^\S\r\n]*progress"
                        $complete = ($head -match "(?im)^status:[^\S\r\n]*complete") -and -not $inProgress
                        if ($complete) { $planStatus = "complete" }
                        elseif ($inProgress) { $planStatus = "in progress" }
                    }
                    catch {}
                }
                if (-not $planExists -or $planStatus -eq "complete") {
                    if ($remainingCount -gt 0) {
                        # A stalled advance, not a stale goal. The Stop hook
                        # advances a finished plan at the bound session's next
                        # stop, so a terminal current plan with the queue still
                        # holding work means no stop has happened since it
                        # finished: either the run is mid-turn, or it died
                        # before its next stop and the queue needs re-arming
                        # with the remainder.
                        Report "WARN" "Kit goal state" ($queueLines + @(
                            "The current plan $planSafe is Complete or archived, but $remainingCount plan(s) remain in the queue.",
                            "The Stop hook advances at the bound session's next stop, so this is normal mid-turn and a stalled advance otherwise.",
                            "If the bound run has died, re-arm with the remaining plans (/kit-goal <plan paths>), which resets the binding."
                        ))
                    }
                    else {
                        Report "WARN" "Kit goal state" ($queueLines + @(
                            "A kit goal is armed for $planSafe but that plan is Complete or archived.",
                            "Clear it (node `"$pluginRoot\hooks\kit-goal.js`" clear, or /kit-goal clear) or it will leash this repo's sessions."
                        ))
                    }
                }
                else {
                    Report "PASS" "Kit goal state" (@("Armed for $planSafe (active).") + $queueLines)
                }
            }
        }
    }
}
else {
    Report "INFO" "Kit goal state" @("Skipped (installed plugin cache, not a repo clone; no specific repo to inspect).")
}

# --- Stop-failure watcher. An unattended kit-goal run that dies of an API
# --- error (the session limit above all) routes to StopFailure, which the
# --- Stop-hook leash never sees; the stop-failure-log.js hook records the
# --- death and the watcher scheduled task resumes the run once the failure has
# --- settled. The watcher script ships in the payload; the task is opt-in
# --- (only unattended machines want it), so an absent task is INFO, never a
# --- gap -Fix heals on its own: registering takes -Fix plus
# --- -RegisterStopFailureWatcher plus consent, run from the project directory
# --- the task should watch, and unregistering takes -Fix plus
# --- -UnregisterStopFailureWatcher plus consent, following the
# --- -RemoveLegacyRelay precedent that naming the switch is the request.
$watcherScript = Join-Path $pluginRoot "scripts\stop-failure-watcher.ps1"
$watcherTaskName = $script:StopFailureWatcherTaskName
$watcherStatus = Get-StopFailureWatcherStatus
$watcherReported = $false

if (-not (Test-Path -LiteralPath $watcherScript)) {
    Report "FAIL" "Stop-failure watcher" @("stop-failure-watcher.ps1 not found at $watcherScript; this plugin payload is incomplete.")
    $watcherReported = $true
}
elseif ($Fix -and $UnregisterStopFailureWatcher) {
    if (-not $watcherStatus.queried) {
        Report "WARN" "Stop-failure watcher" @(
            "Could not query scheduled tasks (" + (Get-SanitizedLine $watcherStatus.detail 200) + "), so nothing was removed.",
            "Remove the task '$watcherTaskName' by hand in Task Scheduler if it exists."
        )
    }
    elseif (-not $watcherStatus.present) {
        Report "INFO" "Stop-failure watcher" @("No scheduled task '$watcherTaskName' is registered; nothing to remove.")
    }
    elseif (Get-Consent "Unregister the scheduled task '$watcherTaskName' (failed runs on this machine will no longer auto-resume)?") {
        $watcherRemove = Uninstall-StopFailureWatcher
        if ($watcherRemove.ok) {
            Report "FIXED" "Stop-failure watcher" @("Unregistered scheduled task '$watcherTaskName'; the watcher script itself stays in the payload.")
        }
        else {
            Report "FAIL" "Stop-failure watcher" @(
                "Could not unregister '$watcherTaskName': " + (Get-SanitizedLine $watcherRemove.reason 200),
                "Remove it by hand in Task Scheduler."
            )
        }
    }
    else {
        Report "WARN" "Stop-failure watcher" @(
            "Left in place: no consent given at the prompt, so nothing was removed.",
            "Unattended:  doctor -Fix -UnregisterStopFailureWatcher -Yes"
        )
    }
    $watcherReported = $true
}
elseif ($Fix -and $RegisterStopFailureWatcher) {
    # The watched project is the directory the doctor was launched from: the
    # goal state the watcher scopes to is project-local, so the operator runs
    # the doctor from the repo whose unattended runs should auto-resume, and
    # the consent prompt names the resolved directory so the yes is given
    # against the actual value.
    $watcherProjectDir = (Get-Location).Path
    $watcherInterval = Get-StopFailureWatcherInterval -WatcherPath $watcherScript
    $watcherIntervalNote = if ($null -ne $watcherInterval) { "every $watcherInterval minutes" } else { "on its configured interval" }
    if (Get-Consent "Register scheduled task '$watcherTaskName' to run the stop-failure watcher $watcherIntervalNote for $watcherProjectDir?") {
        $watcherInstall = Install-StopFailureWatcher -WatcherPath $watcherScript -ProjectDir $watcherProjectDir
        if ($watcherInstall.ok) {
            Report "FIXED" "Stop-failure watcher" $watcherInstall.notes
        }
        else {
            Report "FAIL" "Stop-failure watcher" @(
                "Could not register '$watcherTaskName': " + (Get-SanitizedLine $watcherInstall.reason 300)
            )
        }
    }
    else {
        Report "WARN" "Stop-failure watcher" @(
            "Not registered: no consent given at the prompt.",
            "Unattended, from the project directory to watch:  doctor -Fix -RegisterStopFailureWatcher -Yes"
        )
    }
    $watcherReported = $true
}

if (-not $watcherReported) {
    if (-not $watcherStatus.queried) {
        Report "WARN" "Stop-failure watcher" @(
            "Watcher script present, but scheduled tasks could not be queried (" + (Get-SanitizedLine $watcherStatus.detail 200) + "),",
            "so whether the task '$watcherTaskName' is registered is undetermined."
        )
    }
    elseif (-not $watcherStatus.present) {
        Report "INFO" "Stop-failure watcher" @(
            "Watcher script present; no scheduled task '$watcherTaskName' is registered, so a failed unattended run on this machine is not auto-resumed.",
            "Opt-in for unattended machines. From the project directory to watch:  doctor -Fix -RegisterStopFailureWatcher"
        )
    }
    else {
        # The task is registered: hold it to the pins the parked-child design
        # depends on, and to the current payload's watcher path, which rotates
        # with every release on an installed plugin cache. The action string
        # is task data, not doctor-authored, so it is sanitized like every
        # other foreign string before reaching the report.
        $watcherGaps = @()
        if ($watcherStatus.arguments.IndexOf($watcherScript, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
            $watcherGaps += "The task runs a watcher at a different path than this payload's (a moved clone, or a plugin cache from an earlier release)."
        }
        if ($watcherStatus.multipleInstances -ne "IgnoreNew") {
            $watcherGaps += ("MultipleInstances is '" + (Get-SanitizedLine $watcherStatus.multipleInstances) + "', not IgnoreNew, so a second pass can start beside a parked child.")
        }
        if ($watcherStatus.executionTimeLimit -ne "PT8H") {
            $watcherGaps += ("ExecutionTimeLimit is '" + (Get-SanitizedLine $watcherStatus.executionTimeLimit) + "', not PT8H, so the scheduler can cut a parked child short or let a hung one run unbounded.")
        }
        $watcherDetail = @(
            "Scheduled task '$watcherTaskName' registered, repeating at " + (Get-SanitizedLine $watcherStatus.repetitionInterval 40) + ".",
            "Action: " + (Get-SanitizedLine ($watcherStatus.execute + " " + $watcherStatus.arguments) 300)
        )
        if ($watcherGaps.Count -gt 0) {
            Report "WARN" "Stop-failure watcher" ($watcherDetail + $watcherGaps + @(
                "Fix: re-register from the project directory to watch  (doctor -Fix -RegisterStopFailureWatcher replaces the task)."
            ))
        }
        else {
            Report "PASS" "Stop-failure watcher" $watcherDetail
        }
    }
}

# --- Auto-compaction window. The boundary-gated compaction feature needs the
# --- harness to OFFER a compaction early enough that the gate has something to
# --- schedule: the gate can only defer an offer, never raise one. That offer
# --- point is set by autoCompactWindow in user settings.json.
#
# The effective trigger is the configured window minus a reserve (measured,
# not documented: a configured 100,000 fires near 64,000 and a configured
# 150,000 fires near 116,400). The recommended window is sized against the
# roughly 1,000,000-token window the models running leashed plan sessions
# carry, and against where a real run actually sits: context reaches about
# 100,000 once tools and a plan doc have loaded, chapters rarely close below
# 200,000, and quality holds until roughly 400,000. So the trigger belongs
# well above the setup floor and below the point where deferring starts to
# cost something, which puts it near 250,000 with a long runway below the
# gate's safety valve for a chapter to close. Every displayed number is
# derived from $recommendedWindow and $autoCompactReserve rather than
# restated, so changing one value cannot strand the prose beside it.
#
# A window set too HIGH is one quiet failure: above the model's real context
# window the trigger is never reached, no compaction is ever offered, and the
# whole feature is inert while looking installed. A window set too LOW is the
# other, and it is worse than doing nothing: it compacts during setup and then
# repeatedly, throwing away context a run has not finished using.
$recommendedWindow = 285000
$autoCompactReserve = 35000
$recommendedTrigger = $recommendedWindow - $autoCompactReserve
# The minimum usable band between the trigger and the valve ceiling. A band
# thinner than a couple of large turns is inert in practice, with the valve
# ending deferral almost as soon as the harness starts offering, so it is
# warned on rather than only the zero-or-negative case. Sized against turns on
# a real orchestration run (a wide git diff, a big plan-doc read, a subagent
# report), which run far larger than the small-window probe's 20,000.
$minUsableBand = 50000
# The documented floor of autoCompactWindow's accepted range. Below it the
# harness may clamp or ignore the value, so the real trigger is unknown and a
# derived trigger number would be fiction; the check reports that state
# instead of assessing it.
$windowFloor = 100000
$settingsPath = Join-Path $claudeDir "settings.json"
# The reported first version with PreCompact hook support. That is a support
# floor only: the deny mechanism the gate relies on (exit code 2 honored, the
# JSON decision form inert) is confirmed on 2.1.233 and unprobed on anything
# older, so this must not be read as a verified deny-support floor.
$minPreCompactVersion = "2.1.208"

# The valve ceiling is read out of the hook rather than restated here, so the
# doctor and the gate cannot drift apart. An unreadable constant costs only
# the trigger-versus-ceiling sub-checks, and that skip is reported below
# rather than silent: a silent skip is indistinguishable from a healthy
# result.
$valveCeiling = $null
try {
    $gateSource = Get-Content -LiteralPath (Join-Path $pluginRoot "hooks\kit-compact-gate.js") -Raw -ErrorAction Stop
    if ($gateSource -match 'SAFETY_CEILING_TOKENS\s*=\s*(\d+)') { $valveCeiling = [int]$Matches[1] }
}
catch {}
if ($null -eq $valveCeiling) {
    Report "INFO" "Auto-compaction window" @("Skipped sub-check: the gate's SAFETY_CEILING_TOKENS could not be read from hooks\kit-compact-gate.js, so the trigger-versus-ceiling comparisons are skipped this run.")
}

$installedVersion = $null
try {
    if (Get-Command claude -ErrorAction SilentlyContinue) {
        $versionOut = (& claude --version) 2>$null
        if ("$versionOut" -match '(\d+)\.(\d+)\.(\d+)') { $installedVersion = $Matches[0] }
    }
}
catch {}

if ($null -ne $installedVersion) {
    $installedParts = $installedVersion.Split(".") | ForEach-Object { [int]$_ }
    $minParts = $minPreCompactVersion.Split(".") | ForEach-Object { [int]$_ }
    $tooOld = $false
    for ($i = 0; $i -lt 3; $i++) {
        if ($installedParts[$i] -lt $minParts[$i]) { $tooOld = $true; break }
        if ($installedParts[$i] -gt $minParts[$i]) { break }
    }
    if ($tooOld) {
        Report "WARN" "PreCompact support" @(
            "Claude Code $installedVersion predates PreCompact hook support (needs $minPreCompactVersion or later).",
            "The boundary-gated compaction hook will never fire on this version, so compaction lands wherever context happens to fill."
        )
    }
}
else {
    # A silent skip would be indistinguishable from a healthy result, so the
    # unverifiable case says so.
    Report "INFO" "PreCompact support" @("Skipped: 'claude --version' is not on PATH or did not report a version, so PreCompact support (needs $minPreCompactVersion or later) cannot be verified on this machine.")
}

$configuredWindow = $null
$configuredWindowRaw = $null
$settingsReadable = $false
if (Test-Path -LiteralPath $settingsPath) {
    # Explicit UTF-8, matching the installer: Get-Content -Raw on Windows
    # PowerShell 5.1 decodes a UTF-8 file with the ANSI codepage.
    try {
        $settingsObj = [System.IO.File]::ReadAllText($settingsPath, (New-Object System.Text.UTF8Encoding($false))) | ConvertFrom-Json
        $settingsReadable = $true
    }
    catch {}
    if ($settingsReadable -and $settingsObj.PSObject.Properties.Name -contains "autoCompactWindow") {
        # A present value that does not cast is a different state from an
        # absent one: the user set SOMETHING, so it is reported as what it is
        # (and never overwritten by -Fix), rather than misreported as "not
        # set" and replaced.
        $rawWindowValue = $settingsObj.autoCompactWindow
        try { $configuredWindow = [int]$rawWindowValue }
        catch { $configuredWindowRaw = "$rawWindowValue" }
    }
}

# The default-trigger judgment both no-window branches share: with no window
# configured, the harness's per-model default trigger sits near the top of
# the model window, which is above the gate's absolute safety ceiling, so the
# valve allows every compaction and the gate defers nothing until a window is
# configured.
$noWindowJudgment = @()
if ($null -ne $valveCeiling) {
    # Stated as expectation rather than measurement: the per-model default
    # trigger sits near the top of the window by design, which on a large-window
    # model puts it above the ceiling, but that has not been measured on the
    # window plan sessions actually run.
    $noWindowJudgment = @("The default trigger sits near the top of the model window, which on a large-window model is expected to be above the gate's safety ceiling of $valveCeiling, leaving the valve to allow every compaction and the gate to defer nothing until a window is configured.")
}

if (-not (Test-Path -LiteralPath $settingsPath)) {
    Report "INFO" "Auto-compaction window" (@("No user settings.json at $settingsPath, so no window is configured and the harness uses its per-model default.") + $noWindowJudgment)
}
elseif (-not $settingsReadable) {
    Report "WARN" "Auto-compaction window" @("$settingsPath could not be parsed, so the configured window cannot be read.")
}
elseif ($null -ne $configuredWindowRaw) {
    Report "WARN" "Auto-compaction window" @(
        "autoCompactWindow is set to '" + (Get-SanitizedLine $configuredWindowRaw) + "', which is not a usable number, so the trigger cannot be assessed and the harness behavior is undefined.",
        "Set it by hand to $recommendedWindow, or remove it to fall back to the per-model default."
    )
}
elseif ($null -eq $configuredWindow) {
    $detail = @(
        "No autoCompactWindow is set, so the harness compacts at its per-model default trigger, near the top of the context window."
    ) + $noWindowJudgment + @(
        "Recommended: $recommendedWindow (offers a compaction near $recommendedTrigger consumed on the ~1,000,000-token window plan sessions run)."
    )
    if ($Fix -and (Get-Consent "Set autoCompactWindow to $recommendedWindow in $settingsPath?")) {
        $result = Set-AutoCompactWindow -Path $settingsPath -Value $recommendedWindow
        if ($result.ok) {
            Report "FIXED" "Auto-compaction window" @("Set autoCompactWindow to $recommendedWindow.", "Restart Claude Code for it to take effect.")
            if ($result.backupLeftover) {
                # The leftover is a plaintext copy of settings.json, which can
                # carry an env block and apiKeyHelper, so it is named rather
                # than silently left behind.
                Report "INFO" "Auto-compaction window" @("The pre-write backup could not be removed and remains at " + (Get-SanitizedLine $result.backupLeftover 200) + "; it holds a plaintext copy of settings.json, so delete it when convenient.")
            }
        }
        else {
            # The reason can carry file-derived text (key names, exception
            # messages), so it is sanitized before this trusted channel.
            Report "WARN" "Auto-compaction window" @("Could not set it: " + (Get-SanitizedLine $result.reason 200) + ".", "Add it by hand instead: `"autoCompactWindow`": $recommendedWindow")
        }
    }
    else {
        Report "INFO" "Auto-compaction window" $detail
    }
}
elseif ($configuredWindow -lt $windowFloor) {
    # Below the documented floor nothing derived from the value can be
    # trusted, so no trigger arithmetic is shown: the honest report is that
    # the behavior is unknown, not a clamped-to-zero number and a PASS.
    Report "WARN" "Auto-compaction window" @(
        "autoCompactWindow is $configuredWindow, below the documented floor of $windowFloor, so the harness may clamp or ignore it and the real trigger is unknown.",
        "Set it to $recommendedWindow (the documented range starts at $windowFloor)."
    )
}
else {
    $trigger = $configuredWindow - $autoCompactReserve
    # Display guard only: the floor branch above already refuses any window
    # small enough to derive a negative trigger, so this clamp is unreachable
    # belt-and-braces against the two constants drifting.
    $displayTrigger = [Math]::Max(0, $trigger)
    $detail = @("autoCompactWindow is $configuredWindow, so a compaction is offered near $displayTrigger consumed (the trigger runs about $autoCompactReserve below the configured window).")
    # The one direction of the gate that is not fail-open: the valve is an
    # absolute token count assuming the model window plan sessions run on, and
    # the PreCompact payload carries no model field to derive the real one. A
    # trigger at or above the ceiling makes the feature inert outright, and a
    # band thinner than a couple of large turns ($minUsableBand) is inert in
    # practice, so both warn rather than only the zero-or-negative case.
    if ($null -ne $valveCeiling -and ($valveCeiling - $trigger) -lt $minUsableBand) {
        Report "WARN" "Auto-compaction window" ($detail + @(
            "That trigger leaves less than $minUsableBand tokens of deferral band below the gate's safety ceiling of $valveCeiling, so the valve ends deferral as soon as, or before, the harness starts offering.",
            "Lower it to $recommendedWindow to restore a usable band between the trigger and the ceiling."
        ))
    }
    elseif ($configuredWindow -ne $recommendedWindow) {
        # A usable window that is not the recommended one is stale rather than
        # broken: its trigger is real, and it either cleared the thin-band check
        # above or that check was skipped for an unreadable ceiling. INFO rather
        # than WARN for that reason, so a machine that is merely un-migrated does
        # not report yellow, and the thin-band case above takes precedence when
        # both apply. Without this branch the recommendation could never reach a
        # machine that already has a value, since every other branch here answers
        # only an absent, unparseable, or below-floor one.
        $mismatchDetail = $detail + @(
            "The recommended window is $recommendedWindow, which offers a compaction near $recommendedTrigger consumed."
        )
        # The band comparison is directional and depends on a ceiling that may
        # not have been readable, so it is claimed only where it is true. Moving
        # DOWN to the recommendation widens the band; moving up to it narrows
        # one that was already wider, which is still the recommended trade but
        # not for this reason, so no reason is offered there rather than a
        # false one.
        if ($null -ne $valveCeiling -and $configuredWindow -gt $recommendedWindow) {
            $mismatchDetail += "That also widens the deferral band below the gate's safety ceiling of $valveCeiling, from $($valveCeiling - $trigger) tokens to $($valveCeiling - $recommendedTrigger)."
        }
        # Replacing a value the operator chose is a wider act than filling in an
        # absent one, so it takes an interactive yes and is withheld from -Yes:
        # an unattended run cannot tell a deliberate window from a stale one,
        # and would revert the deliberate one on every run after every retune of
        # $recommendedWindow. The prompt names both values rather than only the
        # target, so the answer is given against the actual change.
        if ($Fix -and (Get-Consent "Change autoCompactWindow from $configuredWindow to $recommendedWindow in $settingsPath?" -Interactive)) {
            $result = Set-AutoCompactWindow -Path $settingsPath -Value $recommendedWindow
            if ($result.ok) {
                Report "FIXED" "Auto-compaction window" @("Changed autoCompactWindow from $configuredWindow to $recommendedWindow.", "Restart Claude Code for it to take effect.")
                if ($result.backupLeftover) {
                    Report "INFO" "Auto-compaction window" @("The pre-write backup could not be removed and remains at " + (Get-SanitizedLine $result.backupLeftover 200) + "; it holds a plaintext copy of settings.json, so delete it when convenient.")
                }
            }
            else {
                # The failure reasons name the pre-write backup's full path, and
                # that backup holds a plaintext copy of settings.json, so this
                # line is allowed more room than the usual report: truncating the
                # one channel that says where a secrets-adjacent copy was left is
                # the wrong economy.
                Report "WARN" "Auto-compaction window" @("Could not change it: " + (Get-SanitizedLine $result.reason 400) + ".", "Set it by hand instead: `"autoCompactWindow`": $recommendedWindow")
            }
        }
        else {
            # The remedy differs by why consent was not given, and naming the
            # flag already supplied would send the operator back through a
            # prompt they just declined.
            $remedy = if ($Fix) {
                "Set it by hand in $settingsPath, or re-run and answer yes at the prompt (this change is withheld from -Yes because it replaces a value you chose)."
            } else {
                "Re-run the doctor with -Fix to change it, which asks before writing, or set it by hand in $settingsPath."
            }
            Report "INFO" "Auto-compaction window" ($mismatchDetail + @($remedy))
        }
    }
    else {
        Report "PASS" "Auto-compaction window" $detail
    }
}

# --- Summary.
Write-Host ""
if ($script:failCount -gt 0) {
    Write-Host "$($script:failCount) check(s) FAILED, $($script:warnCount) warning(s)." -ForegroundColor Red
    exit 1
}
if ($script:warnCount -gt 0) {
    Write-Host "Healthy with $($script:warnCount) warning(s)." -ForegroundColor Yellow
    exit 0
}
Write-Host "All checks passed." -ForegroundColor Green
exit 0
