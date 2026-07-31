# Health check and setup for the claude-kit plugin on this machine.
#
# Ships inside the plugin payload so every machine with the plugin installed
# has the current doctor, clone or not. The repo root keeps thin forwarders
# (doctor.ps1 / doctor.cmd) for the dev-clone habit.
#
# Verifies core setup (execution policy, doctrine import and freshness, kaizen
# signpost, git hooks on a clone), the ANTHROPIC_API_KEY hazard, the hook layer
# (goal-leash wiring and load, hook-canary wiring, the memq shim), and leftover
# resume-relay state on a machine that once armed it.
#
#   .\doctor.ps1              Check only; prints PASS/WARN/FAIL with remediations.
#   .\doctor.ps1 -Fix         Also applies the safe durable repairs (execution
#                             policy, the memq shim into ~\.claude\bin,
#                             signpost + git hooks on a clone).
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
# If scripts are blocked entirely, use the wrapper beside this file:
#   doctor.cmd [-Fix] [-Yes] [-RemoveLegacyRelay]
# Exit code: 0 when nothing FAILs (warnings allowed), 1 otherwise.

param([switch]$Fix, [switch]$Yes, [switch]$RemoveLegacyRelay)

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
function Get-Consent {
    param([string]$Question)
    if (-not $Fix) { return $false }
    if ($Yes) { return $true }
    try {
        $answer = Read-Host "$Question [y/N]"
        if ([string]::IsNullOrWhiteSpace($answer)) {
            Write-Host "        (no answer; declining. A redirected stdin cannot answer prompts; add -Yes to consent unattended.)"
            return $false
        }
        return $answer -match '^[Yy]'
    }
    catch {
        Write-Host "        (non-interactive host; skipping the prompt. Add -Yes to consent unattended.)"
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
                    Report "WARN" "Kit goal state" @(
                        "A kit goal is armed for $planSafe but that plan is Complete or archived.",
                        "Clear it (node `"$pluginRoot\hooks\kit-goal.js`" clear, or /kit-goal clear) or it will leash this repo's sessions."
                    )
                }
                else {
                    Report "PASS" "Kit goal state" @("Armed for $planSafe (active).")
                }
            }
        }
    }
}
else {
    Report "INFO" "Kit goal state" @("Skipped (installed plugin cache, not a repo clone; no specific repo to inspect).")
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
