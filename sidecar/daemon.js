#!/usr/bin/env node
// The judge daemon: a second reader over the fleet's tool calls.
//
// One process per VM, started by hand, run from the working clone. It consumes
// the capture spool the kit's PostToolUse hook writes, asks the machine's local
// model whether each call did what its stated intent required, and records the
// verdict. The defect class it exists for is the quiet one: an exit code that
// belongs to the wrong command in a pipeline, a search whose silence proves
// nothing about its pattern, a staged list holding more than the intent named.
// A green exit is not evidence, and this daemon is how the fleet stops having
// to take its own word for it.
//
// The file contract with the hook is sidecar/CONTRACT.md, and the two halves
// never import each other.
//
// ACTIVATION. Creating the spool root is this daemon's act, not the hook's. The
// hook lstats that directory on every Bash call and exits silently when it is
// absent, so the kit ships inert: installing it turns nothing on, running this
// daemon once turns capture on for every session on the machine from its next
// tool call, and deleting the root turns it off again with no restart and no
// setting. A machine with no endpoint config never reaches that step, which is
// deliberate: switching capture on where nothing can ever consume it would
// accrue plaintext command output for no reader.
//
// SPEAKING BACK. A diverged verdict is also queued as one item in the observed
// session's inbox under the state root, which the kit's capture hook reads on
// that session's next tool call and puts in front of the model as advisory
// text. The item is a pointer: the stated intent, the one clause of reason, and
// the call id, never the command, the output or anything else the spool holds.
// One item per call per kind, deduplicated on the two together so a re-read
// spool does not speak twice while a call can still earn one item of each kind.
// sidecar/inbox.js owns that file and sidecar/CONTRACT.md states the schema and
// the caps the reading half applies.
//
// WHERE THE DATA GOES. sidecar/judge.js is the module that puts spool content
// on the wire, and its header states the posture in full: every judgment POSTs
// the intent, the command and its output off this VM to the Hyper-V host across
// the virtual switch, over plain HTTP with no authentication in the default
// configuration, to a model service shared with other tenants of that host.
// Nothing redacts. Running this daemon is that decision.
//
// GAPS, NOT SILENCE. When the endpoint cannot answer, the calls in that stretch
// are written down as NOT JUDGED with their range and the reason, in the
// session's own verdict log and in the findings file. An instrument that went
// quiet while the endpoint was down would report a clean fleet, and a clean
// fleet is exactly what an unmeasured one looks like. The paths are kept apart
// because they call for different behavior: a timeout means the serial lane is
// busy behind the host's other tenant, so never block; a refusal means the
// endpoint answered and said no, so move on without a wait; an unusable answer
// means it answered with something that is not a verdict, which names a
// different repair from a refusal and so carries its own reason; a connection
// failure after a healthy period may be the runner restarting, so retry ONCE
// after the reload window and gap-mark if it is still gone. Each latches after a
// few in a row, which is what keeps "keep consuming" from becoming a retry storm
// against a host that is plainly unavailable.
//
// A latch does one of two things, and which one turns on whether the condition
// is transient. A busy lane clears in minutes, so that latch STOPS the pass with
// its offset held and the backlog is re-attempted next pass: consuming past it
// would discard somebody else's five minutes of queueing as permanently
// unjudged calls. A down or refusing endpoint is not a wait, so those latches
// keep consuming and gap-mark, because the record of a cannot-measure is the
// product, and holding for an outage that lasts would leave the whole stretch
// unrecorded until retention deleted the spool out from under it.
//
// NEVER THROWS ITS WAY OUT OF A RUN. A malformed line, an unreadable day file,
// a corrupt offset map, an HTTP 500, a timeout: each is handled, counted and
// reported on stderr, and the drain continues. This is not the hook's silent
// fail-open posture, since a standalone process disturbs no session by
// complaining; but reporting loudly never means aborting the drain.
//
// WHAT STDERR MAY CARRY. Diagnostics name call ids, counts and file names. The
// one exception is the skip line for a line whose schema version this daemon
// does not recognize, which echoes that version value alone, bounded to sixty
// characters and stripped of anything that could repaint a terminal, because a
// reader cannot act on "some other version" without being told which. No other
// spool content reaches stderr: the spool holds whatever a command printed,
// tokens and keys included, and a terminal, a scrollback and a redirected log
// are three more places for it to sit.
//
// Usage:
//   node sidecar/daemon.js [--once] [--state-dir <path>] [--config <path>]
//                          [--poll-ms <n>] [--retention-days <n>]
//
//   --once            drain the spool and exit; the default is a watch loop
//   --state-dir       the sidecar state root, default ~/.claude/kit-sidecar
//   --config          the endpoint config, default ~/.claude/kit-endpoint.json
//   --poll-ms         idle poll interval in the watch loop, default 2000
//   --retention-days  the spool retention window, default 14
//
// --state-dir and --config together are what let a replay run, and every test
// in this repository, work against a scratch directory rather than the live
// store.

