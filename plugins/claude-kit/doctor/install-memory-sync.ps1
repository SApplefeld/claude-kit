# The doctor's memory-sync helpers: what the sync repo's allowlist is, what
# the store root's actual state is against it, and how an initialization is
# performed.
#
# Dot-sourced by doctor.ps1, which calls these under its "memory sync" check;
# the repo test suite dot-sources the same file and runs the same functions
# against a redirected store root, which is why the store root arrives as a
# mandatory parameter and is never resolved from the environment here. There
# is no default: the real store root holds .credentials.json, settings.json,
# and history.jsonl, so a forgotten redirect must be a loud parameter error
# rather than a git init over the operator's home. This file defines
# functions only; dot-sourcing it runs nothing and writes nothing.
#
# The store root is ~/.claude itself, and the allowlist is the whole security
# model of the sync: it excludes everything and re-includes only the memory
# tiers and the coordinator directory, so no add, however careless, can stage
# a credential. The canonical text of both files is defined once here and used
# by both the writer and the check, so the check cannot drift from what the
# installer writes, and the check re-derives it on every doctor run rather than
# trusting a one-time verification.
#
# Verification is by direct probe, never by reading the ignore file alone.
# Each probe reads a different surface, and none of them substitutes for
# another: `git check-ignore` reads the rules, `git add -A --dry-run` reads the
# worktree, `git ls-files` reads the index, and `git rev-list --objects` reads
# the reachable object graph. A tracked file ignores gitignore entirely and
# appears in neither of the first two, so a single forced add would otherwise
# be invisible against a canonical-looking allowlist; and a blob that reached
# a commit stays reachable after it is untracked, so the history probe is the
# only one that can see a credential a push would still publish.
#
# A managed file carrying the marker line is the doctor's own and may be
# rewritten back to canonical; a file without it belongs to whoever wrote it
# and is reported, never touched. Repository ownership is a separate question
# and rests on a git config key set at initialization, so a repository whose
# .gitignore was deleted is still recognizable as the doctor's own and stays
# repairable; a marker-bearing .gitignore is accepted as equivalent evidence.

# The line both managed files open with, and the only thing that makes a file
# on disk this script's to rewrite.
$script:MemorySyncMarker = "# claude-kit memory sync allowlist."

# The git config key that records a repository as the doctor's own, and the
# value it carries.
$script:MemorySyncOwnKey = "claudekit.memorysync"
$script:MemorySyncOwnValue = "true"

# The file forms the store's memory tiers hold: memq writes memory bodies and
# both indexes as .md, the outcome and usage journals as .jsonl, and the decay
# pass's completion stamp as the extension-less decay-stamp. Everything else a
# tier directory can hold (locks, the single-generation .bak, rename
# temporaries, a broken-lock rename such as decay.lock.stale.<pid>) is
# transient state of one machine and never syncs.
#
# One leaf set covers both admitted roots. The coordinator directory holds no
# memq output at all: its seat artifacts (the board, the registry entries, the
# claim file) are .md and .jsonl by their own contract, so the same forms
# admit them for a different reason, and a form no writer of either root
# produces stays refused in both.
function Get-MemorySyncAllowedLeafPatterns {
    return @('*.md', '*.jsonl', 'decay-stamp')
}

# The transient names, refused last and therefore refused whatever else
# matched. The list is a single definition used by both the ignore text and
# the path predicate, so a name such as foo.tmp.md, which the allowed forms
# admit and this axis denies, cannot be answered one way by git and the other
# way by the probes.
function Get-MemorySyncTransientPatterns {
    return @('*.lock', '*.bak', '*.tmp.*')
}

# The index-reading invocation, defined once so the two readers of the index
# (the tracked-path probe and the installer's gate) cannot answer differently.
# core.quotePath=false prints a path holding non-ASCII bytes as itself rather
# than octal-escaped inside double quotes.
function Get-MemorySyncLsFilesArguments {
    return @("-c", "core.quotePath=false", "ls-files")
}

