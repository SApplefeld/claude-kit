# Rationale ledger: kit-doctor

This file is the rationale ledger for the documents the `kit-doctor` skill owns. Rule text says what happens; this ledger says why; git says when. Nobody loads it by default. A session about to change a rule in one of the documents below reads the entry for the claim it is changing first, so the reason a rule holds is not re-litigated at the next review.

Each document sits under its own heading, which opens with its inventory line (what the document is for, which moments it owns, and when a session loads it) and then carries one entry per claim, retired claims included so the next audit does not re-find them. An entry is keyed by the claim's imperative sentence and carries its class (rule, mechanic, pointer, or rationale-example), its source as file and line, its provenance (the commit, incident, memory or kaizen note that installed it, or `no provenance found`), and its verdict (keep, rewrite, or retire) with the reason. A `C` entry's source line is read at the extraction commit `6bc07fb`; an `R` entry is a claim re-extracted from a hunk the Section 5 merge changed, and its source line is read at the merged commit `d9540ad`. Claim numbers restart under every document heading, and inside a document read in chunks they restart per chunk, so an entry id is unique only under its heading and a chunked document carries the chunk in the id (`c2.C001` is claim C001 of the second chunk); a claim named inside a reason or provenance line of such a document carries the same prefix. A `C` entry whose source hunk the Section 5 merge rewrote reads `retire` and carries a `superseded-by:` line naming the `R` entry that holds the passage at the merged commit; the passage's own verdict is that entry's, so a count of retirements over this ledger leaves those records out. A reason may name the form the judge ruled toward (a pointer at the owner, a split, a fold into a neighbour), because that form is why the verdict is rewrite rather than keep or retire; what a passage becomes is the rewrite plan's to decide, and where the two differ the rewrite plan governs. The target wording a judge proposed rides on the entry's `proposed:` line, one line per distinct proposal, on rewrite and retire entries that retire a passage; a proposal that pointed at another ruling by id carries the resolved text marked `(via Annn)`. A rewrite or retire the judge flagged as behavior-shaping carries `baseline-test: yes`, which is what the rewrite plan's RED and GREEN step keys on. What a passage becomes is the rewrite plan's to decide (`claude-kit_corpus-rewrite_spec_v1.md` under `docs/plans/`), and where it and a proposal differ the rewrite plan governs.

## plugins/claude-kit/skills/kit-doctor/SKILL.md

This document is the kit-doctor skill: it tells a session how to validate and repair a machine's claude-kit installation using the doctor command that ships inside the plugin payload. It owns the moments of locating the correct `doctor.cmd` among competing copies and verifying it is genuine, choosing between check mode, `-Fix`, and `-Fix -Yes` and the consent each requires, reading the doctor's exit codes and its per-line verdicts (doctrine freshness, memory sync and credential exposure, the semantic-search embedder), and the post-fix re-check and reporting. A session loads it on a named trigger: when the kit was just installed or updated on a machine, when a kit capability such as hooks, memory tooling, or doctrine loading misbehaves, or when the operator asks to run the doctor, check the install, or verify kit setup. Load class: `named-trigger`.

Extracted at `6bc07fb`: whole document (`skills.kit-doctor.SKILL.md`).

### C001
- key: Do not fetch anything before running the doctor; it ships inside the plugin payload on every machine that has the plugin.
- class: rationale-example
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:8
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's design decision that the doctor ships in the payload so every plugin update delivers the current doctor (docs/archive/claude-kit_kit-doctor_spec_v1.md).
- verdict: retire
- reason: The locate rule at line 12 is obeyed without this clause; the why lives here. The doctor sits at `<plugin root>/doctor/` inside the payload, so a session never fetches or clones anything before locating it.
- proposed: Drop the clause after the semicolon at line 8 ("there is nothing to fetch first"); the ledger entry for C001 carries the why.

### C002
- key: Locate the doctor by taking the first of the three listed paths that exists.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:12
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's Section 2, which specified the locate order as plugin root, then the registered clone from the signpost, then a `doctor.cmd` in the cwd tree.
- verdict: keep
- reason: The first-that-exists rule is what makes the installed copy, the one this machine's sessions load, the default reporter (see C008). It is the owner of the ordering; C006's restatement retires into it.