'use strict';

const path = require('path');

const { loadEndpointConfig, defaultStateDir, statePaths } = require('./config.js');
const spool = require('./spool.js');
const logs = require('./logs.js');
const inbox = require('./inbox.js');
const judge = require('./judge.js');
const prompt = require('./prompts/judgment-v2.js');

// The idle poll interval in the watch loop. The fleet produces a few thousand
// calls a day against a lane that clears one to two verdicts a second, so the
// daemon spends nearly all of its life here; two seconds is a latency nobody
// notices and a wake-up cost of one directory read.
const DEFAULT_POLL_MS = 2000;

// How long to wait before the single retry a connection failure earns. The
// runner reloads in about six and a half seconds, so seven is the far side of a
// restart rather than a guess at one.
const RELOAD_WINDOW_MS = 7000;

// Consecutive failures of one kind before that kind latches for the rest of the
// pass and the remaining entries are gap-marked without a call. Three is enough
// to tell a single unlucky call from an endpoint that is simply not answering,
// and it is what keeps a backlog of ten thousand entries from becoming ten
// thousand doomed requests.
const MAX_CONSECUTIVE_FAILURES = 3;

// A bound on chunks read from one file in one pass, so a pass over a huge
// backlog still ends and the watch loop still gets its turn.
const MAX_CHUNKS_PER_FILE = 512;

function sleepMs(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function parseArgs(argv) {
    const options = {
        once: false,
        stateDir: null,
        configPath: null,
        pollMs: DEFAULT_POLL_MS,
        retentionDays: spool.RETENTION_DAYS,
        help: false
    };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const value = argv[i + 1];
        if (arg === '--once') { options.once = true; continue; }
        if (arg === '--help' || arg === '-h') { options.help = true; continue; }
        if (arg === '--state-dir') {
            if (typeof value !== 'string' || value === '') return { ok: false, error: '--state-dir needs a path' };
            options.stateDir = value; i += 1; continue;
        }
        if (arg === '--config') {
            if (typeof value !== 'string' || value === '') return { ok: false, error: '--config needs a path' };
            options.configPath = value; i += 1; continue;
        }
        if (arg === '--poll-ms') {
            const n = Number(value);
            if (!Number.isFinite(n) || n < 100 || n > 600000) return { ok: false, error: '--poll-ms needs a number of milliseconds between 100 and 600000' };
            options.pollMs = Math.round(n); i += 1; continue;
        }
        if (arg === '--retention-days') {
            const n = Number(value);
            if (!Number.isInteger(n) || n < 1 || n > 3650) return { ok: false, error: '--retention-days needs a whole number of days between 1 and 3650' };
            options.retentionDays = n; i += 1; continue;
        }
        return { ok: false, error: `unknown argument: ${arg}` };
    }
    return { ok: true, options };
}

const USAGE = [
    'kit judgment sidecar: judge daemon',
    '',
    'usage: node sidecar/daemon.js [--once] [--state-dir <path>] [--config <path>]',
    '                             [--poll-ms <n>] [--retention-days <n>]',
    '',
    '  --once            drain the spool and exit (default: watch)',
    '  --state-dir       sidecar state root (default: ~/.claude/kit-sidecar)',
    '  --config          endpoint config (default: ~/.claude/kit-endpoint.json)',
    '  --poll-ms         idle poll interval, milliseconds (default: 2000)',
    '  --retention-days  spool retention window, days (default: 14)'
].join('\n');

// Everything the daemon holds for a run. `runtime` is the per-pass resilience
// state; `report` writes the stderr diagnostics.
function makeContext(rawOptions, deps) {
    // Defaults are filled here as well as in parseArgs, so a caller holding the
    // context directly (the suite, a replay script) gets the same daemon the
    // command line builds rather than one missing a poll interval.
    //
    // Per key, never a spread. A spread lets a key that is present and undefined
    // overwrite the default it was meant to fall back to, and the two keys that
    // happens to are the dangerous ones: `{ stateDir: undefined }` would point a
    // replay or a test at the live store under ~/.claude that --state-dir exists
    // to keep them off, and `{ pollMs: undefined }` would leave the watch loop
    // spinning on a one-millisecond sleep.
    const raw = rawOptions || {};
    const options = {
        once: raw.once ?? false,
        stateDir: raw.stateDir ?? null,
        configPath: raw.configPath ?? null,
        pollMs: raw.pollMs ?? DEFAULT_POLL_MS,
        retentionDays: raw.retentionDays ?? spool.RETENTION_DAYS,
        maxReadBytes: raw.maxReadBytes ?? undefined
    };
    const stateDir = (typeof options.stateDir === 'string' && options.stateDir !== '')
        ? path.resolve(options.stateDir) : defaultStateDir();
    return {
        options,
        paths: statePaths(stateDir),
        deps: {
            fetchImpl: (deps && deps.fetchImpl) || null,
            sleep: (deps && typeof deps.sleep === 'function') ? deps.sleep : sleepMs,
            now: (deps && typeof deps.now === 'function') ? deps.now : Date.now,
            report: (deps && typeof deps.report === 'function') ? deps.report
                : (text) => { process.stderr.write(`kit-sidecar: ${text}\n`); }
        },
        config: null,
        state: logs.emptyState(),
        runtime: {
            healthy: false,
            endpointDown: false,
            laneBusy: false,
            refusing: false,
            unusable: false,
            timeouts: 0,
            refusals: 0,
            unusables: 0
        },
        // Files already reported unreadable in this run. A day file the daemon
        // cannot open is reported once and then held: at a two-second poll a
        // permanently unreadable file would otherwise print some forty thousand
        // identical lines a day, which buries every other diagnostic.
        reportedUnreadable: new Set(),
        // The UTC day the last retention pass ran for. The watch loop runs
        // retention again when this stops being today.
        retentionDay: null,
        stopping: false
    };
}

