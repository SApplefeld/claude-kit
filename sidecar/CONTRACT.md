# The spool and inbox contract

The file contract between the kit's capture hook and the judge daemon. It runs
both ways: on the spool the hook writes and the daemon reads, and on the inbox
the daemon writes and the hook reads. Neither imports the other, and this
document is the only thing they share.

## Locations

All sidecar state is machine-local, and every path either component writes is
under `~/.claude/kit-sidecar/`:

- `spool/<YYYY-MM-DD>.jsonl` - the capture spool, one file per UTC day.
- `inbox/<sessionId>.jsonl` - delivery items, written by the daemon and read by
  the hook's delivery valve.
- `inbox/<sessionId>.offset` - how far that session's valve has delivered,
  written by the hook and read by nothing else.
- `logs/` - verdict logs, recognition logs, findings, and persisted offsets.

One path the daemon READS sits outside that root. The recognition duty opens
each observed project's memory index, `<memory root>/projects/<segment>/memory/`
plus memq's index filename, resolved through memq's own project derivation from
the captured `cwd`; the root is memq's unless `--memory-root` names another. That
is one file per project, opened read-only, and no component of this contract
writes anywhere under a memory store. Its contents leave the machine: see the
recognition egress below.

The date in a spool filename is the UTC date of the moment the line was
appended, so a file may hold lines whose `ts` sits either side of local
midnight. Day files exist to bound growth: retention is a file delete, never a
rewrite of a live file. Who performs that delete, and when, is stated under
Retention below.

## Activation and dormancy

The hook lstats `~/.claude/kit-sidecar/spool` before doing any work and exits
silently when it is absent, or when what sits there is anything other than a
real directory. It never creates the directory. **Creating the spool
root is the daemon's activation act**, which is what lets the hook ship to every
machine inert: installing the kit turns nothing on, and running the daemon once
turns capture on for every session on that machine from its next tool call.

Deactivation is the same lever in reverse. Removing the spool root stops capture
at the next tool call with no session restart and no configuration change.

The hook's delivery valve carries the same switch on `~/.claude/kit-sidecar/inbox`,
lstatted on the same terms, and the daemon creates that directory on the same
startup that creates the spool root. The two switches are independent: capture
runs while the spool root exists whether or not the inbox does, and the valve
runs while the inbox root exists whether or not the spool does, so deleting
either directory retires that duty alone.

## The line schema

One JSON object per line, UTF-8, terminated by `\n`, appended with a single
write. Key order in the emitted line is the order below, but a consumer must not
depend on it.

| Key | Type | Meaning |
| --- | --- | --- |
| `v` | integer | Schema version. Always `1`. A consumer that does not recognize the version skips the line and counts it. |
| `callId` | string | 16 lowercase hex characters. The stable identity of one captured call. Deduplication, verdict records, and delivery items all key on it. |
| `ts` | string | ISO 8601 UTC, the moment of capture (after the tool call completed). |
| `sessionId` | string | The observed session's id. `''` when the payload carried none. |
| `cwd` | string | The observed session's working directory. The daemon resolves the project from this. `''` when the payload carried none. |
| `tool` | string | The tool name. `Bash` in v1; the matcher is the only thing that limits it. |
| `intent` | string | The call's stated intent, the Bash tool's `description` field. `''` when absent. This is the INTENT side of the judgment triple. |
| `command` | string | The command text, the Bash tool's `command` field. The ACTION side. |
| `result` | string | The call's output. The RESULT side. See below. |
| `truncated` | boolean | `true` when any of `intent`, `command`, or `result` was cut, by either cap. |
| `isError` | boolean | The harness error flag, normalized across response shapes. |

`result` is the response's text channels joined with newlines, in the order
`stdout`, `stderr`, error text, content-block text. A response that is a bare
string is used as-is; an array of content blocks contributes its text blocks.
Channels are not labelled, so a consumer cannot tell stdout from stderr; what it
gets is what the session saw.

