# The spool contract

The file contract between the kit's capture hook and the judge daemon. The hook
writes; the daemon reads. Neither imports the other, and this document is the
only thing they share.

## Locations

All sidecar state is machine-local, under `~/.claude/kit-sidecar/`:

- `spool/<YYYY-MM-DD>.jsonl` - the capture spool, one file per UTC day.
- `inbox/<sessionId>.jsonl` - delivery items (the delivery valve; not written or
  read by the capture duty).
- `logs/` - verdict logs, recognition logs, findings, and persisted offsets.

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
- Drop map entries for files that no longer exist, so retention deletes do not
  grow the offset map without bound.

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

### Retention

Retention is a delete, and the daemon owns it. On every startup the daemon
deletes spool day files older than **14 days** and drops their offset-map
entries. Nothing else expires a spool file: the hook only appends, and no
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

The hook exits 0 on every path, writes nothing to stdout in the capture duty,
and never blocks. A malformed payload, an unreadable stdin, a permission error,
a full disk, or any internal throw all produce the same result: exit 0, nothing
captured, the observed session undisturbed. Capture is best-effort by design. A
missing line is an acceptable cost; a disturbed session is not.

Never blocking is not the same as costing nothing. The hook is a Node process
spawned on every matched tool call, a third one on this fleet's Bash boundary,
and the dormant path pays that startup in full to stat one directory and exit.
"Installing the kit turns nothing on" means it writes nothing and sends nothing,
not that it costs nothing: the price of a dormant install is one process
startup, tens of milliseconds, per Bash call. What the hook does not do is wait
on anything: no lock, no network, no retry.