// Read the config, create the state root and the spool root, run retention, and
// load the offset map. Returns the context on success, or a described refusal
// the caller reports and exits on. The spool root is created here and nowhere
// else: this function IS the activation act.
function startup(ctx) {
    const cfg = loadEndpointConfig(ctx.options.configPath);
    if (!cfg.ok) {
        return { ok: false, standDown: cfg.reason === 'absent', reason: cfg.reason, detail: cfg.detail || '', path: cfg.path };
    }
    ctx.config = cfg;
    for (const warning of (cfg.warnings || [])) ctx.deps.report(warning);

    // Where the export is going, said out loud when it is leaving the private
    // network. Every judgment POSTs a command and its output in cleartext, and
    // the configured address is a file anything running as this user can
    // rewrite, so a redirected endpoint would otherwise be invisible on every
    // surface this daemon has. The daemon does not refuse the host: prevention
    // against an actor with write access to ~/.claude is already lost, and what
    // was missing is detection. The address itself is not printed, here or
    // anywhere; the fingerprint is what identifies it.
    if (!ctx.config.endpointIsLocal) {
        ctx.deps.report('WARNING: the configured endpoint host is neither loopback nor a private network address, so every captured command and its output is being posted off this network in cleartext');
    }

    // The logs and inbox directories are made BEFORE the spool root, so a state
    // root the daemon cannot log into never has capture switched on for it:
    // activating the hook with nowhere to record what it captures would accrue
    // plaintext command output that nothing ever reads. Creating the inbox is
    // also the valve's activation act, on the same lever: the capture hook's
    // delivery duty lstats that directory and stays dormant while it is absent,
    // so no session is spoken to on a machine where nothing is judging.
    for (const dir of [ctx.paths.root, ctx.paths.logsDir, ctx.paths.inboxDir, ctx.paths.spoolDir]) {
        const made = logs.ensureDir(dir);
        if (!made.ok) return { ok: false, standDown: false, reason: 'state', detail: made.reason };
    }

    const loaded = logs.loadState(ctx.paths.stateFile);
    ctx.state = loaded.state;
    if (loaded.reset) {
        ctx.state.counters.stateResets += 1;
        ctx.deps.report(`offset state reset (${loaded.detail}); calls already judged may be judged again`);
    }

    const retention = runRetention(ctx);

    return { ok: true, retention };
}

// Retention over both plaintext concentrations this daemon is responsible for:
// the spool it reads and the logs it writes. Run at startup and again on every
// UTC day boundary the watch loop crosses.
//
// The day boundary is what makes the window mean anything. Watch is the default
// mode and the daemon is started by hand and left running, so a retention that
// only ever ran at startup would stop applying the longer the process lived,
// which is precisely backwards: the longer it runs, the more it has captured.
function runRetention(ctx) {
    const nowMs = ctx.deps.now();
    const retention = spool.runRetention(ctx.paths.spoolDir, ctx.state.offsets, {
        nowMs,
        retentionDays: ctx.options.retentionDays
    });
    if (retention.skipped !== null) {
        ctx.deps.report(`retention skipped: ${retention.skipped}`);
    } else if (retention.deleted.length > 0) {
        ctx.deps.report(`retention deleted ${retention.deleted.length} spool day file(s) older than ${retention.cutoffDay}: ${retention.deleted.join(', ')}`);
    }
    for (const failure of retention.failed) {
        ctx.deps.report(`retention could not delete ${failure.name}: ${failure.detail}`);
    }

    // The daemon's own logs, on the same window. A verdict log holds a bounded
    // preview of the command and the intent the session wrote, so the day the
    // spool file goes is the day that preview becomes the only copy of it.
    const sweep = logs.sweepLogs(ctx.paths.logsDir, {
        nowMs,
        retentionDays: ctx.options.retentionDays
    });
    if (sweep.skipped !== null) {
        ctx.deps.report(`log sweep skipped: ${sweep.skipped}`);
    } else if (sweep.deleted.length > 0) {
        ctx.deps.report(`log sweep deleted ${sweep.deleted.length} log file(s) older than ${ctx.options.retentionDays} days`);
    }
    if (sweep.rotated !== null) {
        ctx.deps.report(`findings file passed ${logs.FINDINGS_MAX_BYTES} bytes and was rotated to ${sweep.rotated}`);
    }
    for (const failure of sweep.failed) {
        ctx.deps.report(`log sweep could not handle ${failure.name}: ${failure.detail}`);
    }

    // The inbox, on the same window. An item holds a stated intent and one
    // clause about what the call did, and a session that stopped running leaves
    // its undelivered items behind with no reader left to consume them.
    const inboxSweep = inbox.sweepInbox(ctx.paths.inboxDir, {
        nowMs,
        retentionDays: ctx.options.retentionDays
    });
    if (inboxSweep.skipped !== null) {
        ctx.deps.report(`inbox sweep skipped: ${inboxSweep.skipped}`);
    } else if (inboxSweep.deleted.length > 0) {
        ctx.deps.report(`inbox sweep deleted ${inboxSweep.deleted.length} file(s) older than ${ctx.options.retentionDays} days`);
    }
    if (inboxSweep.held.length > 0) {
        ctx.deps.report(`inbox sweep kept ${inboxSweep.held.length} expired delivered-offset file(s) whose queue is still live; deleting one re-delivers that session's whole inbox`);
    }
    for (const failure of inboxSweep.failed) {
        ctx.deps.report(`inbox sweep could not handle ${failure.name}: ${failure.detail}`);
    }

    ctx.retentionDay = spool.utcDay(nowMs);
    logs.saveState(ctx.paths.stateFile, ctx.state);
    return { ...retention, sweep, inboxSweep };
}