`isError` is true when the payload or the response carries any error indicator:
`is_error`/`isError` true, an `error` key present at all, `success` false,
`interrupted` true, or a non-zero numeric exit code under any of the spellings
the harness uses. A judged verdict must not be derived from `isError` alone: the
defect class the sidecar exists for is the call that exits 0 having done the
wrong thing.

### Caps

- Every text field is cut to 2000 characters: `intent`, `command` and `result`,
  and `cwd`, `tool` and `sessionId` too. The last three are capped because the
  line-cap pass cannot shorten them, so an oversized one (a Windows long path
  reaches this) would otherwise drop the whole record.
- The whole serialized line is capped at 8192 bytes including its newline. A
  line over the cap is shortened by cutting `result` first, then `command`, then
  `intent`. The cut is scaled by what the field's own characters cost in the
  serialized line, so a field of escape-heavy or non-ASCII text loses only what
  the byte deficit needs. A record that still does not fit with all three empty
  is dropped rather than written.
- No field ever ends in an unpaired surrogate. A cut that lands between the
  halves of a surrogate pair drops the orphan rather than emitting it, so a
  consumer decoding a line never receives a replacement character it must guess
  about.
- Any cut sets `truncated`. The flag says something was lost; it does not say
  which field or how much.
- A day file past 64 MiB stops taking appends. Nothing in the hook can tell a
  running daemon from a stopped or uninstalled one, so the bound is what keeps
  an unconsumed spool from growing without limit. At the fleet's volume, a few
  thousand calls a day, an honest day file stays far under it: reaching the
  bound means the consumer is gone. The skip is silent, like every other path.

The line cap is not cosmetic. It is the interleaving mitigation described below,
so a consumer can rely on it: a line longer than 8192 bytes did not come from
this hook.

## Interleaving: malformed lines are expected

Several sessions on one machine append to the same day file concurrently, and
Node offers no cross-process atomic-append guarantee (notably on Windows). A
single `fs.appendFileSync` of a small buffer is very likely to land whole, and
the 8192-byte cap is what keeps it small, but nothing here promises it.

**A consumer MUST skip and COUNT malformed lines rather than aborting.** A
malformed line is an expected event, not a defect: it is a torn write between
two live sessions. What is a defect is a consumer that stops reading, and what is
a lie is a consumer that skips silently, since a rising skip count is the only
signal that the mitigation has stopped working.

No lock is taken and none should be added. A lock would put the observed session
on a critical path, which is exactly what the hook is forbidden to do.

## The daemon's offset

Because the spool is a set of day files rather than one growing file, the
persisted offset is **a map of filename to byte offset**, not a single number:

```json
{ "2026-08-29.jsonl": 41822, "2026-08-30.jsonl": 3104 }
```

Rules the daemon follows:

- Process files in filename order (lexicographic is chronological here).
- Resume each file from its recorded offset; a file with no entry starts at 0.
- Advance an offset only past a complete line (one ending in `\n`). A trailing
  partial line is a write in flight; leave the offset before it and re-read next
  pass.
- A file shorter than its recorded offset has been rotated or truncated
  externally: reset that file's offset to 0 and count the event rather than
  trusting the stale number.
- Drop a map entry only when the file it names is confirmed absent, so retention
  deletes do not grow the offset map without bound and an unreadable directory
  listing is never read as an empty spool.

## The delivery inbox

The return leg. The daemon queues one item per finding into the observed
session's inbox; the hook's delivery valve reads that file on that session's next
tool call and puts the undelivered items in front of the model as advisory text.
The daemon writes and never reads; the hook reads and never writes the `.jsonl`.
The only file the hook writes here is the session's own `.offset`.

The file name is the session id reduced to one path component: every character
outside `A-Za-z0-9._-` becomes an underscore and the result is cut to 80
characters. Both halves apply the same reduction to reach the same name. A
session whose id is empty, or which reduces to nothing usable, gets the daemon's
`no-session` bucket, and the valve refuses to deliver that bucket to anyone: a
shared file cannot be one session's inbox.

### The item schema

One JSON object per line, UTF-8, terminated by `\n`, appended with a single
write, on the same interleaving terms as the spool.