# The allowlist itself. Each directory level is re-included before its
# contents because git cannot re-include a path whose parent directory is
# excluded, and each tier re-includes its files by form rather than excluding
# transient ones by pattern, because a positive rule is closed and a pattern
# list is open. The blanket exclusions come last, where the last matching
# pattern decides, so a lock, backup, or rewrite temporary is refused twice.
function Get-MemorySyncIgnoreText {
    $tierRules = {
        param($prefix)
        @("!$prefix/", "$prefix/**", "!$prefix/**/") +
            (Get-MemorySyncAllowedLeafPatterns | ForEach-Object { "!$prefix/**/$_" })
    }
    return (@(
        $script:MemorySyncMarker,
        '# Managed by the kit doctor, which re-derives this file on every run and',
        '# reports any difference as a failure.',
        '#',
        "# The store root holds .credentials.json, settings.json, and history.jsonl,",
        '# and its projects/ directories hold full session transcripts. Everything is',
        '# excluded; only memory files inside the memory tiers and the coordinator',
        '# directory are re-included.',
        '',
        '/*',
        '!/.gitignore',
        '!/.gitattributes',
        '',
        '# The project tier: projects/<flattened-project-path>/memory/ and nothing else.',
        '!/projects/',
        '/projects/*',
        '!/projects/*/',
        '/projects/*/*') +
        # $tierRules admits every allowed-leaf-pattern file under this prefix,
        # memory/pending/<run-id>/ included, so a run's own unadjudicated
        # writes still sync and survive a crash before the run ends. That is
        # deliberately wider than memory-index.js's semantic index, which
        # excludes the pending tier so a run's writes never surface in
        # another session's search before adjudication. Sync answers "should
        # this reach another machine"; the index answers "should this be
        # discoverable yet". Different questions, so the two surfaces disagree
        # on purpose.
        (& $tierRules '/projects/*/memory') + @(
        '',
        '# The type tier, live and archived.') +
        (& $tierRules '/memory-types') + @(
        '',
        '# The operator tier, live and archived.') +
        (& $tierRules '/memory-operator') + @(
        '',
        '# The coordinator tier: one directory per machine, holding the seat',
        '# artifacts every machine reads. It takes the same file forms as the',
        '# memory tiers and the same trailing transient exclusions, so a lock or',
        '# a rewrite temporary a seat leaves behind is per-machine state that',
        '# stays home.') +
        (& $tierRules '/coordinator') + @(
        '',
        '# Never, even inside an allowed directory: lock files, the single-generation',
        '# backup memq writes before each rewrite, and its rename temporaries.') +
        (Get-MemorySyncTransientPatterns | ForEach-Object { "**/$_" }) + @(
        '') -join "`n")
}

# Union merge for the store's journals. They are append-only JSONL, so two
# machines that both appended since the last sync hold no conflicting edit,
# only two sets of new lines; a union merge keeps both sides instead of
# raising a conflict over a file whose only history is appends.
function Get-MemorySyncAttributesText {
    return (@(
        $script:MemorySyncMarker,
        '# Managed by the kit doctor, which re-derives this file on every run and',
        '# reports any difference as a failure.',
        '',
        'projects/*/memory/**/*.jsonl merge=union',
        'memory-types/**/*.jsonl merge=union',
        'memory-operator/**/*.jsonl merge=union',
        '') -join "`n")
}

# The two managed files, each with the text it must hold.
function Get-MemorySyncManagedFiles {
    return @(
        @{ Name = ".gitignore"; Text = (Get-MemorySyncIgnoreText) },
        @{ Name = ".gitattributes"; Text = (Get-MemorySyncAttributesText) }
    )
}

# One managed file's state: Missing (nothing on disk), Canonical (exactly the
# text above), Drift (the doctor's own file, edited), or Foreign (a file
# without the marker, which belongs to whoever wrote it).
function Get-MemorySyncFileState {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Expected
    )
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return "Missing" }
    # Line endings are normalized on both sides before comparing. A clone made
    # with core.autocrlf checks these files out with CRLF, which is not a
    # change to a single rule; treating it as drift would fail every doctor run
    # on such a machine and start a rewrite-and-checkout loop.
    $actual = [System.IO.File]::ReadAllText($Path) -replace "`r`n", "`n"
    if ($actual -eq ($Expected -replace "`r`n", "`n")) { return "Canonical" }
    if ($actual.StartsWith($script:MemorySyncMarker)) { return "Drift" }
    return "Foreign"
}

# Whether a store root that is already a git repository is the doctor's own
# sync repo. A repository that is not belongs to whoever created it (an
# operator versioning their dotfiles at the store root), and the doctor
# neither writes into it nor commits there, because `git add -A` in such a
# repo would sweep up whatever it had staged and put it in a commit nobody
# asked for.
#
# The evidence is a git config key, which survives the deletion of any file in
# the worktree, so a repository whose allowlist was removed is still the
# doctor's to repair rather than an unreachable stranger. A marker-bearing
# .gitignore counts as the same evidence, which is what lets a repository
# carrying only that file be recognized and gain the key on the next repair.
function Test-MemorySyncRepoIsOwn {
    param(
        [Parameter(Mandatory = $true)][string]$StoreRoot,
        [string]$GitExe = "git"
    )
    $state = Get-MemorySyncFileState -Path (Join-Path $StoreRoot ".gitignore") -Expected (Get-MemorySyncIgnoreText)
    if ($state -eq "Canonical" -or $state -eq "Drift") { return $true }
    if (-not (Test-Path -LiteralPath (Join-Path $StoreRoot ".git"))) { return $false }
    $marker = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("config", "--local", "--get", $script:MemorySyncOwnKey) -GitExe $GitExe
    return ($marker.Code -eq 0 -and $marker.Output.Count -gt 0 -and $marker.Output[0].Trim() -eq $script:MemorySyncOwnValue)
}