// Accrue one unjudged call into the open gap for its session. Consecutive calls
// coalesce into one record with a range, which is what makes an outage read as
// "calls A to B not judged" rather than as a thousand lines.
//
// One open run per session, and a change of reason CLOSES it. A run keyed by
// session and reason together would let two records claim overlapping ranges:
// with a timeout, then a refusal, then a timeout in one session, the timeout
// record would say "calls A to C" while the refusal record said "call B", and a
// reader of findings.jsonl could not reconcile either range against its count.
// A record here describes one contiguous stretch of one session's calls and
// nothing else.
function accrueGap(ctx, pass, entry, outcome) {
    const reason = judge.GAP_REASONS[outcome.status] || 'not judged';
    const open = pass.gaps.get(entry.sessionId);
    if (open !== undefined && open.reason !== reason) {
        flushGaps(ctx, pass, entry.sessionId);
    }
    const existing = pass.gaps.get(entry.sessionId);
    if (existing === undefined) {
        pass.gaps.set(entry.sessionId, {
            sessionId: entry.sessionId,
            reason,
            count: 1,
            firstCallId: entry.callId,
            lastCallId: entry.callId,
            detail: outcome.detail || ''
        });
    } else {
        existing.count += 1;
        existing.lastCallId = entry.callId;
    }
    pass.counters.gapped += 1;
}

// Write out pending gaps. Called when a session's next call is judged (so a
// range stays contiguous), when that session's gap reason changes, and at the
// end of every pass. Committing the offsets those gaps were holding is the last
// thing it does.
//
// The two writes are INDEPENDENT. They are two files with two failure modes, and
// a session log that could not be written is no reason for the audit surface to
// lose the gap as well; each is attempted, counted and reported on its own. A
// gap that could not be written at all is still dropped from the map, because a
// daemon that held its offset until a failing disk recovered would stop
// consuming altogether, and that failure is already loud and counted.
function flushGaps(ctx, pass, sessionId) {
    for (const [key, gap] of Array.from(pass.gaps.entries())) {
        if (sessionId !== undefined && gap.sessionId !== sessionId) continue;
        const record = logs.gapRecord(gap, ctx.deps.now());
        const inSessionLog = logs.appendJsonLine(logs.sessionLogFile(ctx.paths.logsDir, gap.sessionId), record);
        const inFindings = logs.appendJsonLine(ctx.paths.findingsFile, record);
        if (!inSessionLog) {
            ctx.state.counters.writeFailures += 1;
            ctx.deps.report(`could not record a gap of ${gap.count} call(s) in the session log: ${gap.reason}`);
        }
        if (!inFindings) {
            ctx.state.counters.writeFailures += 1;
            ctx.deps.report(`could not record a gap of ${gap.count} call(s) in the findings file: ${gap.reason}`);
        }
        if (inSessionLog && inFindings) ctx.deps.report(record.note);
        pass.gaps.delete(key);
    }
    commitPending(ctx, pass);
}

