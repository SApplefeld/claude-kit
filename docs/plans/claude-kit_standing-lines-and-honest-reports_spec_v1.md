# The briefs carry their protections unconditionally, the reports state what they did not do, and a routed finding closes on a pointer

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-08-29

Session model: any executor session in the kit repo; four sections, tiers per section. Authored by the KIT: Expert seat from the 2026-08-29 kaizen pass over the eleven-item inbox. Anchors are authoring-time; re-locate every hit by content, since earlier queue plans edit two of these surfaces first.

## Dispatch Authorization

Authorized 2026-08-29 by the operator: a kaizen pass over the inbox with a follow-on plan scoped for the worker from its findings, given at the operator's keyboard in the expert seat's session and executed as this plan. This section was authored by the KIT: Expert seat; per the peer-sessions trace rule it is a warrant only for a citing session that did not author it, and the receiving session performs its own trace: the grant is the operator's kaizen-pass instruction in the expert session's transcript, and the plan entered the armed queue by the expert's append under the operator's standing throughput grant for this queue, the same path the queue's other expert-authored plans took.

## Goal

Six kaizen items and one coordinator-routed defect survived the pass as open work, and they share two shapes. Three are the audience gap: a protection stated to the party that understands it rather than the party that acts (the stash hazard and the guard-siting rule reach no dispatched implementer; the exit-code rule reads as scoped to suites because its examples are suites). Three are the honesty gap: a shipped surface asserting or implying something the code does not do (a skill sentence promising a push the fix pass never makes, a FIXED block displaying destination metadata beside a commit-only outcome, a routed finding whose disposition never reaches the surface that will re-notice it). When this plan is done: the memory-system skill's `-Fix` sentence is true against the code and the doctor's fix-pass report states the push's status explicitly; the Dispatch Brief template carries the whole-worktree prohibition and the hostile-boundary reuse step as standing lines; the doctrine's exit-code sentence names its scope as any command whose result you will act on; and the coordinator's board closes a routed finding only on a disposition pointer or an explicit open marker.

## Evidence

- The push defect, confirmed at source this session: `plugins/claude-kit/skills/memory-system/SKILL.md:65` calls `-Fix` "the way to push this session's writes immediately"; a quote-agnostic grep over `plugins/claude-kit/doctor/install-memory-sync.ps1` finds zero push invocations (only comments and a `push.default` config read), while `doctor/sync-store.ps1:548` issues the real `@('push', '--quiet')`, and `install-memory-sync.ps1:477`'s own comment names the runner as the pusher. Measured cost, reported by the routing coordinator from an ai-os seat: two `-Fix` runs each left the branch one commit ahead of origin, discovered by checking rather than by being told.
- The guard-siting incident, this repo, this week: `memory-session.js` held a private hardened git runner; three later hooks reimplemented the call without its protections, one of them written by an implementer whose brief quoted several house rules. Fixed at the instance as `hooks/kit-git-lib.js` (plan-lifecycle Chapter 4, one confirmed Critical); the loop that produced it is untouched. Project memory `a-stated-rule-is-not-a-sited-guard` carries the lesson.
- The stash hazard, two instances in two days from opposite directions (a section implementer stashing around its red/green beside a sibling's live work; a coordinator stashing around a rebase in a worker's checkout), neither party holding a rule that named it: the brief template's workspace-constraint field is conditional ("when any are in effect", `executing-work/SKILL.md:125`), so it reaches an implementer only when the orchestrator remembers to forward it.
- The exit-code scope gap, two instances from two seats in one night: a CLI's exit status read as `$?` after a pipe through `head` (the pipe's status, not the command's), and a `^##` grep near-miss against a kit section; both instruments judged too small for a rule whose every example is a suite or a gate. The doctrine's sentence (`home/claude-kit-doctrine.md:81`) carries no scope clause today, confirmed by grep this session.
- The re-raise incident: a coordinator-routed finding was dispositioned into a plan section on the fixer's surface; the disposition traveled back only as a message, the message died with the receiving session's context, and a successor pass honestly re-found and re-raised the finding, costing a full verify-and-dedup round on both seats. The coordinator ledger's dedup today covers operator escalations only (`coordinator/SKILL.md:69`).

## Approach