# Whether a repo-relative path is one the allowlist is meant to admit. Used to
# judge what a dry-run add would stage, what is already tracked, and what
# committed history holds, so every probe answers against the same rule the
# ignore file encodes. The rule is positive on both axes: the path must sit
# inside one of the two roots the allowlist admits, a memory tier or the
# coordinator directory, and its file name must be one of the allowed leaf
# forms. Those forms are the ones memq writes in a tier; the coordinator
# directory carries no memq output and takes the same forms because its own
# contract writes .md and .jsonl. A name outside that set is refused whether
# or not any exclusion pattern happens to describe it.
function Test-MemorySyncPathAllowed {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    $p = $RelativePath -replace '\\', '/'
    if ($p -eq ".gitignore" -or $p -eq ".gitattributes") { return $true }
    $leaf = $p.Substring($p.LastIndexOf('/') + 1)
    $leafAllowed = $false
    foreach ($pattern in (Get-MemorySyncAllowedLeafPatterns)) {
        if ($leaf -like $pattern) { $leafAllowed = $true; break }
    }
    if (-not $leafAllowed) { return $false }
    # The deny axis runs after the allowed forms and overrides them, which is
    # the order the ignore file's last-match-wins rules produce. It applies to
    # every path component, not just the leaf: the trailing `**/*.bak` form
    # matches a directory named notes.bak as readily as a file, and git cannot
    # re-include anything beneath a directory it has excluded, so a predicate
    # reading the leaf alone would admit paths git refuses.
    foreach ($segment in ($p -split '/')) {
        foreach ($pattern in (Get-MemorySyncTransientPatterns)) {
            if ($segment -like $pattern) { return $false }
        }
    }
    if ($p -match '^projects/[^/]+/memory/.+') { return $true }
    if ($p -match '^memory-types/.+') { return $true }
    if ($p -match '^memory-operator/.+') { return $true }
    if ($p -match '^coordinator/.+') { return $true }
    return $false
}

# The paths the check proves are ignored: the three sensitive root files, plus
# a sampled session transcript, which is the bulk of what a project directory
# holds beside its memory store. The sample is whatever file sits directly in
# a project directory; when the store has none, the caller reports one fewer
# probe rather than inventing a path, because check-ignore answering about a
# file that does not exist proves less than one about a file that does.
function Get-MemorySyncProbePaths {
    param([Parameter(Mandatory = $true)][string]$StoreRoot)
    $paths = @(".credentials.json", "settings.json", "history.jsonl")
    $projectsDir = Join-Path $StoreRoot "projects"
    if (Test-Path -LiteralPath $projectsDir -PathType Container) {
        $sample = Get-ChildItem -LiteralPath $projectsDir -Directory -ErrorAction SilentlyContinue |
            ForEach-Object { Get-ChildItem -LiteralPath $_.FullName -File -ErrorAction SilentlyContinue | Select-Object -First 1 } |
            Select-Object -First 1
        if ($null -ne $sample) {
            $paths += ("projects/" + $sample.Directory.Name + "/" + $sample.Name)
        }
    }
    return $paths
}

# Run git in the store root and return its output plus exit code. Output is
# captured rather than printed so the caller decides what reaches the report,
# and stderr joins it so a git error is diagnosable instead of silent.
function Invoke-MemorySyncGit {
    param(
        [Parameter(Mandatory = $true)][string]$StoreRoot,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [string]$GitExe = "git"
    )
    $all = @("-C", $StoreRoot) + $Arguments
    $output = & $GitExe @all 2>&1
    return @{ Code = $LASTEXITCODE; Output = @($output | ForEach-Object { [string]$_ }) }
}