### C003
- key: Try `<plugin root>\doctor\doctor.cmd` first, resolving the plugin root from `CLAUDE_PLUGIN_ROOT` or else this skill's base directory's grandparent.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:14
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's Section 2.
- verdict: keep
- reason: No finding. The installed copy reports on the payload the machine's sessions actually load (f102d37), which is why it is first.

### C004
- key: Try `<kitRepoPath>\plugins\claude-kit\doctor\doctor.cmd` second, taking `kitRepoPath` from `~/.claude/claude-kit.local.json`.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:15
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's Section 2 (the signpost's `kitRepoPath`).
- verdict: keep
- reason: No finding. The clone path exists to check the clone (C009), not to substitute for the install's verdict.

### C005
- key: Try `doctor.cmd` at the cwd's repo root third, when working inside a kit clone.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:16
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's Section 1 reduced the repo-root `doctor.cmd` to a forwarder to the payload.
- verdict: keep
- reason: No finding. The repo-root copy is a forwarder; its one recorded defect (a rejected flag exiting 0, 97d306f) was fixed in the forwarder, so the path stays usable.

### C006
- key: Prefer paths 1 and 2; use the cwd repo-root copy only as a last resort.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:16
- provenance: 318d6bf 2026-07-10, installed with the locate list; no incident of its own.
- verdict: retire
- reason: "Take the first path that exists" (C002) already fixes the preference over the same three candidates, so this is a within-document duplicate. Safe to delete because the forwarder's only known defect was fixed in code at 97d306f rather than by avoiding it.

### C007
- key: Expect each copy to report only on its own root, so the installed copy reports on the payload this machine's sessions load and the clone reports on the clone.
- class: rationale-example
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:18
- provenance: f102d37 2026-08-23, the dormant-feature-removal plan's blind-reviewer Major: a restored cache-lag caution told the operator to prefer the clone, and since every doctor check resolves against its own root, a clone run would have produced a clean report about the wrong payload.
- verdict: retire
- reason: The two instructions it supports (C008, C009) are obeyed without it, so it moves here. The mechanism to remember before reinstalling "prefer the clone": every check resolves against the doctor's own root, so a clone run never inspects the stale cache the machine's sessions load.
- proposed: Move "Every check resolves against the doctor's own root ..." to the ledger; the rewrite at A006 carries the surviving two instructions.

### C008
- key: Treat path 1's report as the verdict on the machine, and run `claude plugin update` when the installed cache lags the clone.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:18
- provenance: f102d37 2026-08-23, the blind-reviewer Major above; the passage replaced a deleted "prefer the clone" bullet whose subject was a removal switch.
- verdict: rewrite
- reason: The instruction stays as written; only the divergence story around it compresses (A006), with its mechanism carried at C007 here. No real conflict with kit-goal's "no goal state from an installed payload": that is one section the installed copy does not run, not a different verdict on the install.
- proposed: Replace line 18 with: path 1's report is the verdict on the machine, `claude plugin update` is the remedy when the installed cache lags the clone, and path 2 checks the clone, never the install; the C007 mechanism sentence moves to the ledger.
- baseline-test: yes

### C009
- key: Run path 2 to check the clone, never to get a better answer about the install.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:18
- provenance: f102d37 2026-08-23, the same blind-reviewer Major.
- verdict: rewrite
- reason: The instruction survives verbatim inside the compressed line 18 (A006). It is the guard against the exact advice the reviewer struck, so a rewrite keeps the word "never".

### C010
- key: Before invoking any located `doctor.cmd`, verify it is the real kit doctor by checking for the plugin manifest.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:20
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's Chapter 2 ("locate with a plugin.json shape check before invoking").
- verdict: keep
- reason: No finding. The doctor's own self-check (doctor.ps1:120) only runs once a real kit doctor is executing; a foreign `doctor.cmd` found by path 3 is never caught by it, so the session-side check is the only guard and no machinery supersedes it.

