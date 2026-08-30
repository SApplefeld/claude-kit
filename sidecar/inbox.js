// The daemon's writing side of the delivery inbox: one JSONL file per observed
// session, appended by this daemon and read by the kit's capture hook on that
// session's next tool call.
//
// Everything lives under `<stateDir>/inbox/`, per sidecar/CONTRACT.md:
//
//   inbox/<sessionSlug>.jsonl   the queued items for one session
//   inbox/<sessionSlug>.offset  how far that session's hook has delivered
//
// The daemon writes only the first of those two. The offset file is the hook's,
// written by the process being spoken to, and this module never reads it: the
// two halves of the valve share a directory and nothing else, exactly as the
// spool's two halves do.
//
// POINTERS, NEVER BODIES. An item carries the stated intent, one clause of
// reason, and the identity of the call it is about. It never carries the
// command, the output, a record body or a transcript quote. What reaches a
// session through the valve is enough to know there is something to look at and
// where to look; the durable record stays in the findings file and in the
// verdict log, where a reader goes to verify.
//
// Every text field is neutralized on the way in, through the shared guard in
// sidecar/text.js. The reason field is the endpoint's own prose and the intent
// field is text the observed session wrote, so both are untrusted, and the
// inbox is read by a hook that puts its content in front of a model. The hook
// neutralizes again on its own side: it cannot require this tree, and the inbox
// is an ordinary file any process running as this user can append to, so a
// guard applied only here would protect only the lines this daemon wrote.
//
// Nothing here throws at its caller. A write that fails is reported and counted
// by the caller, on the same footing as a verdict log that cannot be written.

'use strict';

const fs = require('fs');
const path = require('path');

const logs = require('./logs.js');
const { neutralize } = require('./text.js');

// The item schema version. Independent of the spool line's version and of the
// log record's: three contracts, three writers. A reader that does not
// recognize it skips the line.
const INBOX_VERSION = 1;

// The cap on each text field an item carries. The hook delivers at most 600
// bytes per tool call across every item in a batch, so a field long enough to
// spend that budget by itself would starve the items behind it; 200 characters
// holds a stated intent and a one-clause reason whole in every realistic case.
// The judge already caps a reason at 300 characters, so this is the second and
// tighter of two bounds rather than the only one.
const ITEM_TEXT_CAP = 200;

// A session's inbox file. The slug is logs.sessionSlug, the same sanitizer the
// verdict logs take, because a session id is an opaque string from another
// process and it is reaching a file name here too.
function inboxFile(inboxDir, sessionId) {
    return path.join(inboxDir, `${logs.sessionSlug(sessionId)}.jsonl`);
}

function itemText(text) {
    return neutralize(text).slice(0, ITEM_TEXT_CAP);
}

// A diverged verdict as one delivery item. Built from the verdict record rather
// than from the spool entry, so the intent and the reason an item carries are
// the same two strings the durable record carries and a reader comparing the
// two is comparing like with like.
function alertItem(record, nowMs) {
    return {
        v: INBOX_VERSION,
        kind: 'alert',
        ts: new Date(nowMs).toISOString(),
        callId: typeof record.callId === 'string' ? record.callId : '',
        sessionId: typeof record.sessionId === 'string' ? record.sessionId : '',
        intent: itemText(record.intent),
        reason: itemText(record.reason)
    };
}

// Append one item to its session's inbox. Returns whether it landed; a failure
// is the caller's to count and report, never an exception to unwind a drain
// with.
//
// The directory is SCREENED here and never created. Creating it belongs to
// startup and nowhere else, because deleting it is the documented way to switch
// in-band delivery off: a writer that recreated it on the next diverged verdict
// would re-arm the valve with no restart and no signal, which is the opposite
// of the lever the contract describes and the opposite of how the spool half
// behaves. A symlink or a Windows junction in its place is refused for the
// usual reason, and so is a link wearing the session's own file name, which
// would otherwise send every pointer wherever it pointed while the hook, which
// screens that same path on its side, quietly read nothing.
function writeItem(inboxDir, item) {
    let dst = null;
    try { dst = fs.lstatSync(inboxDir); } catch { return false; }
    if (dst.isSymbolicLink() || !dst.isDirectory()) return false;

    const file = inboxFile(inboxDir, item.sessionId);
    let fst = null;
    try { fst = fs.lstatSync(file); } catch { fst = null; }
    if (fst !== null && (fst.isSymbolicLink() || !fst.isFile())) return false;

    return logs.appendJsonLine(file, item);
}

// Whether this call has already had an item written for it, and the record that
// it now has.
//
// A spool file that is reset (rotated or truncated outside the daemon, which
// the contract names as an expected event) is re-read from zero, so a call can
// reach the writing path a second time and would otherwise queue a second
// identical pointer. The set is persisted with the offsets and bounded to
// logs.DELIVERED_MAX ids, oldest dropped first: past the bound, a reset
// reaching further back than that many DIVERGED verdicts can deliver one call's
// pointer twice. A duplicate pointer costs a reader one redundant line; an
// unbounded set costs the state file its size forever, and losing the record of
// a divergence is not on the table either way, since the findings file holds it
// whatever the inbox does.
// The key is the KIND and the call id together, never the call id alone. One
// call can earn one item of each kind: a diverged verdict and a memory pointer
// are two different things to say about the same call, and a set keyed on the
// bare id would drop the second one silently, with no counter and no report,
// the moment recognition starts writing pointers.
function deliveryKey(item) {
    const kind = (item && typeof item.kind === 'string') ? item.kind : '';
    const callId = (item && typeof item.callId === 'string') ? item.callId : '';
    return `${kind}:${callId}`;
}