| Key | Type | Meaning |
| --- | --- | --- |
| `v` | integer | Schema version. Always `1`. A reader that does not recognize the version skips the line. |
| `kind` | string | `alert` for a diverged-verdict alert, `memory` for a memory pointer. A kind the reader does not know is skipped. |
| `ts` | string | ISO 8601 UTC, the moment the item was queued. |
| `callId` | string | The captured call this item is about, from the spool line. |
| `sessionId` | string | The session the item is for, unreduced. |
| `intent` | string | `alert` only. The call's stated intent. |
| `reason` | string | `alert` only. The judge's one-clause reason. |
| `record` | string | `memory` only. The memory record's name, which the reader spells into a `memq get` line. |
| `why` | string | `memory` only. One clause on why the record may bear on this call. |

**Pointers, never bodies.** An item carries no command, no output, no record
body and no transcript quote. Every text field is neutralized and cut to 200
characters on the way in. A body injected by machinery is read as fact without
anybody opening the source; a pointer preserves recall-then-verify.

An item claims exactly one dedup key, and which key depends on the kind.

- An **alert** is keyed on **`<kind>:<callId>`**, never on the call id alone:
  one call can earn one alert and one memory pointer, and a set keyed on the
  bare id would drop the second silently, with no counter and no report.
- A **memory pointer** is keyed on its record and its session,
  **`memory-record:<sessionSlug>:<record>`**, and not on its call at all. One
  call may legitimately earn up to three pointers, because one recognition
  answer may name up to three records and each is a separate thing to say; keyed
  on the call as well, the first record queued would take that key and the
  second and third would be dropped in silence, which would make the answer's
  cap, the prompt's sentence and the valve's three-item batch all quietly mean
  one. What the record key buys instead is the rule the recognition duty needs:
  one pointer per record per session, so a memory bearing on the afternoon's
  work is pointed at once rather than on every call of the afternoon. It also
  covers what the call key would have covered here, since a spool line read a
  second time names the same records and those records still hold their keys.

The set is bounded at 512 keys, oldest dropped first, so it cannot grow for as
long as the daemon runs. One key per item means one slot per item, so the real
window is 512 items rather than half that. Past the bound a spool file re-read
from zero and reaching further back than 512 items can queue one call's pointer
a second time. That is the accepted cost: a duplicate pointer is a redundant
line, and the divergence itself is in the findings file whatever the inbox does.

**The writing side never creates the inbox directory.** Only daemon startup
does. Deleting `~/.claude/kit-sidecar/inbox` is the documented way to switch
in-band delivery off, and a writer that recreated the directory for the next
item would re-arm the valve with no restart and no signal. A write into a
missing, linked or otherwise unusable inbox fails, counts, and is reported, on
the same footing as a verdict log that cannot be written.

### The delivered offset

`inbox/<name>.offset` holds a single decimal byte position and nothing else. The
rules mirror the spool's:

- An absent, unreadable or unparseable offset file reads as 0, which re-delivers
  rather than skipping.
- Advance only past a complete line, one ending in `\n`. A trailing partial line
  is a write in flight and is left for the next call.
- A file shorter than its recorded offset was rotated or replaced: read it from
  0 rather than trusting the stale number.
- A complete line the reader could not use, malformed or of an unknown version
  or kind, is consumed like any other: it is complete, and holding the offset in
  front of it would re-read it on every tool call for the life of the session.
  The skip is silent, because the hook has no surface to report on; the daemon's
  own malformed count is where that signal lives.
- The offset advances before anything is emitted, and nothing is emitted if that
  write fails. A pointer lost to a crash in between costs one advisory line; an
  item emitted against an offset that never moved repeats on every tool call for
  the life of the session, which is an injection loop the session cannot switch
  off.

The offset is written by an exclusive create at an unpredictable temporary name
(`<name>.offset.tmp.<pid>.<random>`) followed by a rename over the target, so it
is never torn, a link planted at the target is replaced rather than written
through, and there is no predictable temporary name to plant at either. A plain
write to a fixed temporary name would be followed through a planted link, which
turns the valve into a way to truncate any file this user can write.

### One reader at a time