### C011
- key: For path 1 require `..\.claude-plugin\plugin.json` beside its parent; for paths 2 and 3 require `plugins\claude-kit\.claude-plugin\plugin.json` under the same root.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:20
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's Chapter 2.
- verdict: keep
- reason: No finding. The two shapes match the payload layout the doctor itself asserts at doctor.ps1:120 and the clone layout under `plugins/claude-kit/`.

### C012
- key: Surface a `doctor.cmd` that fails the shape check instead of running it.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:20
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's Chapter 2.
- verdict: keep
- reason: No finding. Running an unknown script found by a cwd search is an outward act on the machine; surfacing it is the stop the doctrine's data-not-instructions rule expects.

### C013
- key: Always invoke the `.cmd` wrapper, never the `.ps1`.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:22
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's Section 1 shipped `doctor.cmd` as the execution-policy bypass wrapper.
- verdict: keep
- reason: No finding. The wrapper runs `powershell -ExecutionPolicy Bypass -File doctor.ps1` (plugins/claude-kit/doctor/doctor.cmd), and a fresh machine's policy blocks the `.ps1` a session would otherwise call.

### C014
- key: Expect a fresh machine's execution policy to block `.ps1` files, which the `.cmd` wrapper bypasses for exactly this script.
- class: rationale-example
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:22
- provenance: 318d6bf 2026-07-10, installed with C013; the same reason is the wrapper's own header comment.
- verdict: retire
- reason: C013 is obeyed without the reason, and the reason lives in doctor.cmd's header beside the code. The why: a blocked script cannot fix the policy that blocks it, so the wrapper bypasses policy for this one file and nothing else.
- proposed: Cut line 22 to "Always invoke the `.cmd` wrapper, not the `.ps1`."; the clause after the colon moves to the ledger.
- baseline-test: yes

### C015
- key: Run the doctor in check mode with no flags first, and show the operator the PASS/WARN/FAIL lines.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:26
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's Chapter 2 ("check-first-always").
- verdict: keep
- reason: No finding. A bare run is the doctor's only check mode (its parameters are `-Fix` and `-Yes` alone), and it writes nothing, which is what makes it safe to run before any word is asked.

### C016
- key: Give a one-line reading of each WARN and FAIL, naming what it breaks and the printed remediation.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:26
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's Chapter 2.
- verdict: keep
- reason: No finding. The doctor prints a remediation with every non-PASS line; the reading is what turns it into the operator's decision about `-Fix`.

### C017
- key: Never run `-Fix` unprompted; run it only on the operator's word.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:27
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's Chapter 2 ("`-Fix` on my word"); the repair inventory grew at ec46854 (embedder) and eac64fa (store sync).
- verdict: keep
- reason: A blast-radius gate: `-Fix` writes execution policy, the shim, the store repository and its managed files, installs software and wires hooks, and the operator-tier gotcha records show a fix pass rewrites drifted managed files and spends a pending operator decision as a side effect. The coordinator's off-Windows "hand run of the fix pass" and the operator's store-sync grant do not widen it: the moment's owner, memory-system:66, requires the go-ahead before `-Yes`, and the standing-grants plan ruled the sanctioned hand path is `sync-store.ps1`, not the fix pass.