// One judgment under the pass's resilience policy. The latches are read first,
// so an endpoint already known to be gone in this pass costs no request at all.
async function judgeWithPolicy(ctx, entry) {
    const rt = ctx.runtime;
    if (rt.endpointDown) return { status: 'unreachable', detail: 'endpoint already down in this pass', latencyMs: 0 };
    if (rt.laneBusy) return { status: 'timeout', detail: 'lane already timing out in this pass', latencyMs: 0 };
    if (rt.refusing) return { status: 'refused', detail: 'endpoint already refusing in this pass', latencyMs: 0 };
    if (rt.unusable) return { status: 'unusable', detail: 'endpoint already returning unusable verdicts in this pass', latencyMs: 0 };

    let outcome = await judge.judgeOnce(entry, ctx.config, ctx.deps);

    // The one retry, and only the one. A connection failure AFTER a healthy
    // period is the shape an endpoint restart makes, so it earns a single wait
    // of the reload window and a second attempt. A connection failure with no
    // healthy period behind it is an endpoint that was never there, and waiting
    // seven seconds per entry to re-learn that is the retry storm the design
    // forbids.
    if (outcome.status === 'unreachable' && rt.healthy) {
        ctx.deps.report(`endpoint unreachable (${outcome.detail}); waiting ${RELOAD_WINDOW_MS} ms for a runner restart and retrying once`);
        rt.healthy = false;
        await ctx.deps.sleep(RELOAD_WINDOW_MS);
        outcome = await judge.judgeOnce(entry, ctx.config, ctx.deps);
    }

    if (outcome.status === 'ok') {
        rt.healthy = true;
        rt.timeouts = 0;
        rt.refusals = 0;
        rt.unusables = 0;
        return outcome;
    }
    if (outcome.status === 'unreachable') {
        rt.healthy = false;
        rt.endpointDown = true;
        rt.timeouts = 0;
        rt.refusals = 0;
        rt.unusables = 0;
        ctx.deps.report(`endpoint down (${outcome.detail}); the rest of this pass is gap-marked without further calls`);
        return outcome;
    }
    // Each counter says "consecutive", so a failure of a different kind ends the
    // run it was counting. Left uncleared, a lane alternating timeouts with
    // refusals would latch a counter that never saw three of anything in a row.
    if (outcome.status === 'timeout') {
        rt.refusals = 0;
        rt.unusables = 0;
        rt.timeouts += 1;
        if (rt.timeouts >= MAX_CONSECUTIVE_FAILURES) {
            rt.laneBusy = true;
            ctx.deps.report(`${rt.timeouts} calls in a row timed out; the lane is busy, so this pass stops here and the calls behind it are re-attempted on the next pass`);
        }
        return outcome;
    }
    if (outcome.status === 'unusable') {
        // The endpoint answered, and the answer was not a verdict. It gets its
        // own latch and its own gap reason rather than sharing the refusal's:
        // "the endpoint refused the call" names a server saying no, and a reader
        // told that when the truth is a model returning something that is not a
        // verdict is being pointed at the wrong repair.
        rt.timeouts = 0;
        rt.refusals = 0;
        rt.unusables += 1;
        if (rt.unusables >= MAX_CONSECUTIVE_FAILURES) {
            rt.unusable = true;
            ctx.deps.report(`${rt.unusables} answers in a row were not usable verdicts (${outcome.detail}); the rest of this pass is gap-marked without further calls`);
        }
        return outcome;
    }
    rt.timeouts = 0;
    rt.unusables = 0;
    rt.refusals += 1;
    if (rt.refusals >= MAX_CONSECUTIVE_FAILURES) {
        rt.refusing = true;
        ctx.deps.report(`${rt.refusals} calls in a row were refused (${outcome.detail}); the rest of this pass is gap-marked without further calls`);
    }
    return outcome;
}

// Queue one diverged verdict for delivery back to the session that produced it.
//
// The item goes down before the offset that consumed this entry advances, which
// is the same ordering the verdict and the finding take and the same reason: an
// offset that passed a call whose record had not reached disk would leave a
// kill with a call the daemon never speaks about and never reads again.
//
// The item's kind and call id together are marked delivered in the state, so a
// spool file re-read from zero (rotated or truncated outside this daemon, which
// the contract names as an expected event) judges the call again without
// queueing a second identical pointer, while leaving room for the one item of
// each other kind the same call may earn. Marking follows the write rather than
// preceding it, because a mark that landed on a write that did not would
// silence the call for good; the reverse order costs at worst a duplicate
// pointer after a kill in between.
//
// A failed write is counted and reported, never thrown: the findings file
// already holds the divergence, so what is lost is the reminder and not the
// record. An inbox directory an operator has deleted is one of those failures
// by design, since recreating it here would re-arm in-band delivery behind the
// operator's own off switch.
function deliverAlert(ctx, entry, record) {
    const item = inbox.alertItem(record, ctx.deps.now());
    if (inbox.alreadyDelivered(ctx.state, item)) return;
    if (!inbox.writeItem(ctx.paths.inboxDir, item)) {
        ctx.state.counters.writeFailures += 1;
        ctx.deps.report(`could not queue the delivery item for call ${entry.callId}`);
        return;
    }
    inbox.markDelivered(ctx.state, item);
}