function alreadyDelivered(state, item) {
    return Array.isArray(state.delivered) && state.delivered.includes(deliveryKey(item));
}

function markDelivered(state, item) {
    const key = deliveryKey(item);
    if (!Array.isArray(state.delivered)) state.delivered = [];
    if (state.delivered.includes(key)) return;
    state.delivered.push(key);
    if (state.delivered.length > logs.DELIVERED_MAX) {
        state.delivered.splice(0, state.delivered.length - logs.DELIVERED_MAX);
    }
}

// The names this sweep will touch: a session's queue, its delivered offset, the
// hook's exclusive claim, and the temporary either of the last two is written
// through. The temporaries are named here because a process killed between an
// exclusive create and its rename leaves one behind, and a name nothing sweeps
// is a name that accumulates for as long as the machine runs.
const INBOX_FILE_RE = /^[A-Za-z0-9._-]+\.(jsonl|offset|lock)(\.tmp\.[0-9]+\.[0-9a-f]+)?$/;

// The queue file and the offset file for one session, from any of those names.
function inboxBaseName(name) {
    const match = /^([A-Za-z0-9._-]+?)\.(jsonl|offset|lock)(\.tmp\.[0-9]+\.[0-9a-f]+)?$/.exec(name);
    return match === null ? null : { base: match[1], kind: match[2], temp: match[3] !== undefined };
}

const MS_PER_DAY_INBOX = 24 * 60 * 60 * 1000;

// Delete inbox files past the retention window, on the same window and the same
// pass as the spool and the daemon's own logs.
//
// An item holds the intent a session wrote and one clause about what its call
// did, which is a third plaintext concentration under the user's home directory
// and the only one nothing else expires: a session that stopped running leaves
// its undelivered items behind forever, because the reader that would have
// consumed them is gone with it.
//
// A QUEUE AND ITS OFFSET EXPIRE TOGETHER, NEVER SEPARATELY. The two files age
// on different clocks: the hook stops touching the offset the moment the queue
// is drained, while the daemon keeps appending to the queue, so a long-lived
// session reaches a state where the offset is stale and the queue is fresh.
// Deleting the offset alone there resets that session's delivery to byte zero,
// and its next tool call re-delivers every item the queue has ever held, three
// per call, into a live context: the repeat injection the offset exists to make
// impossible. So an offset is deleted only when its queue is absent or is going
// in the same pass. The reverse pairing needs no rule, since a queue deleted
// with its offset left behind only stops delivery until both are gone.
//
// A claim file and a temporary are neither, and expire on their own age: they
// carry no delivery state, and one is only ever left behind by a process that
// died holding it.
//
// Never throws. Reports what it deleted, what it could not, and what it refused
// to look at, on the same footing as the log sweep: a sweep that silently
// deleted nothing and one that silently deleted the lot look identical from
// outside.
function sweepInbox(inboxDir, options) {
    const opts = options || {};
    const nowMs = opts.nowMs === undefined ? Date.now() : opts.nowMs;
    const days = opts.retentionDays === undefined ? 14 : opts.retentionDays;
    // `held` is an expired offset kept because its queue survives, which is a
    // deliberate refusal rather than a miss, and a sweep that could not say so
    // reads as one that simply did not see the file.
    const report = { deleted: [], failed: [], held: [], skipped: null };

    if (!Number.isFinite(nowMs) || nowMs <= 0 || !Number.isInteger(days) || days < 1 || days > 3650) {
        report.skipped = 'no usable retention window, so no inbox file was deleted';
        return report;
    }
    const cutoffMs = nowMs - (days * MS_PER_DAY_INBOX);

    let names = [];
    try {
        names = fs.readdirSync(inboxDir);
    } catch {
        report.skipped = 'inbox directory unreadable, so no inbox file was deleted';
        return report;
    }

    // Every candidate first, with its kind and its age, because whether an
    // offset may go depends on what is happening to the queue beside it.
    const entries = [];
    for (const name of names) {
        const parsed = inboxBaseName(name);
        if (parsed === null) continue;
        let st = null;
        try { st = fs.lstatSync(path.join(inboxDir, name)); } catch { continue; }
        if (!st.isFile() || st.isSymbolicLink()) continue;
        entries.push({ name, base: parsed.base, kind: parsed.kind, temp: parsed.temp, expired: st.mtimeMs < cutoffMs });
    }

    // The sessions whose queue survives this pass. An offset whose base is in
    // this set stays, however old it is.
    const queueKept = new Set();
    for (const entry of entries) {
        if (entry.kind === 'jsonl' && !entry.temp && !entry.expired) queueKept.add(entry.base);
    }

    for (const entry of entries) {
        if (!entry.expired) continue;
        if (entry.kind === 'offset' && !entry.temp && queueKept.has(entry.base)) {
            report.held.push(entry.name);
            continue;
        }
        try {
            fs.unlinkSync(path.join(inboxDir, entry.name));
            report.deleted.push(entry.name);
        } catch (err) {
            report.failed.push({ name: entry.name, detail: (err && err.code) ? err.code : 'unlink failed' });
        }
    }
    return report;
}

module.exports = {
    INBOX_VERSION,
    ITEM_TEXT_CAP,
    inboxFile,
    inboxBaseName,
    itemText,
    alertItem,
    writeItem,
    deliveryKey,
    alreadyDelivered,
    markDelivered,
    sweepInbox
};