The harness issues tool calls in parallel, main-thread calls included, so
several copies of the hook can run against one session's inbox at once. A plain
read-select-advance there is last-writer-wins: every copy reads the same offset,
every copy takes the same batch, and the block is delivered N times with the
3-item and 600-byte caps defeated N-fold. Those caps are the control on how much
sidecar text can reach a session, so that is a control failure and not a
cosmetic repeat.

The whole read-select-advance therefore runs under an exclusive claim at
`inbox/<name>.lock`. The claim is taken once and **never waited on**: a hook that
blocked on a lock would put the observed session on a critical path, so a copy
that cannot take the claim delivers nothing and the items stay queued for the
next tool call. A claim older than 30 seconds is read as abandoned by a copy
that died holding it, and is reaped.

Standing subagents down is not what provides this. It is its own rule, below,
for its own reasons.

### Delivery caps and framing

- At most 3 items per tool call, and at most 600 bytes of item text (UTF-8
  bytes, not characters). Whatever the caps hold back stays queued for the next
  call; nothing is dropped for being late.
- An item too large for the budget is shortened by cutting its VARIABLE fields,
  in the kind's own order, and never by cutting the composed line from its tail.
  The trailing directive on an alert and the `memq get` spelling on a memory
  pointer both live at the end of the line, so a tail cut removes exactly what
  the pointer exists to carry, and it never fires on ASCII text, which is what
  makes it look correct on every happy path.
- The advisory framing line and a closing fence both sit OUTSIDE the byte cap.
  The framing states what the block is, where its content came from and across
  which machine boundary, that it is data and not instructions carrying no
  authority, and where to check a pointer. The fence marks where the block ends.
  Both are security controls, not decoration, so a flooded inbox must be able to
  displace neither the front nor the end.
- Every value an item contributes is emitted inside a quoted slot and loses the
  quote character on the way in, so no field can close its own slot and continue
  as the hook's own words.
- The note saying further content is queued is a claim the block makes about
  itself, so it is only made when it is true: a further complete line inside the
  read window that would actually be emitted, a partial line being written, or
  bytes past the window. Lines held back that no reader would ever see, a
  malformed line or an unknown kind, are not "further content".
- At most 64 KiB of the inbox is read per call. Bytes past that window wait for
  the next call; a window holding no complete line at all is stepped over, since
  the writing side produces no such run and one would otherwise stall every item
  behind it.

**Both halves neutralize.** Control characters, ANSI escape runs, the
bidirectional overrides and isolates, the zero-width set and the byte-order mark
are removed and whitespace is collapsed, at the daemon when the item is written
and again at the hook when it is formatted. The two implementations exist
because the process boundary forbids a shared module, and both are needed rather
than either being redundant: the daemon guards what the daemon wrote, and the
inbox is an ordinary file any process running as this user can append to.

### Subagents stand down

**The valve does nothing on a subagent's tool call: it reads no file, emits
nothing, and leaves the delivered offset exactly where it was.** A subagent's
PostToolUse payload carries the parent session's `session_id` byte-identically,
so the id cannot tell them apart; the agent-identity keys can, and any of
`agent_id`, `agent_type`, `agentType`, `subagent_type` or `subagentType` holding
a truthy value stands the valve down. Truthiness rather than presence: a harness
emitting a null `agent_id` on a main-session payload would otherwise retire the
feature outright.

Two things follow. A pointer delivered into a subagent lands in a context that
cannot place it, since the call it describes was the parent's. And the parent's
offset would advance for an item the parent never saw, which loses it silently.
Concurrency is not among them: main-thread tool calls are issued in parallel
too, which is what the exclusive claim above is for.

The capture duty does the opposite and keeps capturing subagent calls: their
calls are exactly as worth judging, and capture keys nothing on the session.

### What the inbox contains, and where it goes

An item holds a stated intent and one clause of model-authored prose about a
call. That is less than the spool holds and it is still command-adjacent text
under the user's home directory, on the same 0600-and-profile-ACL footing as the
spool day files.