// Judge one entry and write what came of it. Returns nothing the caller branches
// on: a gap is as complete an outcome as a verdict.
async function processEntry(ctx, pass, entry) {
    const outcome = await judgeWithPolicy(ctx, entry);
    if (outcome.status !== 'ok') {
        accrueGap(ctx, pass, entry, outcome);
        return;
    }

    flushGaps(ctx, pass, entry.sessionId);
    const record = logs.verdictRecord(entry, outcome, {
        nowMs: ctx.deps.now(),
        promptId: prompt.PROMPT_ID,
        model: ctx.config.model,
        endpoint: ctx.config.endpointFingerprint
    });
    if (!logs.appendJsonLine(logs.sessionLogFile(ctx.paths.logsDir, entry.sessionId), record)) {
        ctx.state.counters.writeFailures += 1;
        ctx.deps.report(`could not write the verdict for call ${entry.callId}`);
    }
    if (record.verdict === 'diverged') {
        if (!logs.appendJsonLine(ctx.paths.findingsFile, logs.findingRecord(record))) {
            ctx.state.counters.writeFailures += 1;
            ctx.deps.report(`could not write the finding for call ${entry.callId}`);
        }
        deliverAlert(ctx, entry, record);
    }
    pass.counters.judged += 1;
    pass.verdicts[record.verdict] = (pass.verdicts[record.verdict] || 0) + 1;
}

// One line: parsed, judged if it is a call, counted if it is not. A skip is
// counted in the category that explains it, because a rising torn-write count
// and a rising unrecognized-version count call for different repairs.
async function processLine(ctx, pass, raw, fileName) {
    const parsed = spool.parseLine(raw);
    if (!parsed.ok) {
        if (parsed.why === 'blank') { pass.counters.blank += 1; return; }
        if (parsed.why === 'version') {
            pass.counters.unknownVersion += 1;
            ctx.deps.report(`skipped a line in ${fileName} with an unrecognized schema version (${parsed.detail})`);
            return;
        }
        pass.counters.malformed += 1;
        ctx.deps.report(`skipped a malformed line in ${fileName}: ${parsed.detail}`);
        return;
    }
    pass.counters.parsed += 1;
    await processEntry(ctx, pass, parsed.entry);
}

// Fold what this pass has counted so far into the persisted counters, without
// double-counting what a previous fold already took. Called on the same beat as
// the offset, because the counters and the offset describe the same consumed
// bytes: a kill between them leaves a state file whose offset says fifty lines
// were read and whose counters say nothing was, and the contract names a rising
// malformed count as the only signal that the interleave mitigation has stopped
// working.
function mergePassCounters(ctx, pass) {
    for (const key of Object.keys(pass.counters)) {
        if (!Object.prototype.hasOwnProperty.call(ctx.state.counters, key)) continue;
        const delta = pass.counters[key] - pass.merged[key];
        if (delta === 0) continue;
        ctx.state.counters[key] += delta;
        pass.merged[key] = pass.counters[key];
    }
}

// Advance one file's persisted offset and write the state out. Called after
// every entry rather than once per file: the acceptance this daemon is built to
// is that a kill and a restart resume without re-judging, and an offset that
// only lands at the end of a pass re-judges everything a kill interrupted.
function commitOffset(ctx, pass, fileName, offset) {
    ctx.state.offsets[fileName] = offset;
    mergePassCounters(ctx, pass);
    if (!logs.saveState(ctx.paths.stateFile, ctx.state)) {
        ctx.state.counters.writeFailures += 1;
        ctx.deps.report(`could not persist the offset for ${fileName}; calls may be judged twice after a restart`);
    }
}

// Commit the offsets that were waiting on a gap record.
//
// An offset may only pass a line whose outcome is already on disk. A judged call
// writes its verdict before the offset moves, but a gapped call's record lives
// in memory until the run it belongs to is flushed, so its offset waits here in
// the meantime. Without the wait, a kill during an outage (a crash, a SIGKILL, a
// second interrupt taking the fast exit) leaves every call in that stretch with
// no verdict AND no gap, and the daemon resumes past them: the findings file
// then shows nothing happened, which is the one thing this instrument exists to
// make impossible.
//
// Holding is per pass rather than per file because a gap can span files: while
// any run is open, nothing advances anywhere.
function commitPending(ctx, pass) {
    if (pass.gaps.size > 0) return;
    for (const [fileName, offset] of pass.pendingOffsets) {
        commitOffset(ctx, pass, fileName, offset);
    }
    pass.pendingOffsets.clear();
}

