// Shared library for the boundary-gated compaction checkpoint, and for the
// transcript reading its consumers share.
//
// The checkpoint is a small project-scoped JSON file (.kit/compact-checkpoint.json,
// gitignored territory) recording the plan path a chapter boundary was reached
// for. It is the signal between two programs that must agree on its path and
// shape: the checkpoint CLI (kit-compact-checkpoint.js) writes it at the
// chapter-close ritual, and the PreCompact gate (kit-compact-gate.js) reads it
// to decide whether a pending auto-compaction may land, consuming (deleting) it
// on the allow so the next mid-chapter attempt is denied again. Single-sourcing
// the path, the read/write/clear operations, and the match rule
// (checkpointMatches, with its age constants) here is what keeps the writer,
// the gate, and the status report from drifting apart.
//
// The transcript helpers (readTranscriptCapped, stripLocalCommandOutput, and
// the automation detection) live here for the same reason: the goal-leash Stop
// hook (kit-goal-stop.js) and the PreCompact gate both read transcript text
// and both must neutralize local-command echoes, and two near-duplicate copies
// of the greedy stripping semantics would drift apart.
//
// Node core modules only, CommonJS, zero dependencies. Every exported function
// that touches the filesystem is wrapped so it never throws: a filesystem
// hiccup degrades to a null/refusal result instead of trapping the caller,
// matching kit-goal-lib.js.

'use strict';

const fs = require('fs');
const path = require('path');
const { normalizePlanArg } = require('./kit-goal-lib.js');

// Path to the checkpoint file for a given repo root.
function checkpointPath(cwd) {
    return path.join(cwd, '.kit', 'compact-checkpoint.json');
}

// How long an open checkpoint stays honorable. A checkpoint opened at a
// boundary that is already past the compaction trigger is consumed within
// seconds (the harness re-offers a compaction every assistant turn once past
// the trigger), so ten minutes is generous for the case that matters. A
// checkpoint opened BELOW the trigger has no offer to catch and must age out
// instead: honoring it later, when the next chapter crosses the trigger
// mid-section, would land the compaction mid-chapter, which is the exact
// placement the gate exists to prevent, and self-sustainingly so (the landed
// compaction resets consumption, the next boundary opens another
// below-trigger checkpoint, and the cycle repeats). When the bound misfires,
// the cost is one mid-chapter compaction, the pre-gate status quo, so the
// failure direction stays fail-open.
//
// The floor on this value is a long dispatched tool call: a chapter close
// followed immediately by a multi-minute implementer run delays the next
// assistant turn, and therefore the next compaction offer, past the open.
// Implementers have run 6 to 12 minutes, so a bound much under ten minutes
// would start discarding boundaries that were about to be honored. The
// ceiling on it is how long a below-trigger checkpoint can linger before the
// next chapter crosses the trigger, which at the recommended trigger the
// doctor derives is far longer than either number. That figure is deliberately
// not restated here: the doctor computes every displayed number from its own
// window and reserve values, and a copy in this comment would strand the
// moment either changes.
const CHECKPOINT_MAX_AGE_MS = 10 * 60 * 1000;

// Skew allowance for a checkpoint whose openedAt sits in the future: a small
// clock adjustment between the write and the read is tolerated, but a far-
// future timestamp is treated as illegible rather than honored, so a clock
// change can never mint an effectively immortal checkpoint.
const CHECKPOINT_FUTURE_SKEW_MS = 2 * 60 * 1000;