Each section is one surface, edited once, with the general lesson stated where the acting party reads it rather than where the knowing party does. Skill and doctrine amendments are reviewed whole-file per the recorded amendment defect mode. Nothing here changes enforcement mechanics: every fix is a sentence, a template line, a clause, or a report field.

## Standing Brief Amendments

1. Re-read every anchor at implementation. The plan-lifecycle plan's Section 5 edits `executing-work/SKILL.md` and its Section 7 already edited `coordinator/SKILL.md`; line numbers in this spec are authoring-time and will have moved.
2. A skill or doctrine amendment is reviewed whole-file, not diff-only: the recorded defect mode for these files lives in the seam between the edit and its unchanged neighbours.
3. The doctrine has three copies: `home/claude-kit-doctrine.md` is the source, the operator's installed copy is refreshed by the established doctor step, and the third is regenerated build staging. Edit the source only; `test/doctrine-parity.test.js` pins the register core, which none of this plan's edits touch (prove by running it, not by assuming).

## Sections of Work

### 1. The memory-system skill stops promising a push the fix pass does not make, and the FIXED block states the push's own status

Model: opus

Two halves of one honesty defect, routed by the machine coordinator 2026-08-29 and confirmed at source (Evidence, first bullet).

- The sentence: `memory-system/SKILL.md:65` is corrected to say the fix pass commits, and that what carries a commit to the remote is the background sync runner at the next session start or the manual push the same paragraph already documents. The fork was priced and the answer is recorded here so it is not re-litigated: making the pass push would honor the sentence as written, and it is declined because the push deliberately lives in one place (`sync-store.ps1`, as `install-memory-sync.ps1:477`'s comment states), a second push path doubles the credential and destination surface, and `-Yes` consent would silently widen from a local commit to a network act. The sentence changes; the code's division of labor does not.
- The report: the fix pass's FIXED output block prints the origin URL and a Destination line beside a commit-only outcome, which reads as delivery. The block gains the coupled fact stated explicitly: committed, not pushed, and what carries it (the next session start's sync runner, or the manual push). The general shape, from the inbox note that captured it: a report naming one of a coupled pair states the other's status explicitly, including and especially when the answer is "not attempted", because silence beside a destination line reads as success.

Tests: the doctor's PowerShell has no unit lane for output blocks; acceptance is source-read plus a real run. Run the fix pass on this machine's store (a no-op FIXED or PASS run is fine), read the emitted block, and confirm the new line renders; confirm by quote-agnostic grep that the pass still issues no push; confirm the corrected skill sentence against `sync-store.ps1:548`. The quote-agnostic form is load-bearing: the first sweep of this code missed the runner's push because the runner quotes singly where the fix pass quotes doubly, so run the pattern's positive control against the runner's real push before trusting a zero.

Files in scope: `plugins/claude-kit/skills/memory-system/SKILL.md`, `plugins/claude-kit/doctor/install-memory-sync.ps1`.

### 2. The Dispatch Brief template's two hazard protections become standing lines

Model: opus

Both fixes are the same repair to the same audience gap: a hazard stated in the voice of the seat that understands it binds nobody who has not read it, and the acting party (a dispatched implementer) holds only its brief. The template lives at `executing-work/SKILL.md:104` (authoring-time anchor).

