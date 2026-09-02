# Regression batteries

Frozen fixtures for `sidecar/battery.js`, an on-demand evaluation run against a
model endpoint on another machine, never a CI gate. Nobody may regenerate an
expected value in here from a model run: every expected verdict and every gold
label began as a hand adjudication made before the daemon judged the case it
describes, per `docs/plans/claude-kit_judgment-sidecar_spec_v1.md` Chapter 2's
account of why that discipline exists. A case whose expected value is missing or
unreadable is a reason to stop and ask, never a reason to fill one in from a
run.

Four of the thirteen judgment cases (1, 5, 8 and 12) carry a revision made after
a live replay disagreed with that first adjudication, so four of thirteen
expected values sit on the same derivation path as the pattern being scored,
against a passing floor of twelve. Each of the four is recorded in the case
itself (`corrected`, with the superseded reasoning kept in `originalNote`), and
what makes the revision sound is that its evidence is in the frozen case text
and needs no model to re-check: all four were scored `achieved` on a result the
scratch harvester's 350-character cap (`.kit/harvest-cases.mjs`, the script
that produced these cases) had cut before the adjudicator read it, and the cut
is visible in the frozen `result`, which ends mid-line. The shipped harvest
command, `sidecar/harvest.js`, cuts at 6,000 characters and keeps a cut field's
head and tail around an in-band marker, so a refreshed set it produces cannot
reproduce this evidence shape at the same lengths or in the same shape. That is the whole bound
on the exception. An expected value is revisable on evidence a reader can see in
the fixture; it is never revisable on a verdict's say-so, which is what
regenerating one from a run would be.

## judgment-v1/cases.json

The `v1` in this directory name is the battery's own version, not a prompt
version. It does not track `sidecar/prompts/`: these thirteen cases are scored
against `judgment-v4.js` today and were scored against `judgment-v3.js`,
`judgment-v2.js` and `judgment-v1.js` before that, and the fixture did not
change when the prompt did. `recognition-v1/` happens to share a number with `recognition-v1.js` and
that coincidence means nothing either. A battery directory is renumbered when
its CASES change; the run report names the prompt id it actually used, which is
the value to compare two runs on.

Thirteen real production tool calls, harvested from fleet transcripts during
the local-model audition (`local-model-audition`, the journal key the plan's
Evidence section names). `intent`, `command`, `result` and `isError` are the
INTENT/ACTION/RESULT triple the harvest script (`.kit/harvest-cases.mjs`,
scratch) extracted.

One documented alteration: case 2's `command` and `result` carry three
redacted identifiers (an account name, a session UUID and a subagent
transcript id, all real and all resolving on the machine this battery was
built on) replaced with obviously synthetic placeholders
(`C:/Users/EXAMPLE-ACCOUNT`, a nil UUID, a zero-filled agent id).

The scope of the no-other-alteration claim, stated so a reader can check it
rather than take it: it covers the four harvested fields (`intent`, `command`,
`result`, `isError`) of all thirteen cases, and it does not cover the
adjudication fields this repository added on top of the harvest
(`acceptableVerdicts`, `note`, `corrected`, `originalNote`, `reasonCaveat`),
which are this project's own writing and were never in a transcript. The
predicate behind it is byte equality of those four fields against the harvest
output, and what a reader can check today is narrower than that: the harvest
output lives in gitignored scratch, so the standing check is the screening
procedure below rather than a diff anyone can re-run from the repository.

A frozen field may legitimately be longer than any real spool line would carry.
`sidecar/battery.js` cuts each field at its 6000-character field cap when it
writes the replay spool, keeping the field's head and its tail around an in-band
marker naming how many characters went, which is exactly the cut the capture
hook itself makes, so a longer frozen field is replayed as a real capture of
that call would have been written rather than refused. What the judge then sees
of a cut field is the tighter of that field cap and the prompt's own per-field
cap. `sidecar/prompts/judgment-v4.js` cuts ACTION at a `COMMAND_PROMPT_CAP`
equal to the field cap, so on this battery the judgment prompt re-cuts nothing
and case 9's 3,478-character `command` reaches the judge whole. Under
`judgment-v3.js`, the frozen instrument that stands beside it, the same command
reaches the judge as its first 1,500 characters, which is why a score is
comparable only within one prompt id. No frozen judgment case exceeds the
field cap, so none of the thirteen exercises the capture cut or its marker
today; a case that does is owed to this fixture and is tracked in the project
backlog rather than added here, since the cases are frozen for comparability.
The recognition prompt's own caps remain below the field cap, so a recognition
case long enough would be cut at the prompt, and none of the frozen situations
is: the longest is 171 characters against a 1000-character intent cap. So **no
case in either battery exercises a cut today** and a run report names none.
Every cut that does happen is named per case in the run report, with the length
before and after, with one stated exception: a field shortened only because the
cut dropped an unpaired surrogate half sets the replayed line's `truncated`
flag, since a character was lost, and is named in no cut line, since no cap
fired on it. What IS refused is a case that would
still exceed the 16384-byte whole-line cap after the per-field cut, since
reproducing that needs the hook's scaled multi-field algorithm, which
`battery.js` does not carry a copy of.

