#!/usr/bin/env node
// PreToolUse guard: keep non-curator subagents from writing into docs/.
//
// The kit's access model: only the main session and the docs-curator agent
// curate docs/. Reviewers, qa, and implementers must not write there; their
// reports and scratch belong in .kit/ (gitignored), and the durable record is
// the plan's Chapter. This enforces that invariant mechanically, as the teeth
// under the executing-work routing wording.
//
// Plugin PreToolUse hooks fire for tool calls made inside subagents, and the
// payload carries the subagent identity, so the guard keys on the writer's role
// rather than on report filenames (the orchestrator improvised several docs/
// paths; a role rule does not chase them).
//
// Covers Write/Edit/MultiEdit (exact, by file_path) and Bash (heuristic, by a
// write-redirect into docs/ in the command). Exotic shell writes (python,
// sed -i) are out of reach here and are caught by the Stop-scan backstop.
//
// SAFETY: this hook can BLOCK a tool call, so it fails OPEN. Any parse error,
// unrecognized payload, or inability to positively identify a non-curator
// subagent exits 0 (allow). It exits 2 (deny) only when certain. A guard bug
// must never trap legitimate work.

'use strict';

const fs = require('fs');

function readStdin() {
    try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

// The subagent's type, or null for a main-session call or any case we cannot
// positively identify (null means allow: the safe direction for a blocker).
function subagentType(p) {
    const cand = p.agent_type || p.agentType || p.subagent_type || p.subagentType;
    return (typeof cand === 'string' && cand.trim().length) ? cand.trim() : null;
}

// docs-curator is the one subagent allowed to curate docs/. Match by suffix so a
// plugin-namespaced id (e.g. "claude-kit:docs-curator") still resolves.
function isCurator(t) {
    return /(^|[:/])docs-curator$/i.test(t);
}

// A filesystem path that points inside a docs/ directory. Absolute or relative,
// Windows or POSIX separators. "mydocs/" does not match (separator required).
function targetsDocs(s) {
    return /(^|[\\/])docs[\\/]/i.test(String(s || ''));
}

// A shell command that redirects or tees output into a docs/ path. Heuristic:
// covers >, >>, tee, and heredocs (cat > docs/x <<EOF); misses python/sed -i.
function bashWritesDocs(cmd) {
    return /(?:>>?|tee(?:\s+-a)?\s)\s*["']?(?:[^\s"'|;&><]*[\\/])?docs[\\/]/i.test(String(cmd || ''));
}

function main() {
    let p = {};
    try { p = JSON.parse(readStdin() || '{}'); } catch { return; } // parse fail: allow

    const t = subagentType(p);
    if (!t) return;            // main session or undetermined: allow
    if (isCurator(t)) return;  // docs-curator curates docs/: allow

    const input = p.tool_input || p.toolInput || (p.tool && p.tool.input) || {};
    const fp = input.file_path || input.path;

    let hit = false;
    if (fp) hit = targetsDocs(fp);
    if (!hit && input.command) hit = bashWritesDocs(input.command);
    if (!hit) return;          // not a docs/ write: allow

    process.stderr.write(
        `Blocked: the ${t} subagent may not write into docs/. docs/ holds curated content only ` +
        `(plans and the docs-curator's docs). A report or scratch file goes to .kit/ (gitignored), ` +
        `and the durable record is the plan's Chapter. Write to .kit/ instead, or return the content ` +
        `in your final message.\n`
    );
    process.exit(2);           // deny
}

try { main(); } catch { /* fail open */ }
process.exit(0);