# The store root's sync state, as data for the caller to report on: whether
# git is usable, whether the root is a repo, what the two managed files hold,
# and, inside a repo, the four direct probes.
#
# Outside a repo the probes cannot run at all (check-ignore, dry-run add,
# ls-files, and rev-list all require one), so ProbesRan stays false and the
# probe results stay empty. That is the state a fresh machine is in, and it is
# reported as work to do rather than as a passing allowlist.
#
# ProbesAttempted and ProbesAnswered count the four leak probes, so a caller
# can say how much of the negative was actually proven. An empty result set
# means nothing on its own: it reads identically whether a probe found nothing
# or never ran.
#
# Dirty is a fifth, separate fact from the four leak probes: whether the
# worktree holds a change under the allowlist that has not been committed yet
# (a memory the session wrote this run, most commonly). It is not folded into
# ProbesAttempted/ProbesAnswered, because those count how much of the security
# negative was proven and Dirty proves nothing about leaks; a git status call
# that fails leaves Dirty false rather than marking the whole status unproven,
# the same fail-quiet posture the session hook's own sync trigger
# takes on the identical git call. `--untracked-files=all` is what keeps
# DirtyCount an exact file count rather than one line for a whole new
# untracked directory, which git's default porcelain output would collapse to.
function Get-MemorySyncStatus {
    param(
        [Parameter(Mandatory = $true)][string]$StoreRoot,
        [string]$GitExe = "git"
    )
    $status = @{
        StoreRoot     = $StoreRoot
        GitAvailable  = $true
        IsRepo        = $false
        IsOwnRepo     = $false
        IgnoreState   = "Missing"
        AttrState     = "Missing"
        ProbesRan     = $false
        ProbesAttempted = 0
        ProbesAnswered  = 0
        Probed        = @()
        NotIgnored    = @()
        Unexpected    = @()
        Tracked       = @()
        HistoryPaths  = @()
        Remote        = ""
        Branch        = ""
        Detached      = $false
        Upstream      = ""
        # The raw branch.<name>.merge value, which is what git itself compares,
        # and the bare branch name derived from it for the report's prose.
        UpstreamMergeRef = ""
        UpstreamBranch = ""
        # git's own default since 2.0, which is what an unset push.default
        # means, so the unread and the unset states read alike here.
        PushDefault   = "simple"
        RemoteBranches = @()
        RemoteBranchesRead = $false
        DestinationRead = $false
        Dirty         = $false
        DirtyKnown    = $false
        DirtyCount    = 0
        Notes         = @()
    }

    if ($null -eq (Get-Command $GitExe -ErrorAction SilentlyContinue)) {
        $status.GitAvailable = $false
        return $status
    }
    if (-not (Test-Path -LiteralPath $StoreRoot -PathType Container)) {
        $status.Notes += "$StoreRoot does not exist."
        return $status
    }

    $status.IgnoreState = Get-MemorySyncFileState -Path (Join-Path $StoreRoot ".gitignore") -Expected (Get-MemorySyncIgnoreText)
    $status.AttrState = Get-MemorySyncFileState -Path (Join-Path $StoreRoot ".gitattributes") -Expected (Get-MemorySyncAttributesText)

    # A .git directory in the root itself, never one inherited from a parent:
    # rev-parse --is-inside-work-tree would answer true for a store root that
    # happens to sit inside somebody else's checkout.
    if (-not (Test-Path -LiteralPath (Join-Path $StoreRoot ".git"))) { return $status }
    $status.IsRepo = $true
    $status.IsOwnRepo = Test-MemorySyncRepoIsOwn -StoreRoot $StoreRoot -GitExe $GitExe

    $remote = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("remote", "get-url", "origin") -GitExe $GitExe
    if ($remote.Code -eq 0 -and $remote.Output.Count -gt 0) { $status.Remote = $remote.Output[0].Trim() }

    # Where a push from this machine would actually land. The allowlist proves
    # what may be published; this proves there is anywhere to publish it to. A
    # store passes every leak probe above and still replicates nowhere when it
    # has no remote, when its branch tracks nothing, or when origin carries a
    # branch name this machine does not track. The last is the silent one: both
    # the pull and the push succeed, neither reports anything, and no machine
    # ever sees another's memories.
    #
    # Every read here is of a local ref, so the answer costs no network and is
    # as of the last fetch, which is a limit the report states rather than hides.
    $branch = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("rev-parse", "--abbrev-ref", "HEAD") -GitExe $GitExe
    if ($branch.Code -eq 0 -and $branch.Output.Count -gt 0) {
        $status.DestinationRead = $true
        # A detached HEAD answers with the literal string rather than failing,
        # so the name is only a branch when it is not that string.
        if ($branch.Output[0].Trim() -eq "HEAD") { $status.Detached = $true }
        else { $status.Branch = $branch.Output[0].Trim() }
    }

    # No upstream exits nonzero, which is the answer "this branch tracks
    # nothing" rather than a failure to read, so it is recorded as data and
    # never as an unproven probe.
    $upstream = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}") -GitExe $GitExe
    if ($upstream.Code -eq 0 -and $upstream.Output.Count -gt 0) { $status.Upstream = $upstream.Output[0].Trim() }

    # What a bare push, which is what the sync runner issues, does with this
    # branch's pair of names. The value decides everything from a fatal refusal
    # to a push that succeeds while publishing nothing, so the setting is part
    # of whether the destination is reachable at all rather than a formatting
    # detail of the report. It is kept as configured, uppercase and all, because
    # git parses it byte-exactly and rejects a value it does not recognize.
    $pushDefault = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("config", "--get", "push.default") -GitExe $GitExe
    if ($pushDefault.Code -eq 0 -and $pushDefault.Output.Count -gt 0 -and $pushDefault.Output[0].Trim() -ne "") {
        $status.PushDefault = $pushDefault.Output[0].Trim()
    }

    # The ref git compares the local branch against. It is kept raw, because
    # git's own comparison is byte-exact against the configured value: a short
    # form (`merge = main`) and a differently-cased ref are both refusals that a
    # normalized copy would hide. The bare branch name is derived from it for
    # the report's prose, and needs no remote-prefix parsing, so it stays right
    # for a branch name that itself contains a slash.
    if ($status.Branch -ne "" -and $status.Upstream -ne "") {
        $merge = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("config", "--get", "branch.$($status.Branch).merge") -GitExe $GitExe
        if ($merge.Code -eq 0 -and $merge.Output.Count -gt 0) {
            $status.UpstreamMergeRef = $merge.Output[0].Trim()
            $status.UpstreamBranch = ($status.UpstreamMergeRef -replace "^refs/heads/", "")
        }
    }

    # refname:short renders refs/remotes/origin/HEAD as the bare remote name,
    # so both that and the unshortened form are dropped: neither is a branch,
    # and counting either as one reports a divergence on a healthy store.
    $remoteRefs = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("for-each-ref", "--format=%(refname:short)", "refs/remotes/origin") -GitExe $GitExe
    if ($remoteRefs.Code -eq 0) {
        $status.RemoteBranchesRead = $true
        $status.RemoteBranches = @($remoteRefs.Output |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ -ne "" -and $_ -ne "origin" -and $_ -ne "origin/HEAD" })
    }

    $dirty = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("status", "--porcelain", "--untracked-files=all") -GitExe $GitExe
    if ($dirty.Code -eq 0) {
        $status.DirtyKnown = $true
        $dirtyLines = @($dirty.Output | Where-Object { $_.Trim() -ne "" })
        $status.DirtyCount = $dirtyLines.Count
        $status.Dirty = $dirtyLines.Count -gt 0
    }

    $status.ProbesRan = $true
    $status.ProbesAttempted += 1
    $ignoreProbeOk = $true
    foreach ($probe in (Get-MemorySyncProbePaths -StoreRoot $StoreRoot)) {
        $status.Probed += $probe
        # --no-index asks what the ignore rules say, independently of the
        # index, because check-ignore otherwise answers "not ignored" for a
        # tracked file and would blame the rules for what the ls-files probe
        # below is the one to report.
        $result = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("check-ignore", "-q", "--no-index", "--", $probe) -GitExe $GitExe
        # 0 is ignored and 1 is not ignored; anything else is git failing to
        # answer, which is not the same as a path being staged and is reported
        # as its own note so it can never read as a clean probe.
        if ($result.Code -eq 1) { $status.NotIgnored += $probe }
        elseif ($result.Code -ne 0) {
            $status.ProbesRan = $false
            $ignoreProbeOk = $false
            $status.Notes += ("git check-ignore failed for ${probe}: " + ($result.Output -join " "))
        }
    }
    if ($ignoreProbeOk) { $status.ProbesAnswered += 1 }

    $status.ProbesAttempted += 1
    $dryRunOk = $true
    $dryRun = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("add", "-A", "--dry-run") -GitExe $GitExe
    if ($dryRun.Code -ne 0) {
        $status.ProbesRan = $false
        $dryRunOk = $false
        $status.Notes += ("git add --dry-run failed: " + ($dryRun.Output -join " "))
    }
    else {
        foreach ($line in $dryRun.Output) {
            # Lines read: add 'path' / remove 'path'.
            if ($line -match "^\s*\w+\s+'(.+)'\s*$") {
                $candidate = $Matches[1]
                if ($candidate.StartsWith('"')) {
                    # A backstop. This form of the command prints a path
                    # verbatim inside the single quotes, so a quotepath-encoded
                    # path is not expected here; were one to arrive, it could
                    # not be decoded back to the path it names, and calling an
                    # ordinary unicode-named memory file a leak is the wrong
                    # answer, so it reports as unproven.
                    $status.ProbesRan = $false
                    $dryRunOk = $false
                    $status.Notes += ("Unreadable git add --dry-run path: " + $candidate)
                    continue
                }
                if (-not (Test-MemorySyncPathAllowed -RelativePath $candidate)) { $status.Unexpected += $candidate }
            }
            elseif ($line.Trim() -ne "") {
                # A line in a shape this probe cannot read is unproven, never
                # assumed harmless: a leak probe with a silent-drop branch is
                # not a probe.
                $status.ProbesRan = $false
                $dryRunOk = $false
                $status.Notes += ("Unreadable git add --dry-run line: " + $line)
            }
        }
    }
    if ($dryRunOk) { $status.ProbesAnswered += 1 }

    # core.quotePath=false makes ls-files print a path holding non-ASCII bytes
    # as itself rather than octal-escaped inside double quotes. Without it an
    # ordinary memory file whose name carries an accent reads as a path outside
    # the allowlist, which is a permanent wrong FAIL carrying a remedy naming a
    # literal that does not exist.
    $status.ProbesAttempted += 1
    $trackedOk = $true
    $tracked = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments (Get-MemorySyncLsFilesArguments) -GitExe $GitExe
    if ($tracked.Code -ne 0) {
        $status.ProbesRan = $false
        $trackedOk = $false
        $status.Notes += ("git ls-files failed: " + ($tracked.Output -join " "))
    }
    else {
        foreach ($line in $tracked.Output) {
            $candidate = ([string]$line).Trim()
            if ($candidate -eq "") { continue }
            if ($candidate.StartsWith('"')) {
                # A backstop for a quoted path arriving despite the setting
                # above. It cannot be decoded back to the path it names, so it
                # is unproven rather than assumed either way.
                $status.ProbesRan = $false
                $trackedOk = $false
                $status.Notes += ("Unreadable git ls-files path: " + $candidate)
                continue
            }
            # A tracked path is staged regardless of the ignore rules, which is
            # why this probe exists beside the two that read them.
            if (-not (Test-MemorySyncPathAllowed -RelativePath $candidate)) { $status.Tracked += $candidate }
        }
    }
    if ($trackedOk) { $status.ProbesAnswered += 1 }

    # Committed history, which none of the three probes above can see. A blob
    # that reached a commit stays reachable after the path is untracked, so a
    # repository can read clean on the rules, the worktree, and the index while
    # still holding a credential that a push would publish.
    #
    # The reachable object graph is the surface, not the per-commit diffs: a
    # merge commit lists no file names under git log's default --diff-merges=off,
    # so a blob introduced only during a merge resolution is reachable from a
    # ref, would be published by a push, and appears in no log output at all.
    # rev-list walks objects instead of diffs and cannot miss it. The blob
    # filter is what keeps the output to paths that name a file: without it,
    # rev-list also emits the tree entry for every directory, and a bare
    # directory name is not a path this allowlist admits, so a clean repository
    # would read as a leak. Lines carry an object id, then a space, then the
    # path; a line that is an id alone is a commit object and names no path.
    #
    # A repository with no commits yet emits nothing at exit 0, which is a
    # clean result rather than a failure.
    $status.ProbesAttempted += 1
    $historyOk = $true
    # Scoped to local pushable refs (branches and tags) rather than --all: the
    # outbound leak check is about what THIS store would publish, and --all also
    # spans refs/remotes, so a disallowed path a peer pushed and this store
    # merely fetched (and refused) would otherwise read as a local leak and
    # wedge the sync under the wrong reason with a remedy that cannot clear it.
    $history = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("rev-list", "--objects", "--branches", "--tags", "--filter=object:type=blob") -GitExe $GitExe
    if ($history.Code -ne 0) {
        $status.ProbesRan = $false
        $historyOk = $false
        $status.Notes += ("git rev-list --filter=object:type=blob failed, so committed history is unproven (the filter needs git 2.32 or newer): " + ($history.Output -join " "))
    }
    else {
        $seen = @{}
        foreach ($line in $history.Output) {
            $trimmed = ([string]$line).TrimEnd()
            if ($trimmed -eq "") { continue }
            $split = $trimmed.IndexOf(' ')
            # An id with no path is a commit or tag object, which names no file.
            if ($split -lt 0) { continue }
            $candidate = $trimmed.Substring($split + 1).Trim()
            if ($candidate -eq "") { continue }
            if ($candidate.StartsWith('"')) {
                # A path holding non-ASCII or control bytes arrives
                # quotepath-encoded, and this probe cannot decode it back to
                # the path it names. An unreadable line is unproven, never
                # assumed harmless: a leak probe with a silent-drop branch is
                # not a probe.
                $status.ProbesRan = $false
                $historyOk = $false
                $status.Notes += ("Unreadable git rev-list path: " + $candidate)
                continue
            }
            if ($seen.ContainsKey($candidate)) { continue }
            $seen[$candidate] = $true
            if (-not (Test-MemorySyncPathAllowed -RelativePath $candidate)) { $status.HistoryPaths += $candidate }
        }
    }
    if ($historyOk) { $status.ProbesAnswered += 1 }

    return $status
}