**The inbox never leaves this VM.** No component reads it over a network and
nothing posts it anywhere; the hook that reads it runs on this machine as the
same user. The export happens earlier and is described below, in two calls
rather than one: the judgment call POSTs the command, its output and the stated
intent across the virtual switch to the model endpoint on the Hyper-V host, and
the recognition call POSTs the project's memory index and a bounded cut of the
same situation to the same place, both in cleartext over plain HTTP in the
default configuration. An item is derived from the answers that came back. The
inbox adds no further egress; see "What the spool contains, and what follows"
and "What recognition adds to the egress" for the full account of both.

Retention is the daemon's, on the spool's own 14-day window and the same pass:
inbox files past the window are deleted by mtime, along with abandoned claim
files and orphaned temporaries. A session that stopped running leaves undelivered
items behind with no reader left to consume them, and nothing else expires them.

**A queue and its offset expire together, never separately.** The two age on
different clocks: the hook stops touching the offset the moment the queue is
drained, while the daemon keeps appending, so a long-lived session reaches a
state where its offset is stale and its queue is fresh. Deleting the offset alone
there resets that session to byte zero and its next tool call re-delivers every
item the queue has ever held, which is the repeat injection the offset exists to
prevent. So an offset is deleted only when its queue is absent or is going in the
same pass, and a sweep that holds one back says so. The reverse pairing needs no
rule: a queue deleted with its offset left behind only stops delivery until both
are gone.

### Fail-open

The valve fails open exactly as capture does. An absent or unreadable inbox, a
line that is not JSON, an item of an unknown version or kind, a missing offset
file, an offset write that fails, a link where a directory or a file should be,
or any internal throw: every one produces the same result, which is exit 0,
nothing emitted, and an undisturbed session.

## What the spool contains, and what follows

Every captured line holds the full text of a shell command and its output. That
is the point of the instrument, and it makes the spool a sensitive artifact: it
can hold anything a command printed, tokens and keys among them.

- The spool file is machine-local: it is never synced and never committed, and
  the hook opens no path outside the user's own home directory.
- **Its contents do leave the machine.** The daemon puts the command, its
  output, and the stated intent into a prompt and POSTs that prompt to the model
  endpoint, which does not run on this VM. It runs on the Hyper-V host, reached
  across the virtual switch, over plain HTTP unless the per-machine endpoint
  config names an HTTPS URL, with no authentication in the default
  configuration. That endpoint is shared: other tenants on the host, the
  operator's own agent harness among them, use the same model service. So a
  captured line is unredacted command output crossing a machine boundary in
  cleartext to a multi-tenant service. Anything a command printed, tokens and
  keys included, crosses with it.
- Day files are opened with mode `0600`. POSIX honors it. **Windows does not**:
  Node maps the mode to the read-only attribute alone there, and `0600` carries
  write permission, so no attribute is set and the file's protection is whatever
  ACL it inherits from the user profile directory. On this fleet's primary
  platform, the only thing keeping the spool from another local account is that
  profile ACL, which excludes other standard users but not an administrator and
  not a process running as the same user.
- The spool root and the day file are both screened with `lstat`, and a symlink
  or a Windows junction at either path is refused. Writing through one would put
  every captured command and its output wherever the link pointed, and a
  junction needs no elevation to create.
- The hook does no redaction. A consumer must not treat spool content as safe to
  quote into any surface a person or a model reads; the delivery valve's
  pointer-not-body discipline exists for this reason among others.

### What recognition adds to the egress

The judgment call is not the only export. Every captured line whose project has
a memory index earns a second POST, the recognition call, and that one carries
something the spool never held: **the project's memory index**, one line per
record, each line the record's title and its one-line description.

It crosses the same boundary by the same route. The index leaves this VM for the
model endpoint on the Hyper-V host, reached across the virtual switch, over
plain HTTP unless the per-machine endpoint config names an HTTPS URL, with no
authentication in the default configuration, to a model service shared with
other tenants of that host. The situation the index is judged against, the
stated intent plus a bounded cut of the command and its output, crosses with it.

Two bounds on what that is:

- **Titles and descriptions, never bodies.** No record file is opened. The
  daemon reads one file per project, the index itself, and a record's text
  enters no prompt it builds and no log it writes.