### Freezing procedure for a future refresh

A refreshed fixture is screened before it is committed, not after. In order:

1. Produce the triples with `node sidecar/harvest.js <transcript> --out
   <scratch path>`, writing to a gitignored scratch path, never into this
   directory.
2. Read every field of every candidate case and replace each real identifier
   with an obviously synthetic placeholder: account names, session and agent
   ids, host names, absolute paths carrying an account name, and any endpoint
   address. Record each replacement in this file, as case 2's is recorded.
3. Sweep the candidate file for the classes above with a pattern per class, and
   run each pattern against a string known to hold an instance of that class
   first: a sweep that comes back empty because the pattern is wrong reads
   exactly like a sweep that comes back empty because the file is clean.
4. Hand-adjudicate every expected value from the case text alone, before any
   model has judged it, per the rule this document opens with. An expected
   value derived from a run of the instrument under test proves nothing about
   the instrument.
5. Only then copy the screened file into this directory and record here what
   was altered, at the field level, with the scope the claim covers.
6. Record the patterns, their positive controls and every match below, replacing
   the record for the fixture as committed.

#### The sweep as run against the fixture as committed

The predicates, each as a JavaScript regular expression, the string each was run
against first to prove it can speak, and what it matches in this directory
(`judgment-v1/cases.json`, `recognition-v1/situations.json`,
`recognition-v1/index.md` and this file). A pattern whose control comes back
empty proves nothing about the file it was then run over, which is why the
control string is recorded beside the pattern rather than described.

A control string is itself published content, so it is synthetic on the same
terms as the fixture it screens: a real identifier used to prove a pattern can
speak is a real identifier committed to a public repository, inside the table
whose whole purpose is to show that none ships. Every control below is a
documentation-range address, a shape-only placeholder, or a repeating-digit
value that resolves to nothing. The `Matches here` column counts these controls
too, because they live in a file the sweep's own declared scope includes.