# Bring the store root to the canonical sync state: initialize the repo when
# it is not one, write each managed file that is missing or has drifted from
# the text above, and commit what the allowlist admits.
#
# Additive only. An existing .git is kept as it stands, and a managed file
# without the marker line is left exactly as found and named in the notes,
# because a file this script did not write is not this script's to replace.
# Writing is UTF-8 without a BOM.
#
# Nothing is staged or committed until both managed files read Canonical and
# the whole index answers to the allowlist. Those two gates are positive: they
# assert the state that makes a commit safe rather than testing the paths by
# which it could be unsafe, so the guarantee does not depend on which branch
# above reached them, and an already-tracked file that predates the allowlist
# blocks the commit instead of riding into it. The index gate runs before the
# add as well as after it, and a refusal after the add restores the index to
# the tree it held before, so no refusal leaves a disallowed path staged in a
# repository the operator may be about to give a remote.
#
# An empty commit is not an error. A store whose tiers hold nothing yet (the
# operator tier before it exists, a fresh machine) legitimately stages
# nothing beyond the two managed files, and reporting that as a failure would
# turn a correct initialization into a red check.
function Install-MemorySyncRepo {
    param(
        [Parameter(Mandatory = $true)][string]$StoreRoot,
        [string]$GitExe = "git"
    )
    $notes = @()
    if ($null -eq (Get-Command $GitExe -ErrorAction SilentlyContinue)) {
        return @{ Ok = $false; Notes = @("git is not on PATH, so the memory sync repo cannot be initialized.") }
    }
    if (-not (Test-Path -LiteralPath $StoreRoot -PathType Container)) {
        return @{ Ok = $false; Notes = @("$StoreRoot does not exist, so there is no store to sync.") }
    }

    if (-not (Test-Path -LiteralPath (Join-Path $StoreRoot ".git"))) {
        $init = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("init", "--quiet") -GitExe $GitExe
        if ($init.Code -ne 0) {
            return @{ Ok = $false; Notes = @("git init failed in ${StoreRoot}: " + ($init.Output -join " ")) }
        }
        $notes += "Initialized $StoreRoot as a git repository."
    }
    elseif (-not (Test-MemorySyncRepoIsOwn -StoreRoot $StoreRoot -GitExe $GitExe)) {
        # Somebody else's repository at the store root: report it and stop
        # before writing a file, staging anything, or making a commit in it.
        $note = "$StoreRoot is already a git repository that the doctor did not create, and it carries no doctor-written .gitignore."
        $remote = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("remote", "get-url", "origin") -GitExe $GitExe
        if ($remote.Code -eq 0 -and $remote.Output.Count -gt 0) { $note += " Its origin is " + $remote.Output[0].Trim() + "." }
        return @{ Ok = $true; Notes = @($note, "Nothing was written, staged, or committed there.") }
    }

    # The repository is the doctor's own from here on, so record that as a git
    # config key. It is written on every repair, which is what gives a
    # repository recognized only by its marker-bearing .gitignore evidence that
    # survives that file's deletion.
    $mark = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("config", "--local", $script:MemorySyncOwnKey, $script:MemorySyncOwnValue) -GitExe $GitExe
    if ($mark.Code -ne 0) {
        $notes += ("Could not record the ownership marker (git config $script:MemorySyncOwnKey): " + ($mark.Output -join " "))
    }

    $utf8 = New-Object System.Text.UTF8Encoding($false)
    foreach ($managed in (Get-MemorySyncManagedFiles)) {
        $path = Join-Path $StoreRoot $managed.Name
        $state = Get-MemorySyncFileState -Path $path -Expected $managed.Text
        switch ($state) {
            "Canonical" { }
            "Foreign" {
                $notes += ("$($managed.Name) exists and was not written by the doctor; leaving it untouched.")
            }
            default {
                try { [System.IO.File]::WriteAllText($path, $managed.Text, $utf8) }
                catch { return @{ Ok = $false; Notes = ($notes + @("Could not write ${path}: $($_.Exception.Message)")) } }
                $notes += if ($state -eq "Drift") { "Restored the canonical $($managed.Name)." } else { "Wrote $($managed.Name)." }
            }
        }
    }

    # Both managed files must read Canonical on disk right now. Anything else
    # means the rules that would govern the add are not the rules this script
    # derives, so nothing is staged and nothing is committed.
    foreach ($managed in (Get-MemorySyncManagedFiles)) {
        $state = Get-MemorySyncFileState -Path (Join-Path $StoreRoot $managed.Name) -Expected $managed.Text
        if ($state -ne "Canonical") {
            return @{ Ok = $false; Notes = ($notes + @(
                "$($managed.Name) in $StoreRoot does not hold the canonical allowlist (it reads as $state), so the rules governing an add here are not the doctor's.",
                "Nothing was staged or committed. The store root holds .credentials.json, settings.json, history.jsonl, and every session transcript.")) }
        }
    }

    # The whole index, not the staged difference: a file tracked before the
    # allowlist existed is unmodified, so it appears in ls-files and in no
    # diff, and a commit would carry it forward untouched. The index is left
    # exactly as it stands; untracking somebody's file is the operator's call.
    $indexGate = {
        $indexed = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments (Get-MemorySyncLsFilesArguments) -GitExe $GitExe
        if ($indexed.Code -ne 0) {
            return @("git ls-files failed, so the index could not be checked against the allowlist and nothing was committed: " + ($indexed.Output -join " "))
        }
        $disallowed = @()
        foreach ($line in $indexed.Output) {
            $candidate = ([string]$line).Trim()
            if ($candidate -eq "") { continue }
            if ($candidate.StartsWith('"')) {
                return @("git ls-files returned a path this check cannot read ($candidate), so the index could not be checked against the allowlist and nothing was committed.")
            }
            if (-not (Test-MemorySyncPathAllowed -RelativePath $candidate)) { $disallowed += $candidate }
        }
        if ($disallowed.Count -eq 0) { return @() }
        $named = ($disallowed | Select-Object -First 5) -join ", "
        if ($disallowed.Count -gt 5) { $named += " (and $($disallowed.Count - 5) more)" }
        return @(
            "The index in $StoreRoot holds $($disallowed.Count) path(s) the allowlist does not admit, so no commit was made: $named",
            "Untrack them (git rm --cached) and re-run; the doctor removes nothing from an index it did not fill.")
    }

    # Before the add, so the ordinary refusal changes nothing at all.
    $preAdd = & $indexGate
    if ($preAdd.Count -gt 0) {
        return @{ Ok = $false; Notes = ($notes + $preAdd + @("Nothing was staged; the index is exactly as it was found.")) }
    }

    # The index as a tree object, so a refusal after the add can put it back
    # exactly. An empty index writes the empty tree rather than failing, which
    # is what makes a fresh initialization no special case. Only the index is
    # ever restored: read-tree writes no working file, so nothing on disk is
    # touched by a refusal.
    $savedTree = ""
    $writeTree = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("write-tree") -GitExe $GitExe
    if ($writeTree.Code -eq 0 -and $writeTree.Output.Count -gt 0) { $savedTree = $writeTree.Output[0].Trim() }

    $add = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("add", "-A") -GitExe $GitExe
    if ($add.Code -ne 0) {
        return @{ Ok = $false; Notes = ($notes + @("git add failed: " + ($add.Output -join " "))) }
    }
    # And after it, because what the commit would carry is the index the add
    # produced, not the one it started from. A disallowed path reaching the
    # index here is one an add pulled in, so the index goes back to what it
    # held before rather than being left for the operator to unstage.
    $postAdd = & $indexGate
    if ($postAdd.Count -gt 0) {
        $restored = "The staged paths could not be restored, so the index still holds what the add staged; nothing was committed."
        if ($savedTree -ne "") {
            $readTree = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("read-tree", $savedTree) -GitExe $GitExe
            if ($readTree.Code -eq 0) { $restored = "The index was returned to what it held before this run; no file on disk was changed and nothing was committed." }
            else { $restored += " (git read-tree: " + ($readTree.Output -join " ") + ")" }
        }
        return @{ Ok = $false; Notes = ($notes + $postAdd + @($restored)) }
    }

    # --name-only rather than --quiet's bare exit code, so the same call
    # answers both "is there anything to commit" and "how many paths", which
    # is what lets the final note say a real count instead of a fixed
    # sentence. This is also what makes a healthy, canonical repo with
    # uncommitted memory-tier changes reach a commit at all: the caller may
    # invoke this function with both managed files already Canonical, purely
    # because the worktree is dirty, and the count is the only way the note
    # distinguishes "committed pending changes" from the repair notes above it
    # in the same list.
    $stagedNames = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("diff", "--cached", "--name-only") -GitExe $GitExe
    if ($stagedNames.Code -ne 0) {
        return @{ Ok = $false; Notes = ($notes + @("git diff --cached --name-only failed, so what would be committed could not be counted: " + ($stagedNames.Output -join " "))) }
    }
    $stagedCount = @($stagedNames.Output | Where-Object { $_.Trim() -ne "" }).Count
    if ($stagedCount -eq 0) {
        $notes += "Nothing to commit; the repository already holds the current memory tiers."
        return @{ Ok = $true; Notes = $notes }
    }
    $commit = Invoke-MemorySyncGit -StoreRoot $StoreRoot -Arguments @("commit", "--quiet", "-m", "kit memory sync: allowlist and memory tiers") -GitExe $GitExe
    if ($commit.Code -ne 0) {
        return @{ Ok = $false; Notes = ($notes + @("git commit failed: " + ($commit.Output -join " "))) }
    }
    $notes += ("Committed " + $stagedCount + " pending change(s) admitted by the allowlist.")
    return @{ Ok = $true; Notes = $notes }
}