- The whole-worktree line, standing rather than conditional: every brief carries the prohibition on whole-worktree operations (a bare `git stash`, a reset or checkout reaching beyond the agent's own files), on the stated ground that an implementer can never see from the tree whether a sibling session's uncommitted work is live, so the orchestrator's judgment that none is cannot be the gate. The existing conditional workspace-constraints field stays for the genuinely stateful extras (a process holding binaries, a named foreign worktree); the two whole-worktree examples it currently carries move up into the standing line so the conditional field is not read as making them conditional.
- The hostile-boundary line, standing: before writing a call at a hostile boundary (spawning a process, building a child environment, sanitizing text bound for a trusted channel, clamping a bound), grep the tree for that boundary's other callers; where a correct one exists, export and use it rather than matching it by hand. One grep, no new capability, and it closes the loop the kit-git-lib Critical proved is open: the doctrine states the guard-belongs-to-the-channel rule and the defect shipped anyway, because the rule was addressed to nobody at the moment of writing.

Discipline: writing-skills; baseline-test the wording (these lines shape implementer behavior); whole-file review per Standing Amendment 2. Grep `test/` and the tree for pins over the template's text before editing (a filename grep is not the whole pin surface; the parity test walks the tree).

Tests: none mechanical beyond existing pins staying green; acceptance is the template carrying both lines unconditionally and the conditional field no longer listing the whole-worktree examples as its illustration.

Files in scope: `plugins/claude-kit/skills/executing-work/SKILL.md`, any test the pin grep surfaces.

### 3. The exit-code rule names its scope

Model: sonnet

One clause on the doctrine's existing sentence "Read the result from the run's own exit code, never from a grep over its output narrowed to the lines you expected" (`home/claude-kit-doctrine.md:81`, authoring-time): the rule's scope is any command whose result you will act on, regardless of what it cost to run. That is the clause the expert seat ruled when the item was filed, recorded in the note: the rule's every example is a suite or a gate, a reader derives scope from example class, and the boundary of a narrowly-scoped rule is invisible from inside, so the cheap call (a CLI probe piped through `head`, a small grep) is where it silently stops applying. The clause names the scope; no new rule ships.

Standing Amendment 3 governs the copies. Whole-file review per Standing Amendment 2. Acceptance: the clause reads in place without disturbing the sentence's existing lane context; `test/doctrine-parity.test.js` green (the edit is outside the register core; prove it by the run).

Files in scope: `home/claude-kit-doctrine.md`.

### 4. A routed finding rides the finder's board until its disposition pointer lands

Model: opus

The coordinator skill's ledger closes the re-raise loop (Evidence, last bullet). The clause, landed where the re-noticing actually happens: a finding this seat routed to another seat for handling is a boarded commitment like an open escalation, and its line is not closed, and not sweepable-past by a successor, until it carries either a disposition pointer (the plan section, commit, or backlog entry that landed the fix, which the fixer's reply supplies and the seat asks for where the reply omits it) or an explicit open marker naming what it waits on. A disposition that lives only on the fixer's surface is re-raised by every successor of the finder, because the finder's sweep re-derives the finding from the world while nothing the finder's successors read says it closed; the pointer on the finder's own board is what a successor's sweep checks before re-raising.

Scope is the coordinator skill alone, by the decision recorded here: the broader form (a clause in peer-sessions' record rule binding both seats symmetrically) reaches seats with no board, and it was deliberately not taken, because the coordinator's board is where the re-raise cost lands, the seat already owns the ask-for-what-a-reply-omits move, and a symmetric rule would be a second surface stating the same duty with the drift risk that entails. Reopen only if a boardless seat produces the same re-raise in practice.

The edit lands in the ledger's category list (the `Open operator escalations` bullet's neighborhood, `coordinator/SKILL.md:69` authoring-time) and wherever the ledger's commitment-category enumeration must name the new category to stay consistent; the enumeration appears more than once, so sweep the file for the category list rather than editing one instance (the restated-count lesson). The board's line bars (paths, operator's words) apply to the new line unchanged. Whole-file review per Standing Amendment 2.

Tests: none mechanical (the board is prose contract); acceptance is the clause present, every commitment-category enumeration in the file agreeing, and the stub rules covering the new category the same way they cover the others.

Files in scope: `plugins/claude-kit/skills/coordinator/SKILL.md`.

## Out of Scope

- Making the doctor's fix pass push (priced and declined in Section 1; the sentence changes, the code's division of labor does not).
- Any general "coupled-pair reporting" doctrine clause: the general shape rides as evidence on the parked instruments-not-prose plan, whose design round is the operator's, rather than as a new rule here.
- The engineless-fan-out residue of the load-declaration note: parked to `docs/backlog.md` with its signal by the same pass that authored this plan.
- Enforcement mechanics of any kind: every section here is wording, a template line, or a report field.

## Related

- `docs/plans/claude-kit_plan-lifecycle-and-diagnostics_spec_v1.md`: its Section 5 edits `executing-work/SKILL.md` and its Chapter 4 shipped the kit-git-lib boundary this plan's Section 2 closes the loop on; it runs earlier in the queue, so Standing Amendment 1 binds.
- `docs/plans/claude-kit_instruments-not-prose_spec_v1.md` (Ready, parked for the operator's design round): the Section 1 defect is a live instance of its thesis and is recorded in its Evidence.
- The 2026-08-29 kaizen pass cleared the full eleven-item inbox: five items resolved by already-shipped work (pointers in the clearing commit), six promoted into this plan, one residue parked to the backlog.

## Chapters