| Class | Pattern | Positive control | Matches here |
| --- | --- | --- | --- |
| account-bearing absolute path | `` /(?:[A-Za-z]:[\\/]Users[\\/]\|\/home\/\|\/Users\/)[^\s"'\\/]+/g `` | `C:/Users/EXAMPLE-ACCOUNT/notes.md and /home/EXAMPLE-ACCOUNT/notes.md` (2) | `C:/Users/EXAMPLE-ACCOUNT`, the recorded placeholder, twice in `cases.json`. In this file: this row's two control strings, this row's own mention of the placeholder, and the mention in the fixture-hygiene steps above |
| UUID (session or subagent id) | `/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g` | `session 11111111-2222-3333-4444-555555555555` (1) | the nil UUID `00000000-0000-0000-0000-000000000000`, the recorded placeholder, once in `cases.json`. In this file: this row's control string and this row's own spelling of the nil UUID |
| long hex id (agent or transcript id) | `/\b[0-9a-fA-F]{16,}\b/g` | `agent 0123456789abcdef0123456789abcdef` (1) | in `cases.json`: the zero-filled agent id placeholder `0000000000000000` twice (case 2's `command` and its `result`), and `ce013625030ba8dba906f756967f9e9ca394464a`, a git object id inside a code literal in case 9's own command text. In this file: this row's control string, this row's own spelling of that git object id, and this row's own spelling of the zero-filled placeholder |
| absolute local path rooted at a volume | `` /(?:\b[A-Za-z]:[\\/]+\|\/[a-z]\/)[A-Za-z0-9._-]+/g `` | `D:/claude-kit and D:\claude-kit and /d/claude-kit and E:/an-unrelated-checkout` (4) | in `cases.json`: `/d/claude-kit` seven times, `D:\claude-kit` twice and `D:/claude-kit` once, all inspected and left in place (recorded below), plus `C:/Users` twice, the volume-rooted head of the recorded placeholder the account-path row counts whole. In this file: this row's four control strings, the three checkout-path spellings in this cell, the three in the record below, the two further mentions of `E:/an-unrelated-checkout` (this cell's own and the coverage paragraph's below), and the `C:/Users` head of the account-path row's control strings and placeholder mentions |
| URL or endpoint address | `` /\b(?:https?\|ftp):\/\/[^\s"']+/g `` | `http://203.0.113.5:9999/api/generate` (1) | only this table's own control string |
| bare IPv4 address | `/\b(?:\d{1,3}\.){3}\d{1,3}\b/g` | `the host at 198.51.100.7 answered` (1) | only the two documentation addresses this table records as controls |
| host name on a private suffix | `` /\b[A-Za-z0-9][A-Za-z0-9-]*\.(?:local\|lan\|internal\|home\|corp)\b/g `` | `workstation.local and box.internal` (2) | only this table's own two control strings |
| bare host name or seat name, all-caps hyphenated | `/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/g` | `the box EXAMPLE-HOST and BUILD-BOX-02 answered` (2) | in `cases.json`: `SCOTT-CLAUDE` three times, inspected and left in place (recorded below), `PRE-FIX` twice, ordinary prose inside case 9's own captured command text, and `EXAMPLE-ACCOUNT` twice, the recorded placeholder. In this file: its own two control strings, every mention of those same tokens in the rows and the record below, and the fragments `A-Z` and `A-Z0-9` of the pattern text printed in this column's own table, which is this pattern matching its own spelling |
| email address | `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g` | `someone@example.com` (1) | only this table's own control string |

Every match above is either a recorded placeholder or a value inspected and left
in place with its reason stated.

The `cases.json` counts in the last column are regenerated by re-running each
pattern over the file, never counted by hand: a hand count and a wrong pattern
produce the same number, and this is the column whose miscount once hid a real
identifier. This file's own matches are enumerated by site instead of counted,
because a count of a token in this file is changed by the sentence that states
it.

WHAT THIS SWEEP DOES NOT ESTABLISH, stated at its real strength rather than
rounded up to a clean result. It does not screen the classes step 2 names. It
screens the shapes these nine patterns match, which is narrower, and for two
of step 2's classes the gap cannot be closed by adding a pattern. A bare host
name and a bare account name have no structural shape distinguishing them from
ordinary words: `SCOTT-CLAUDE` is caught above only because this machine's name
happens to be all-caps and hyphenated, while a host called `atlas` or an
account called `jordan` matches nothing here and could not be made to without
matching most English. So for those two classes the named shapes are swept and
the class is not, and what screens them is step 2's hand read of every field,
never this table. For the other seven the pattern is structural over the class's
own shape (a UUID, a hex run, a URL, an IPv4 quad, a suffix-bearing host name,
an email address, a volume-rooted absolute path), so a member withheld from the
controls is still caught and those rows are coverage evidence rather than only a
working instrument. The volume-rooted path row's own control carries
`E:/an-unrelated-checkout`, a spelling this directory does not hold and no other
row's literals name, matched on the shape of a volume root followed by a
segment: a checkout at a different letter or a different repository name is
caught by that pattern rather than sampled by it. A refresh introducing an
identifier of a new shape needs a new pattern and a new control here, not a
re-run of these nine.

`SCOTT-CLAUDE`, inspected and left in place, with the reason so a reader can
check it rather than take it. It appears three times, always inside the path
`kaizen/notes-SCOTT-CLAUDE.md` in the captured output of cases 1 and 10, where
it names a file rather than a network destination. That exact path is already
tracked, published content of this repository, so the fixtures disclose nothing
the repository does not already disclose, and replacing it would make the
frozen output differ from the call that really ran. A refresh taken on a
machine whose name is NOT already published in this repository replaces it per
step 2 instead; the reason above is about this string on this repository, not a
standing exemption for host names.

The checkout path, inspected and left in place, with the reason so a reader can
check it rather than take it. It appears ten times across cases 2, 4, 5, 7, 8,
9, 12 and 13, in three spellings of one directory (`/d/claude-kit`, `D:\claude-kit`
and `D:/claude-kit`), always as the working directory or a path operand inside
captured command and result text. It is a drive letter plus this repository's
own name: it carries no account name, names no host and names no network
destination, and the same three spellings already appear in this repository's
tracked test files and archived plan documents, so the fixtures disclose nothing
the repository does not already disclose. `docs/security-model.md` places an
operator checkout path standing as a worked example in the placeholder class, so
a NEW surface written from scratch spells a generic path instead. That rule does
not reach here, because these fields are captured text and their value is that
their expected verdicts were hand-adjudicated against text nobody edited:
rewriting a command's own path would falsify the provenance claim this file
makes about the four harvested fields. A refresh taken in a checkout whose path
carries an account name, or names a repository not published here, replaces it
per step 2 instead.

`acceptableVerdicts` is the SUBSTANCE column, not exact-enum match: the
audition scored whether the judge correctly decided the intent was or was not
met, and where the failed/diverged line is genuinely blurred, either verdict
scores as correct. A case's list is one or two of `achieved`, `failed`,
`diverged`. Four cases (1, 5, 8 and 12) carry a `corrected` field, a prose
string rather than a boolean: the hand adjudicator's first pass scored them
`achieved` and was wrong in one class, the scratch harvester's 350-character
cap that had cut the result's evidence before the adjudicator read it, and the daemon's
`diverged` verdict was right on all four once the live replay caught it.
Those same four also carry `originalNote`, the superseded reasoning that
argued for the wrong verdict, kept rather than deleted because it is the
record of what the cut hid; their `note` field holds the corrected reasoning
instead, so a future reader of the fixture is never shown a confident
argument for a verdict the record already overturned. Case 5 also carries
`reasonCaveat`, a defect in that adjudication's own reason text (a fabricated
specific unrelated to the result) which this battery does not score, since
scoring a reason's fabrication needs semantic judgment of prose that a frozen
fixture cannot express as a fixed expected value. Case 6's note originally
stated that its diverged verdict scores as correct only if the model's reason
names the numbering; `scoreJudgment` never reads `reason` for scoring and does
not implement a reason-matching axis the audition itself never measured, so
that clause was removed from the fixture rather than built into the scorer.

Passing threshold: the audition's own recorded floor of 12 of 13 on substance,
carried as a RATE rather than an absolute count, so a fixture grown past
thirteen cases needs the same proportion rather than the same twelve. Every
case must also be measured: a case left unmeasured by a gap, or dropped by one
of the daemon's own skip counters, fails the battery regardless of the other
twelve, and leaves by exit 1 (cannot measure) rather than exit 3 (measured and
short).

## recognition-v1/situations.json and recognition-v1/index.md

Fifteen situations from round 6 of the audition (`.kit/round6-memory.mjs`,
scratch), twelve gold-labelled and three true negatives. `index.md` is a
frozen, read-only copy of this project's real memory index as it stood for
section 4's acceptance replay (`.kit/accept/store/.../MEMORY.md`, scratch),
holding every record name every situation's gold label or false positive
names. It is store content, not a generated verdict, so freezing it is not
the regenerate-from-a-run pattern this document opens by ruling out.

One documented alteration to `index.md`: the summary line of the
`kit-messaging-handoffs-are-pre-authorized` record carries the deciding party
as the role word `the operator` where the store's own copy names the account.
A bare account name has no structural shape a pattern catches, as the sweep
record below states, so it is screened by the hand read of step 2 and replaced
like any other identifier. The alteration touches that one word; every record
name in the file, which is the whole of what recognition is scored on, is the
store's own.

Case 11 (`ls docs/plans/`, gold `[]`) is a known, real false positive: the
shipped prompt still points at `archiving-a-plan-touches-two-indexes-not-three`
on this case, affirmed by the battery's owner on the record's own bears-on
rule and its declared triggers, per the plan's Decisions entry amending
section 4's acceptance. The prompt is never tuned against it.

Extras count every non-gold name in the model's raw answer AND every name its
parse marks `invented` (absent from the index it was shown): the audition's
own false-positive rate was measured against everything the model said, not
just the subset that happened to name a real record.

Passing threshold, the amended section-4 acceptance: 12 of 12 gold recall
with zero misses, and at most 2 non-gold pointers across the 15 situations
(the shipped prompt measures 1, case 11's own). Clean negatives are reported
per case regardless, and every situation must be measured; a gap fails the
battery regardless of the other fourteen, by exit 1 rather than exit 3.

## Running the battery

`node sidecar/battery.js`; see that file's header for the command line.

WHERE THE DATA GOES. A run sends all thirteen frozen commands with their output,
and the whole frozen memory index, off this machine over the network to the
configured model endpoint, as cleartext HTTP request bodies. That endpoint is a
separate host running a multi-tenant model service; nothing about the transport
or the boundary changes when its address is a private one, and the daemon's own
remote-host warning is silent for a loopback or private-network address, so the
run prints its own unconditional disclosure line ahead of the first call
instead. The address itself is printed nowhere; the endpoint fingerprint in the
run report is what identifies it. A run also leaves those same commands and
their output in plaintext under its state root, which is a temporary directory
unless `--state-dir` names one. Those files are written at mode 0600, which
restricts them to their owner on POSIX only: on Windows, Node maps a file mode
to the read-only attribute alone, `0o600` carries write permission so no
attribute is set, and the files inherit the containing tree's ACL, per
`docs/security-model.md`'s account of the live spool. Removal is the
operator's; the run prints the path and says so.

Neither battery ships with the kit plugin: `sidecar/`
sits outside `plugins/claude-kit/`, which is the only tree `build.ps1`
packages, so these fixtures and the runner are dev-time evaluation artifacts
by construction.