### C018
- key: Expect `-Fix` to apply durable repairs (execution policy, memq shim wiring, the memory store's sync repo and allowlist, the local embedding stack, kaizen signpost and clone git hooks), prompt before installing anything, and delete nothing.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:27
- provenance: 318d6bf 2026-07-10 installed the description; "It deletes nothing" came at 8edc578 2026-07-24 to keep the destructive `-RemoveLegacyRelay` switch off the `-Fix -Yes` path, and the inventory grew at ec46854 and eac64fa.
- verdict: keep
- reason: The doctor does all of this itself, but the sentence is the content of the ask C017 requires: nothing shows the operator what `-Fix` will write before the word is asked, so the prose is the informed consent. Keep the inventory in step with the doctor's section headers when a repair is added or removed.

### C019
- key: Use `-Fix -Yes` only when the operator says the run is unattended.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:28
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's Chapter 2 ("`-Yes` named before use and required for tool shells").
- verdict: rewrite
- reason: The heading is narrower than the plan that installed it and than the tool-shell clause beside it: `-Yes` is required through a tool shell because the doctor declines every prompt on a redirected stdin, so the in-chat yes is the operator's word there. The rewrite states the bar as the operator's word in either form and loosens nothing.
- proposed: Reword the bullet heading so `-Fix -Yes` is passed only on the operator's word, with the two forms that word takes named together: an unattended run, or an attended install through a tool shell after the in-chat ask.
- proposed: One rewrite of line 28 carrying A012's heading, the "authorizes nothing by itself" statement, and the tool-shell chat-ask route with its one-clause reason; the prompt inventory moves per A015.
- baseline-test: yes

### C020
- key: Expect `-Yes` to pre-answer the consent prompts `-Fix` already asked for, such as an install or writing an absent `autoCompactWindow` value.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:28
- provenance: 318d6bf 2026-07-10 installed `-Yes` as "answer all prompts, for unattended runs"; the replacement-waits-for-a-person clause rides the doctor's `-Interactive` consent (doctor.ps1:75-95, :1741), reworded on this line at 97d306f 2026-08-23.
- verdict: rewrite
- reason: The pre-answer statement stays because it is what the session tells the operator; the prompt inventory leaves because the doctor prints each decline with its reason ("this one needs a person, since it replaces a value you chose"). Safe because the only behaviour the inventory described is reported by the run itself.
- proposed: Keep "`-Yes` pre-answers the consent prompts `-Fix` already asked for" and drop the parenthetical; the doctor's own decline line names the interactive-only case.
- baseline-test: yes

### C021
- key: State before running `-Yes` that it authorizes nothing by itself.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:28
- provenance: 8edc578 2026-07-24, the relay-cleanup commit that separated the destructive removal switch from `-Fix -Yes` and made `-Yes` a consent carrier only.
- verdict: rewrite
- reason: The instruction survives verbatim inside the compressed line 28 (A013). It exists so a session never reads `-Yes` as a grant: it consents to what the run's other flags already asked for, and the operator's word is the authorization.

### C022
- key: When an install is needed and `-Fix` runs through a tool shell, ask the operator in chat first, then pass `-Yes`.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:28
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's Chapter 2 ("required for tool shells"); the doctor's Get-Consent declines on a redirected stdin and says so.
- verdict: rewrite
- reason: A blast-radius gate that survives as written inside the rewritten bullet: the chat round is the consent for a software install the doctor cannot ask for through a tool shell, and memory-system:66 carries the same round for the store commit. Keep the one-clause reason (the prompt cannot reach a redirected stdin), or a session waits for a prompt that never comes.

### C023
- key: Read exit 0 with warnings as a working install with named gaps.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:32
- provenance: 4ad4f83 2026-08-23, the dormant-feature-removal finishing pass, which restated the exit-code contract after 97d306f fixed the forwarder.
- verdict: keep
- reason: No finding. The doctor exits 0 with WARN lines by design; a session must not read a WARN as a stop.

### C024
- key: On exit 1, use the report body to tell a real broken-dependency finding apart from no report at all, which is the doctor rejecting an undefined flag.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:32
- provenance: 4ad4f83 2026-08-23, a declared deviation: after 97d306f made the forwarder exit 1 on a rejected flag, exit 1 means two things, and an operator reading a bare exit 1 as a broken install was the failure that fix existed to prevent.
- verdict: keep
- reason: The discriminator is the instruction, and the incident recurs whenever a flag is added or removed while an older or newer doctor sits on a machine. No machinery reads the exit code on the session's behalf.

### C025
- key: When exit 1 produced no report, fix the command line rather than the install, since no checks ran.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:32
- provenance: 4ad4f83 2026-08-23, the same deviation.
- verdict: keep
- reason: Kept whole with C023 and C024 (A017): the compression offered dropped the report-body discriminator, which is what tells the two exit-1 cases apart.

### C026
- key: Read a doctrine-freshness WARN as the installed plugin lagging the clone or the reverse, which the doctrine-refresh hook resyncs on the next session once the plugin is current.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:33
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's Chapter 2; the hook is plugins/claude-kit/hooks/doctrine-refresh.js, wired in hooks.json.
- verdict: keep
- reason: No finding. The hook does the resync; the reading tells the session which remedy (a plugin update) precedes it.

### C027
- key: Do not copy doctrine files manually.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:33
- provenance: 318d6bf 2026-07-10, installed with C026.
- verdict: keep
- reason: No finding. A hand copy fixes one machine once and drifts at the next update; the refresh hook is the mechanism and the rule keeps sessions off the manual path.

### C028
- key: Read the `Memory sync` line before any push, because its FAIL means credentials are in reach.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:34
- provenance: eac64fa 2026-08-03, the memory-sync section: the store root is `~/.claude`, which also holds `.credentials.json`, `settings.json`, `history.jsonl` and every transcript, and the doctor gained four probes that prove the exclusion rather than assume it; widened at 70c3a3b 2026-08-28 to name the coordinator directory.
- verdict: keep
- reason: The one doctor line whose FAIL is a credential exposure rather than a broken feature, so it is read before the outward act it guards. Overlap with C032 is intentional: this says when the line is read, C032 what a FAIL earns.

### C029
- key: Expect the store root to hold `.credentials.json`, `settings.json`, `history.jsonl`, and every session transcript, with the repository there admitting only the memory tiers and the machine coordinator directory.
- class: rationale-example
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:34
- provenance: eac64fa 2026-08-03 installed the inventory; 70c3a3b 2026-08-28 corrected it to name the coordinator directory and rebuilt the pin as a sweep over every boundary sentence in the shipped tree.
- verdict: keep
- reason: A pinned copy: test/doctrine-parity.test.js (around :4119-4340) sweeps every "admits only" sentence in the shipped tree and reddens if one omits an admitted root, so the sentence must stay correct while it exists. It also tells a session reviewing a foreign managed file by hand (C033) what the repository may admit.

### C030
- key: Read a `Memory sync` PASS as the allowlist being canonical and all four probes answering clean.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:34
- provenance: eac64fa 2026-08-03 (check-ignore, dry-run add, ls-files and filtered rev-list, with the count of probes that answered).
- verdict: keep
- reason: No finding. PASS is a proven negative over four surfaces, not an absence of complaints, which is why the reading names the probes.

### C031
- key: Read a `Memory sync` WARN as the store root not being a repository yet, so nothing syncs and nothing is at risk; `-Fix` initializes it.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:34
- provenance: eac64fa 2026-08-03.
- verdict: keep
- reason: No finding. WARN is the one safe state on this line; without the reading a session treats a fresh machine as a leak.

### C032
- key: Stop and read on every `Memory sync` FAIL.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:34
- provenance: eac64fa 2026-08-03; the coordinator's and memory-system's "a FAIL there is a stop, not a push" restate it for the manual push (ff59e19 2026-09-01).
- verdict: keep
- reason: kit-doctor owns the reading of the doctor's report and states every FAIL class with its remedy; the coordinator and memory-system carry the stop as pointers. The stop exists because the four FAIL classes take four remedies and the wrong one is useless or destructive.

### C033
- key: When a managed file the doctor did not write, or a repository it did not create, is reported, review it by hand, since the doctor will not touch it.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:34
- provenance: eac64fa 2026-08-03 ("it never writes into a repository it did not create, and ownership rests on a git config marker"); the Foreign-versus-Drift inversion is recorded in the gotcha memories doctor-fix-is-never-a-neutral-committer and doctor-fix-rewrites-marker-carrying-managed-files.
- verdict: keep
- reason: `-Fix` refuses a Foreign file so as not to destroy a stranger's rules; the by-hand review is the only remedy, and no machinery performs it.

### C034
- key: Treat a drifted or missing allowlist as letting an add stage anything, and run `-Fix` to restore it.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:34
- provenance: eac64fa 2026-08-03 ("the allowlist is re-derived on every run, so a drifted ignore file is a FAIL").
- verdict: keep
- reason: Names `-Fix` as the remedy and does not license an unprompted run: C017 still governs when it runs, and the gotcha records show why the word matters (a fix pass rewrites every drifted marker-carrying file at once).

### C035
- key: For named leak paths, remedy with a history rewrite plus credential rotation rather than `-Fix`, which will not clear them.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:34
- provenance: eac64fa 2026-08-03 ("a filtered rev-list reads the object history, which the first three cannot see because untracking a blob does not remove it").
- verdict: keep
- reason: The one FAIL class where running the obvious remedy does nothing: untracking removes no blob, so the rule points at the rewrite and the rotation and keeps a session from reporting a leak as fixed.

### C036
- key: Treat probes that could not answer as an unproven negative rather than a clean result, which is why they fail rather than warn.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:34
- provenance: eac64fa 2026-08-03 ("a probe that cannot answer is a FAIL, never a quiet pass").
- verdict: keep
- reason: No finding. The doctrine's withheld-control rule in one line: silence from a probe that could not run is not a clean sweep.

### C037
- key: Read the `Embedder (semantic search)` line as reporting whether `memq find`'s local embedding stack is installed at `~\.claude\kit-embedder`.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:35
- provenance: ec46854 2026-08-03, the doctor's embedder section.
- verdict: keep
- reason: No finding. The line names the install location a session would otherwise have to find by hand.

### C038
- key: Read `absent` as nothing installed yet, with `find` still working lexical-only, and `unusable` as a present package with a missing or incomplete model cache needing repair rather than a fresh install.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:35
- provenance: ec46854 2026-08-03 ("absent is an install and unusable is a repair, and an operator who cannot tell them apart runs the wrong command").
- verdict: keep
- reason: No finding. The two states were separated by design so the remedy named is the right one.

### C039
- key: Expect `-Fix` to install or repair the embedder after a consent prompt naming about 400 MB of disk cost.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:35
- provenance: ec46854 2026-08-03 ("the install runs behind the existing consent prompt, which states the disk cost so the consent is informed"; the npm guard is doctor.ps1:1218-1229).
- verdict: rewrite
- reason: The cost stays because through a tool shell the doctor's prompt never reaches the operator and the in-chat ask (C022) must carry it. The npm-not-on-PATH clause and the runtime aside leave safely because the doctor prints the npm case itself.
- proposed: Keep "`-Fix` installs or repairs it after a consent prompt naming the real disk cost (about 400 MB)"; drop the platform-runtime parenthetical and the "never prompts when `npm` is not on PATH" clause.
- baseline-test: yes

### C040
- key: Read the index-health lines (record count, model identity, age) as describing the derived search index without rebuilding or touching it.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:35
- provenance: ec46854 2026-08-03 ("a check that rebuilt the index would have changed the thing it was reporting on").
- verdict: keep
- reason: No finding. Tells a session the check is read-only, so a stale index reading is not mistaken for a repair the doctor performed.

### C041
- key: Treat an absent or empty search index as normal on a machine that has not yet run a semantic query.
- class: mechanic
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:35
- provenance: ec46854 2026-08-03.
- verdict: keep
- reason: No finding. Without it an empty index reads as a defect on every fresh machine.

### C042
- key: After a `-Fix` run, re-run check mode and report which lines flipped.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:37
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's Chapter 2.
- verdict: keep
- reason: No finding. The doctrine's run-the-real-thing rule applied to the doctor: a FIXED line is the fix's claim, and the re-run is the reading.

### C043
- key: Report in one line each anything the fix changed on the machine, such as PATH, execution policy, or installed software.
- class: rule
- source: plugins/claude-kit/skills/kit-doctor/SKILL.md:37
- provenance: 318d6bf 2026-07-10, the kit-doctor plan's Chapter 2.
- verdict: keep
- reason: No finding. The doctrine's name-what-you-changed-outside-the-code rule for the one kit command that writes machine state.