- **It is the whole index, not a selection.** There is no query narrowing it
  first: recognition works by showing the model the list and asking which
  entries bear on the moment, so a project's entire index of record titles and
  descriptions crosses the boundary on every recognition call. A project's index
  is a description of what that project has learned, and on this fleet it names
  incidents, contracts and machine facts.

What comes back is record names and one clause of prose. The names are checked
against the index that produced them and anything else is dropped, so the answer
adds no egress of its own.

A machine with no memory index for an observed project makes no recognition call
at all, and a machine with no endpoint config makes neither call and creates
nothing.

### Retention

Retention is a delete, and the daemon owns it. On startup, and again on every UTC day boundary it
crosses while running, the daemon deletes spool day files older than **14
days**, drops their offset-map entries, and sweeps its own logs under the same
window. Nothing else expires a spool file: the hook only appends, and no
component rewrites one.

Fourteen days holds long enough for a rollup to cover a fortnight of fleet
activity and short enough that an idle machine is not sitting on a quarter's
worth of plaintext command output. At the volume this instrument is sized for,
a few thousand calls a day, the standing footprint is on the order of tens of
megabytes per day and low hundreds of megabytes in total.

A machine whose daemon never runs again keeps whatever it captured until
someone deletes `~/.claude/kit-sidecar/`. Deleting that directory is the
supported way to stop capture and discard the record at once.

### What the spool is not: it is not tamper-evident

The spool is an instrument, not an audit trail, and a rollup over it is a count
of what was captured rather than a count of what happened. Three limits, all
structural:

- **Capture can be switched off silently.** Removing the spool root stops
  capture at the next tool call, and the call that removes it is itself not
  captured. There is no heartbeat and no sequence number, so a stretch with no
  lines is indistinguishable from an idle fleet.
- **Lines can be written by hand.** The spool is an ordinary file under the
  user's own home directory, and any process running as that user can append a
  well-formed line to it.
- **The intent side is authored by the subject.** `intent` is the description
  the observed session wrote for its own call, so the judgment triple's premise
  comes from the party the judgment is about.

None of this is closed under a single-principal model, where the observed
session, the daemon, and the operator all run as one user on one machine.
Closing it would need a writer the observed session cannot reach. State this
limit wherever a spool-derived number is presented: a rollup count is evidence,
not a guarantee.

### Tool scope in v1

The hook is registered on `PostToolUse` with the matcher `Bash` alone, while
the sibling shell-facing hooks in `hooks.json` match `Bash|PowerShell`. That is
deliberate for v1, and it has an audit consequence: **PowerShell calls are
outside the instrument.** On a fleet whose default scripting language is
PowerShell, a spool with no line for a call is not evidence the call did not
happen.

A rollup over these logs must therefore print its tool scope on its own output
line, so a count is never read as coverage.

## Error posture

The hook exits 0 on every path and never blocks. A malformed payload, an
unreadable stdin, a permission error, a full disk, or any internal throw all
produce the same result: exit 0, nothing captured, nothing emitted, the observed
session undisturbed. Both duties are best-effort by design. A missing line and
an undelivered pointer are acceptable costs; a disturbed session is not.

The capture duty puts no byte on either channel. The only thing the process ever
writes to stdout is the delivery valve's answer, and only when the valve has an
item: a single JSON object whose `hookSpecificOutput` holds `hookEventName` set
to `PostToolUse` and `additionalContext` set to the framed block. There is no
deny path, no non-zero exit, and nothing on stderr.

Never blocking is not the same as costing nothing. The hook is a Node process
spawned on every matched tool call, a third one on this fleet's Bash boundary,
and the dormant path pays that startup in full to stat one directory and exit.
"Installing the kit turns nothing on" means it writes nothing and sends nothing,
not that it costs nothing: the price of a dormant install is one process
startup, tens of milliseconds, per Bash call. What the hook does not do is WAIT
on anything: no network, no retry, and no blocking on the delivery valve's
exclusive claim, which is attempted once and abandoned rather than waited for.