async function drainFile(ctx, pass, fileName) {
    const file = path.join(ctx.paths.spoolDir, fileName);
    for (let chunk = 0; chunk < MAX_CHUNKS_PER_FILE; chunk += 1) {
        if (ctx.stopping) return;
        // Where to read from is the held offset when one is waiting on a gap
        // record, and the persisted one otherwise. Reading from the persisted
        // offset while a later one is held would re-read the lines in between.
        const recorded = pass.pendingOffsets.has(fileName)
            ? pass.pendingOffsets.get(fileName)
            : (Object.prototype.hasOwnProperty.call(ctx.state.offsets, fileName) ? ctx.state.offsets[fileName] : 0);
        const read = spool.readFrom(file, recorded, ctx.options.maxReadBytes);

        if (read.reset) {
            pass.counters.offsetResets += 1;
            ctx.deps.report(`${fileName} is shorter than its recorded offset (rotated or truncated outside this daemon); reading it from the start`);
            // A reset moves the offset backwards, so it passes nothing and waits
            // on nothing. Any held offset for this file described bytes that no
            // longer exist.
            pass.pendingOffsets.delete(fileName);
            commitOffset(ctx, pass, fileName, 0);
        }
        if (read.status !== 'ok') {
            if (read.status !== 'missing' && !ctx.reportedUnreadable.has(fileName)) {
                ctx.reportedUnreadable.add(fileName);
                ctx.deps.report(`skipping ${fileName}: ${read.status}${read.detail ? ` (${read.detail})` : ''}; further passes over this file stay silent until it reads again`);
            }
            return;
        }
        ctx.reportedUnreadable.delete(fileName);
        if (read.oversized) {
            pass.counters.oversized += 1;
            ctx.deps.report(`skipped ${read.nextOffset - read.startOffset} bytes of ${fileName} holding no complete line; the spool contract caps a line at 8192 bytes, so those bytes are not from the capture hook`);
        }
        if (read.lines.length === 0) {
            // Either a partial line is in flight, in which case nextOffset is
            // where it started and nothing moves, or an oversized run was
            // stepped over.
            if (read.nextOffset !== recorded) {
                pass.pendingOffsets.set(fileName, read.nextOffset);
                commitPending(ctx, pass);
            }
            return;
        }

        for (let i = 0; i < read.lines.length; i += 1) {
            // The end position comes from the read, measured on the bytes. It is
            // never recomputed from the decoded line: a torn write splits at an
            // arbitrary byte, and a line holding half a multi-byte character
            // decodes to replacement characters that re-encode to a different
            // length.
            await processLine(ctx, pass, read.lines[i], fileName);
            pass.pendingOffsets.set(fileName, read.lineEnds[i]);
            commitPending(ctx, pass);
            if (ctx.stopping) return;
            if (ctx.runtime.laneBusy) {
                // A busy lane is somebody else's generation queued ahead of this
                // one, which clears in minutes. The calls already attempted keep
                // their gap records, and the pass stops here so the backlog
                // behind them is re-attempted rather than consumed unjudged. The
                // endpoint-down and refusal latches keep consuming instead: a
                // dead or refusing endpoint is a recorded cannot-measure, and
                // holding for one would leave the whole stretch unrecorded until
                // retention deleted the spool out from under it.
                pass.laneHeld = true;
                return;
            }
        }
    }
    ctx.deps.report(`${fileName} still has unread lines after ${MAX_CHUNKS_PER_FILE} chunks; continuing on the next pass`);
}

// One pass over every day file in chronological order.
function newPass() {
    const counters = { parsed: 0, judged: 0, blank: 0, malformed: 0, unknownVersion: 0, oversized: 0, offsetResets: 0, gapped: 0 };
    return {
        gaps: new Map(),
        // Offsets consumed but not yet safe to persist: see commitPending.
        pendingOffsets: new Map(),
        // Whether the pass stopped short because the lane was busy.
        laneHeld: false,
        verdicts: {},
        counters,
        // What has already been folded into the persisted counters.
        merged: { ...counters }
    };
}

async function drainOnce(ctx) {
    const pass = newPass();
    ctx.runtime.endpointDown = false;
    ctx.runtime.laneBusy = false;
    ctx.runtime.refusing = false;
    ctx.runtime.unusable = false;
    ctx.runtime.timeouts = 0;
    ctx.runtime.refusals = 0;
    ctx.runtime.unusables = 0;

    const scan = spool.scanDayFiles(ctx.paths.spoolDir);
    if (!scan.complete) {
        // Dropping an offset re-judges up to a fortnight of spool, so it is only
        // done against a listing known to be the whole truth. A directory that
        // could not be read is an unknown, never an empty one.
        ctx.deps.report(`the spool listing is incomplete (${scan.detail}), so no offset entry is dropped this pass`);
    } else {
        const dropped = spool.dropVanishedOffsets(ctx.state.offsets, scan.names, { spoolDir: ctx.paths.spoolDir });
        if (dropped.length > 0) {
            ctx.deps.report(`dropped offset entries for ${dropped.length} spool file(s) no longer present: ${dropped.join(', ')}`);
        }
    }

    for (const name of scan.names) {
        if (ctx.stopping) break;
        await drainFile(ctx, pass, name);
        if (pass.laneHeld) break;
    }
    flushGaps(ctx, pass);

    mergePassCounters(ctx, pass);
    logs.saveState(ctx.paths.stateFile, ctx.state);
    return pass;
}

