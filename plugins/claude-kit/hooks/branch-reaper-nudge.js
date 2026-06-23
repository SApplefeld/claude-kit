#!/usr/bin/env node
// SessionStart hook: branch-hygiene auto-reap trigger.
//
// At session start, refresh the merge state and, if any local branches have
// merged into the integration branch (origin/develop, else origin/main/master),
// emit an instruction to run the branch-hygiene skill now, so the workspace is
// cleaned before the next branch is picked. The hook NEVER deletes anything: it
// detects and hands off to the tested skill, which removes only verified-merged
// branches and their clean worktrees and reports the rest.
//
// Fail-open and non-blocking: a bounded fetch with auth prompts disabled and a
// short timeout, skipped when the repo was fetched recently; any error exits 0
// with no output. Kept separate from session-start.js so the resume hook is
// untouched.

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FETCH_SKIP_MS = 10 * 60 * 1000; // skip the fetch if fetched within 10 minutes

function readStdin() {
    try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function git(cwd, args) {
    return execSync('git ' + args, {
        cwd,
        timeout: 4000,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8'
    });
}

function refExists(cwd, ref) {
    try { git(cwd, `rev-parse --verify --quiet ${ref}`); return true; } catch { return false; }
}

// Refresh remote-tracking refs, unless fetched recently. Bounded, auth-safe, and
// fail-open: a failure or timeout just leaves the cached refs in place.
function maybeFetch(cwd) {
    try {
        const fh = git(cwd, 'rev-parse --git-path FETCH_HEAD').trim();
        const full = path.isAbsolute(fh) ? fh : path.join(cwd, fh);
        if ((Date.now() - fs.statSync(full).mtimeMs) < FETCH_SKIP_MS) return; // recent: skip
    } catch { /* no FETCH_HEAD yet: fall through and fetch */ }
    try {
        execSync('git fetch --prune', {
            cwd,
            timeout: 6000,
            stdio: ['ignore', 'ignore', 'ignore'],
            env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0' })
        });
    } catch { /* offline, slow, or no remote: proceed on cached refs */ }
}

function main() {
    let p = {};
    try { p = JSON.parse(readStdin() || '{}'); } catch { return; }
    const cwd = p.cwd || process.cwd();

    maybeFetch(cwd);

    // Integration ref: develop preferred, then main, then master.
    let integ = null;
    for (const r of ['refs/remotes/origin/develop', 'refs/remotes/origin/main', 'refs/remotes/origin/master']) {
        if (refExists(cwd, r)) { integ = r.replace('refs/remotes/', ''); break; }
    }
    if (!integ) return; // no integration ref / not a repo: silent

    const protectedNames = new Set(['develop', 'main', 'master']);
    try { protectedNames.add(git(cwd, 'rev-parse --abbrev-ref HEAD').trim()); } catch { /* ignore */ }

    let count = 0;
    try {
        count = git(cwd, `branch --merged ${integ}`)
            .split('\n')
            .map((l) => l.replace('*', '').trim())
            .filter(Boolean)
            .filter((b) => !protectedNames.has(b))
            .length;
    } catch { return; }

    if (count === 0) return;

    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: `Branch hygiene: ${count} local branch(es) merged into ${integ} are reapable. Before starting this session's work, run the branch-hygiene skill to sweep them and their worktrees. It removes only verified-merged branches and clean worktrees under .claude/worktrees/, protects the current branch, and reports anything unmerged or dirty with restore commands. Refs were just refreshed, so the skill's own fetch is a fast no-op.`
        }
    }));
}

try { main(); } catch { /* never break a session over a hook */ }
process.exit(0);