// Compare two session ids as opaque, case-insensitive strings (session UUIDs
// are surfaced in mixed case across the harness). Shared by the checkpoint
// match rule, the PreCompact gate, and the goal-leash Stop hook, which must
// all agree on session identity. False when either side is missing, which is
// exactly the treat-as-absent handling an unbound goal or an old-format
// checkpoint needs.
function sameSessionId(a, b) {
    if (!a || !b) return false;
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

// The one checkpoint match rule, shared by its two consumers so they cannot
// drift: the PreCompact gate uses the verdict to decide whether a pending
// auto-compaction may land (and the checkpoint be consumed), and the CLI's
// status report uses the reason to say why a checkpoint on disk gates
// nothing. A checkpoint counts only when its recorded plan equals the armed
// goal's plan, its recorded boundSession equals the goal's current
// boundSession, and its openedAt is fresh (parseable, within
// CHECKPOINT_MAX_AGE_MS of nowMs, and no further than
// CHECKPOINT_FUTURE_SKEW_MS into the future).
//
// Returns { ok:true, reason:null } on a match, else { ok:false, reason } with
// reason naming the first failed clause in evaluation order:
//   'no-checkpoint'  cp is missing or carries no plan string
//   'no-goal'        goal is missing or carries no plan string
//   'wrong-plan'     the plans differ (a stale file from a prior run)
//   'wrong-session'  the bound sessions differ (an orphan from a crashed run,
//                    or an unbound side on either record)
//   'no-timestamp'   openedAt is missing or does not parse as a date
//   'expired'        openedAt is older than CHECKPOINT_MAX_AGE_MS
//   'future'         openedAt is beyond the future skew allowance
// Never throws on JSON-derived input: every access is guarded and Date.parse
// returns NaN on garbage. nowMs exists so a caller can pin the clock; an
// absent or illegible value means the current time.
function checkpointMatches(cp, goal, nowMs) {
    const now = (typeof nowMs === 'number' && Number.isFinite(nowMs)) ? nowMs : Date.now();
    if (!cp || typeof cp !== 'object' || typeof cp.plan !== 'string') {
        return { ok: false, reason: 'no-checkpoint' };
    }
    if (!goal || typeof goal !== 'object' || typeof goal.plan !== 'string' || goal.plan === '') {
        return { ok: false, reason: 'no-goal' };
    }
    if (cp.plan !== goal.plan) return { ok: false, reason: 'wrong-plan' };
    if (!sameSessionId(cp.boundSession, goal.boundSession)) return { ok: false, reason: 'wrong-session' };
    if (typeof cp.openedAt !== 'string') return { ok: false, reason: 'no-timestamp' };
    const opened = Date.parse(cp.openedAt);
    if (!Number.isFinite(opened)) return { ok: false, reason: 'no-timestamp' };
    const age = now - opened;
    if (age > CHECKPOINT_MAX_AGE_MS) return { ok: false, reason: 'expired' };
    if (age < -CHECKPOINT_FUTURE_SKEW_MS) return { ok: false, reason: 'future' };
    return { ok: true, reason: null };
}

// Read and parse the checkpoint file. Returns the parsed object, or null if
// the file is absent, unreadable, or not valid JSON. The content is untrusted
// data (the file is user-writable): callers compare its plan against the armed
// goal's and must never surface its values unsanitized.
function readCheckpoint(cwd) {
    try {
        const raw = fs.readFileSync(checkpointPath(cwd), 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// Write the checkpoint atomically (tmp file + rename), recording the plan it
// belongs to and the session the goal is currently bound to. Returns
// { ok:true, plan } or { ok:false, reason }; never throws.
//
// The plan path is validated through kit-goal-lib's normalizePlanArg, the same
// gate every stored plan path passes: it rejects control characters and any
// path that escapes cwd, and the NORMALIZED form is what gets stored. For a
// plan armGoal wrote, normalization is idempotent, so the stored value equals
// the goal's and the gate's equality check matches; a hand-edited goal state
// carrying a value armGoal would never have written either refuses here or
// stores a normalized form the gate reads as absent, both of which degrade to
// the status quo rather than opening the gate on untrusted input.
//
// boundSession pins the checkpoint to the run that opened it: the gate treats
// a checkpoint whose recorded boundSession does not match the goal's as
// absent, so a checkpoint orphaned by a crash cannot open the gate for the
// re-bound session that resumes the plan. The value is copied from the goal
// state, so it is held to bindSession's own storage rules (a string, capped
// length, no control characters); null is stored as null (an unbound goal),
// which the gate likewise never matches.
//
// The tmp name carries this process's pid so two writers never collide on the
// same tmp path, and a failed rename unlinks its tmp so orphans do not
// accumulate in .kit/.
function writeCheckpoint(cwd, planRel, boundSession) {
    const normalized = normalizePlanArg(cwd, planRel);
    if (normalized === null) {
        return { ok: false, reason: 'plan path is invalid or outside the repo' };
    }
    let session = null;
    if (boundSession !== undefined && boundSession !== null) {
        if (typeof boundSession !== 'string' || boundSession === '' || boundSession.length > 128
            || /[\x00-\x1F]/.test(boundSession)) {
            return { ok: false, reason: 'bound session is invalid' };
        }
        session = boundSession;
    }
    const cp = checkpointPath(cwd);
    const state = { plan: normalized, boundSession: session, openedAt: new Date().toISOString() };
    try {
        fs.mkdirSync(path.dirname(cp), { recursive: true });
        const tmp = cp + '.tmp.' + process.pid;
        try {
            fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf8');
            fs.renameSync(tmp, cp);
        } catch (err) {
            try { fs.unlinkSync(tmp); } catch { /* nothing to remove, or it is the unwritable path itself */ }
            throw err;
        }
    } catch (err) {
        return { ok: false, reason: 'could not write checkpoint: ' + (err && err.message ? err.message : String(err)) };
    }
    return { ok: true, plan: normalized };
}

// Delete the checkpoint file if present. Returns { ok:true, cleared:true } when
// a file was removed, { ok:true, cleared:false } when none was open, and
// { ok:false, cleared:false, reason } when the file exists but the delete
// failed. Never throws. The gate calls this to consume a matching checkpoint;
// a failed delete there degrades to the gate standing open (compaction lands
// mid-chapter, the pre-gate status quo), never to a wedged session.
function clearCheckpoint(cwd) {
    const cp = checkpointPath(cwd);
    try {
        if (!fs.existsSync(cp)) {
            return { ok: true, cleared: false };
        }
        fs.unlinkSync(cp);
        return { ok: true, cleared: true };
    } catch (err) {
        return {
            ok: false,
            cleared: false,
            reason: 'could not clear checkpoint: ' + (err && err.message ? err.message : String(err))
        };
    }
}

// ---------------------------------------------------------------------------
// Shared transcript reading.
// ---------------------------------------------------------------------------

// Read a transcript with a size cap: for a large file, the head plus tail. The
// evidence each consumer scans for can land near either end of a long-running
// session: the arming invocation and any re-arm for the goal leash, and for
// the gate's automation scan a /loop invocation's first user line (head)
// beside the newest goal_status record (tail). It is the goal leash's reader
// and the automation scan's above-ceiling fallback (see
// readTranscriptForAutomation, which owns why the fallback is not that scan's
// primary read). Returns '' on any error or a non-regular file, whatever the
// size. The isFile check narrows, without closing, the window in which the
// path could be swapped for a FIFO between the stat and the open (a blocking
// read on a FIFO hangs, which no try/catch can rescue): both read branches
// re-resolve the path after the stat. The residual is accepted because
// exploiting it needs write access to the transcript's directory, which
// already implies control of the transcript contents themselves.
function readTranscriptCapped(transcriptPath) {
    try {
        const st = fs.statSync(transcriptPath);
        if (!st.isFile()) return '';
        const HEAD = 384 * 1024;
        const TAIL = 128 * 1024;
        if (st.size <= 512 * 1024) {
            return fs.readFileSync(transcriptPath, 'utf8');
        }
        const fd = fs.openSync(transcriptPath, 'r');
        try {
            const head = Buffer.alloc(HEAD);
            const hb = fs.readSync(fd, head, 0, HEAD, 0);
            const tail = Buffer.alloc(TAIL);
            const tb = fs.readSync(fd, tail, 0, TAIL, st.size - TAIL);
            return head.toString('utf8', 0, hb) + '\n' + tail.toString('utf8', 0, tb);
        } finally {
            try { fs.closeSync(fd); } catch { /* already closed */ }
        }
    } catch {
        return '';
    }
}

// Remove local-command output and caveat blocks from user-slot text. When a user
// runs a slash command the CLI echoes its stdout (and a caveat) back into the
// user turn inside <local-command-stdout>/<local-command-caveat> wrappers; that
// is the CLI's own output, not something the user typed, so it must not bind the
// leash (e.g. /kit-goal status prints the armed plan path, and a catted file or
// grep hit can echo a literal <command-args> string as data). The deliberate
// slash-command invocation record (<command-name>/<command-args>) is NOT
// stripped: the plan path a user types as a command argument is exactly how the
// arming session claims the binding. A close tag counts only when it names the
// same wrapper as its opener, so a coincidental mismatched-name closing tag
// inside real output cannot terminate the strip early and leave the rest of that
// output, or content past it, looking like ordinary typed text. The paired strip
// is greedy: it runs to the LAST same-name close tag in the entry, so echoed
// output that embeds a literal same-name close tag followed by a fake
// <command-name>/<command-args> claim cannot end the strip early and expose that
// claim. The accepted trade-off is that genuine typed text sitting between two
// same-name blocks in one entry is over-stripped, which errs toward NOT claiming
// (the safe direction). An opener with no matching closer anywhere in the
// (possibly capped) text is a truncated echo (cut by the read cap, or caught
// mid-write); it is stripped to end-of-text rather than left holding whatever it
// happened to contain.
//
// The implementation is a linear scan (one pass recording the last close tag
// per wrapper name, one pass over the openers) rather than a backtracking
// regex: this runs on user-slot text on per-turn hook paths, and a crafted
// entry dense with unmatched openers must cost milliseconds, not seconds (a
// greedy-with-backreference regex restarts an O(n) backtrack at every such
// opener, which is quadratic). The gate test suite pins both the semantics
// (differentially, against the regex form as a reference) and the bound.
function stripLocalCommandOutput(text) {
    // One forward pass records the LAST close tag per wrapper name, so the
    // opener loop below never rescans the text. Tags are matched
    // case-insensitively and pair across case, hence the case-folded map key;
    // the emitted text is always sliced from the original.
    const lastClose = new Map();
    const closeRe = /<\/local-command-([a-z]+)>/gi;
    let c;
    while ((c = closeRe.exec(text))) {
        lastClose.set(c[1].toLowerCase(), { start: c.index, end: c.index + c[0].length });
    }
    const openRe = /<local-command-([a-z]+)>/gi;
    let out = '';
    let pos = 0;
    for (;;) {
        openRe.lastIndex = pos;
        const m = openRe.exec(text);
        if (!m) return out + text.slice(pos);
        out += text.slice(pos, m.index) + ' ';
        const close = lastClose.get(m[1].toLowerCase());
        if (close && close.start >= m.index + m[0].length) {
            // Paired: strip to the LAST same-name close (greedy). Anything
            // between two same-name blocks, openers of other names included,
            // goes with the span, exactly as the greedy pairing implies.
            pos = close.end;
        } else {
            // Unmatched: stripped to end-of-text.
            return out;
        }
    }
}

// Every <command-args>...</command-args> span in the given text, in order:
// each span runs from an opener to the FIRST close after it, and scanning
// resumes past that close, the same non-overlapping enumeration a global lazy
// regex produces, but as linear literal scans (a lazy [\s\S]*? span restarts
// an O(n) walk at every unclosed opener, which is quadratic on crafted text
// and measured in whole seconds at the transcript read cap). Tags match
// case-insensitively. Spans are returned raw: callers own their
// normalization. An unclosed trailing opener contributes no span. Shared by
// the goal-leash Stop hook (userCommandArgsInclude searches every span) and
// the gate's automation detection (which reads the first span only); the two
// must enumerate identically, which is why there is exactly one scanner.
function commandArgsSpans(text) {
    const spans = [];
    const openRe = /<command-args>/gi;
    const closeRe = /<\/command-args>/gi;
    let pos = 0;
    for (;;) {
        openRe.lastIndex = pos;
        const o = openRe.exec(text);
        if (!o) return spans;
        closeRe.lastIndex = o.index + o[0].length;
        const c = closeRe.exec(text);
        if (!c) return spans;
        spans.push(text.slice(o.index + o[0].length, c.index));
        pos = c.index + c[0].length;
    }
}

// ---------------------------------------------------------------------------
// Automation detection for the PreCompact gate's interactive-deferral clause.
//
// The gate defers auto-compaction to the safety ceiling only when the session
// is a human interacting directly; a session driven by native /goal or /loop
// keeps the harness's early trigger. The transcript is the detection surface,
// and the shapes read here are undocumented harness output, the same class as
// the gate's other version-pinned facts: real-transcript observations, except
// the /goal clear argument shape, which follows from the invariant command
// markup and fails safe if wrong (an unrecognized clear leaves the newest
// evidence at met:false and the session on the early trigger). Detection
// errs toward "automated" only via absent evidence never arriving (a loop
// that stops being continued classifies automated indefinitely); every read
// or parse defect classifies as no evidence, and the gate turns that into a
// verdict whose failure direction is the early-trigger status quo.
// ---------------------------------------------------------------------------

// The literal command-name tags a typed /goal or /loop invocation writes. The
// FULL tag is load-bearing: a continuing ScheduleWakeup carries the loop's
// prompt verbatim, so a bare '/loop' substring appears in every wakeup and
// would read each one as a fresh invocation.
const GOAL_COMMAND_TAG = '<command-name>/goal</command-name>';
const LOOP_COMMAND_TAG = '<command-name>/loop</command-name>';

// Extract the genuinely user-typed text of a user entry's message: a string
// content, or the concatenated {type:'text'} blocks of an array content.
// Returns null when there is none, and null for an array carrying any
// tool_result block: tool output is the observed source of quoted command
// markup (a file containing the literal tags, read back into the session),
// and the harness's own /loop detector excludes exactly this shape, so the
// whole entry is discarded rather than trusting its text blocks.
function userTypedText(message) {
    if (!message) return null;
    const c = message.content;
    if (typeof c === 'string') return c;
    if (!Array.isArray(c)) return null;
    let text = '';
    for (const b of c) {
        if (b && b.type === 'tool_result') return null;
        if (b && b.type === 'text' && typeof b.text === 'string') text += '\n' + b.text;
    }
    return text;
}

// Scan transcript text for evidence that native /goal or /loop is driving the
// session. Returns true when either is in effect by the NEWEST evidence of
// its kind: transcripts are append-ordered, so a single forward pass letting
// the last match of each kind win reads newest-wins for free (the real
// end-of-loop sequence is /loop lines followed by a terminal stop, after
// which the session continues as ordinary interactive work).
//
// Evidence, per instrument:
//   /goal, surface 1: a goal_status attachment (type 'attachment', its
//     attachment.type 'goal_status'), which the goal system writes at arming
//     and at every stop evaluation. met === false means in effect; met ===
//     true means satisfied and auto-cleared, so not. Only a strict boolean
//     met decides; sentinel and reason are carried but decide nothing (a
//     real record carries met:true beside sentinel:true).
//   /goal, surface 2: a user command line whose <command-name> is exactly
//     /goal. <command-args> trimmed and lowercased equal to 'clear' means
//     not in effect; any other non-empty argument means in effect; a bare
//     /goal (empty args) reads state and decides nothing.
//   /loop: a user command line whose <command-name> is exactly /loop means
//     in effect; an assistant ScheduleWakeup tool_use whose input.stop is
//     strictly true means the loop ended. A continuing wakeup (delaySeconds,
//     prompt, ...) decides nothing: every iteration of a dynamic loop
//     re-writes its own /loop command line, so the positive evidence
//     refreshes without it.
//
// Tag order in a command line is not fixed (/loop writes <command-message>
// before <command-name>, /goal the other way), so each tag is matched by its
// own independent regex, first tag of each kind winning within the entry.
//
// Exclusions, adopted from the harness's own /loop detector, each defeating
// an observed false positive (quoted markup rides in tool output whenever a
// file containing the tags is read into a session):
//   - a raw line containing the quoted JSON form "tool_result" (quotes
//     included, the same discriminator the harness's detector uses) is never
//     a command line; the bare substring would also skip a genuine typed
//     command whose argument text merely mentions tool_result;
//   - a command line must be entry.type 'user', the wakeup entry.type
//     'assistant';
//   - isMeta, isCompactSummary, and sidechain entries are skipped;
//   - array content holding any tool_result block discards the entry
//     (userTypedText above);
//   - local-command output is stripped before the tag scan (a /goal
//     invocation's own stdout is echoed back inside <local-command-stdout>
//     carrying the full goal condition text);
//   - the ScheduleWakeup check is structural, never a substring (the tool
//     listing rides in system-prompt-shaped entries, so the bare name
//     appears in transcripts with no real invocation).
//
// String prefilters run before any JSON.parse so a multi-megabyte scan costs
// milliseconds; an unparseable line is skipped, no evidence.
function automationInEffect(text) {
    let goalInEffect = null;
    let loopInEffect = null;
    const lines = text.split('\n');
    for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        const rawToolResult = t.includes('"tool_result"');
        const mayGoalStatus = t.includes('"goal_status"');
        const mayGoalLine = !rawToolResult && t.includes(GOAL_COMMAND_TAG);
        const mayLoopLine = !rawToolResult && t.includes(LOOP_COMMAND_TAG);
        const mayWakeup = t.includes('tool_use') && t.includes('ScheduleWakeup');
        if (!mayGoalStatus && !mayGoalLine && !mayLoopLine && !mayWakeup) continue;
        let entry;
        try { entry = JSON.parse(t); } catch { continue; }
        if (!entry || typeof entry !== 'object') continue;
        if (entry.isSidechain || entry.isMeta === true || entry.isCompactSummary === true) continue;

        if (mayGoalStatus && entry.type === 'attachment'
                && entry.attachment && typeof entry.attachment === 'object'
                && entry.attachment.type === 'goal_status') {
            if (entry.attachment.met === false) goalInEffect = true;
            else if (entry.attachment.met === true) goalInEffect = false;
            continue;
        }

        if ((mayGoalLine || mayLoopLine) && entry.type === 'user') {
            const typed = userTypedText(entry.message);
            if (typed === null) continue;
            const stripped = stripLocalCommandOutput(typed);
            const nameMatch = /<command-name>([^<]*)<\/command-name>/i.exec(stripped);
            if (!nameMatch) continue;
            const name = nameMatch[1].trim();
            if (name === '/loop') {
                loopInEffect = true;
            } else if (name === '/goal') {
                // The first <command-args> span decides (first tag wins, the
                // convention every command-line reader here follows); no span
                // at all, an unclosed opener included, decides nothing.
                const spans = commandArgsSpans(stripped);
                const args = spans.length > 0 ? spans[0].trim().toLowerCase() : '';
                if (args === 'clear') goalInEffect = false;
                else if (args !== '') goalInEffect = true;
            }
            continue;
        }

        if (mayWakeup && entry.type === 'assistant') {
            const content = entry.message && entry.message.content;
            if (!Array.isArray(content)) continue;
            for (const b of content) {
                if (b && b.type === 'tool_use' && b.name === 'ScheduleWakeup'
                        && b.input && typeof b.input === 'object'
                        && b.input.stop === true) {
                    loopInEffect = false;
                }
            }
        }
    }
    return goalInEffect === true || loopInEffect === true;
}

// The byte ceiling on reading a transcript whole for the automation scan.
//
// Newest-evidence-wins only holds over bytes actually read, so the scan wants
// the whole file: a head-plus-tail read leaves an unread middle, and a loop
// whose terminating stop lands there shows its opening /loop line and nothing
// that retires it, classifying a session that has been hands-on for hours as
// automation-driven. That is the exact case the deferral exists to serve, and
// it is the common one, because a session keeps working for as long as it
// likes after its loop ends.
//
// 64 MB scans a whole multi-day session (the largest transcripts observed run
// to 57 MB) with headroom, and the cost is linear and bounded: at that size
// the read plus classification is roughly 150 ms and 175 MB of peak resident
// memory in this short-lived hook process, which runs only when the harness
// is already offering a compaction. Past the ceiling the head-plus-tail
// reader takes over, so a runaway or hostile file costs the same 512 KB it
// always did; the unread middle comes back with it, and the misread it can
// produce degrades to the early trigger, never to a wedged session.
const AUTOMATION_READ_MAX_BYTES = 64 * 1024 * 1024;

// Read a transcript for the automation scan: the whole file at or below
// AUTOMATION_READ_MAX_BYTES, the head-plus-tail read above it. Returns '' on
// any error or a non-regular file, which classifies as no evidence. The
// isFile check narrows the same FIFO-swap window readTranscriptCapped
// documents, and on the same accepted residual: a blocking read on a FIFO
// hangs where no try/catch can rescue it, and the path is re-resolved after
// the stat either way.
function readTranscriptForAutomation(transcriptPath) {
    try {
        const st = fs.statSync(transcriptPath);
        if (!st.isFile()) return '';
        if (st.size > AUTOMATION_READ_MAX_BYTES) return readTranscriptCapped(transcriptPath);
        return fs.readFileSync(transcriptPath, 'utf8');
    } catch {
        return '';
    }
}

// Does the transcript at this path show a native automation instrument
// driving the session? A missing path, an unreadable or non-regular file, or
// any escape reads as no evidence (false); the caller's valve leg reads the
// same file, so an unreadable transcript also yields no consumed-token
// reading and the gate's verdict on it is allow.
function transcriptShowsAutomation(transcriptPath) {
    try {
        if (!transcriptPath) return false;
        const text = readTranscriptForAutomation(transcriptPath);
        if (!text) return false;
        return automationInEffect(text);
    } catch {
        return false;
    }
}

module.exports = {
    checkpointPath, readCheckpoint, writeCheckpoint, clearCheckpoint,
    checkpointMatches, sameSessionId,
    CHECKPOINT_MAX_AGE_MS, CHECKPOINT_FUTURE_SKEW_MS,
    readTranscriptCapped, stripLocalCommandOutput, commandArgsSpans,
    automationInEffect, transcriptShowsAutomation
};