// A one-line summary of a pass, or null when nothing happened. Silence in an
// idle watch loop is correct; silence after work is not.
function passSummary(pass) {
    const c = pass.counters;
    const total = c.parsed + c.malformed + c.unknownVersion + c.oversized + c.offsetResets;
    if (total === 0) return null;
    const verdicts = Object.entries(pass.verdicts).map(([k, v]) => `${k} ${v}`).join(', ');
    const parts = [`judged ${c.judged}`];
    if (verdicts !== '') parts.push(`(${verdicts})`);
    if (c.gapped > 0) parts.push(`not judged ${c.gapped}`);
    if (c.malformed > 0) parts.push(`malformed ${c.malformed}`);
    if (c.unknownVersion > 0) parts.push(`unknown version ${c.unknownVersion}`);
    if (c.oversized > 0) parts.push(`oversized ${c.oversized}`);
    if (c.offsetResets > 0) parts.push(`offset resets ${c.offsetResets}`);
    return parts.join(', ');
}

// Start up and drain once. Exported for the suite and for a replay run, which
// is the same path `--once` takes.
async function runOnce(options, deps) {
    const ctx = makeContext(options, deps);
    const started = startup(ctx);
    if (!started.ok) return { ok: false, ctx, startup: started };
    const pass = await drainOnce(ctx);
    return { ok: true, ctx, pass, startup: started };
}

async function watch(ctx) {
    while (!ctx.stopping) {
        // Retention on every day boundary the loop crosses, not on startup
        // alone. Watch is the default mode and the process is meant to be left
        // running, so a window that only applied at startup would stop applying
        // the longer this daemon lived.
        if (ctx.retentionDay !== spool.utcDay(ctx.deps.now())) runRetention(ctx);

        const pass = await drainOnce(ctx);
        const summary = passSummary(pass);
        if (summary !== null) ctx.deps.report(summary);
        if (ctx.stopping) break;
        // Idle only when the pass found nothing at all, or when it stopped short
        // on a busy lane. A pass that read something goes straight round again,
        // so a backlog drains at the endpoint's pace rather than at the poll
        // interval's; a pass holding its offset behind somebody else's
        // generation waits, because going straight round would re-attempt the
        // same calls as fast as they can time out.
        if (summary === null || pass.laneHeld) await ctx.deps.sleep(ctx.options.pollMs);
    }
}

async function main(argv) {
    const parsed = parseArgs(argv);
    if (!parsed.ok) {
        process.stderr.write(`kit-sidecar: ${parsed.error}\n\n${USAGE}\n`);
        return 2;
    }
    if (parsed.options.help) {
        process.stdout.write(`${USAGE}\n`);
        return 0;
    }

    const ctx = makeContext(parsed.options, null);
    const started = startup(ctx);
    if (!started.ok) {
        if (started.standDown) {
            // No endpoint on this machine. Standing down is the designed
            // behavior, not a fault, and nothing was created: capture stays off
            // where nothing could ever consume it.
            ctx.deps.report(`no endpoint config at ${started.path}, so there is no endpoint on this machine; standing down without creating anything`);
            return 0;
        }
        ctx.deps.report(`cannot start: ${started.reason}${started.detail ? ` (${started.detail})` : ''}`);
        return 1;
    }

    ctx.deps.report(`state root ${ctx.paths.root}; model ${ctx.config.model}; endpoint ${ctx.config.endpointFingerprint}; timeout ${ctx.config.timeoutMs} ms; prompt ${prompt.PROMPT_ID}`);

    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => {
            if (ctx.stopping) process.exit(130);
            ctx.stopping = true;
            ctx.deps.report(`${signal} received; finishing the call in flight and stopping`);
        });
    }

    if (parsed.options.once) {
        const pass = await drainOnce(ctx);
        const summary = passSummary(pass);
        process.stdout.write(`${summary === null ? 'nothing to judge' : summary}\nlogs: ${ctx.paths.logsDir}\n`);
        return 0;
    }
    await watch(ctx);
    return 0;
}

if (require.main === module) {
    main(process.argv.slice(2)).then((code) => {
        process.exitCode = code;
    }).catch((err) => {
        // The loop handles its own failures, so reaching here means a defect in
        // the daemon rather than a fault of the spool or the endpoint. It is
        // still reported as one line rather than a stack, and the exit code is
        // what a supervisor reads.
        process.stderr.write(`kit-sidecar: stopped on an unhandled error: ${(err && err.message) ? err.message : String(err)}\n`);
        process.exitCode = 1;
    });
}

module.exports = {
    DEFAULT_POLL_MS,
    RELOAD_WINDOW_MS,
    MAX_CONSECUTIVE_FAILURES,
    MAX_CHUNKS_PER_FILE,
    USAGE,
    parseArgs,
    makeContext,
    startup,
    runRetention,
    drainOnce,
    runOnce,
    watch,
    passSummary,
    main
};
