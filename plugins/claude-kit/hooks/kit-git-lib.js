// Shared git runner for the kit's hooks. Every git invocation a hook makes runs
// through here, so the two properties that make a naive spawn unsafe are closed
// in one place instead of at each call site.
//
// The spawn's working directory is this file's own directory, never the
// repository being asked about. On Windows a bare command name is resolved
// against the spawn's working directory BEFORE the system PATH, unless the
// spawning process carries NoDefaultCurrentDirectoryInExePath, which a session
// launched from a shortcut, from PowerShell, or from Windows Terminal does not.
// An MSYS2 shell such as Git Bash does set it, which is why a probe run from one
// comes back clean and the clean reading is the shell rather than the code. A
// repository
// carrying a file named git.exe therefore runs its own binary the moment a hook
// asks that directory a question, and the kit's SessionStart hooks fire
// unattended on startup, resume and compaction in whatever directory the
// session opened, including a clone of this public repo nobody has read. The
// hooks directory closes that route without inventing a new trust assumption:
// anyone able to write there already controls the code being run. An unset
// working directory does not close it, because a hook process's own working
// directory is the project directory.
//
// The child environment carries no GIT_* variable. GIT_DIR, GIT_WORK_TREE and
// GIT_COMMON_DIR make git answer about a repository other than the one named,
// and GIT_CONFIG_GLOBAL and its siblings make it read an attacker-supplied
// config, so an ambient environment (a session started from a repo-carried
// terminal profile) would otherwise decide what a hook reports. The strip is
// wholesale and case-insensitive, since Windows environment keys are not the
// casing a plain-object copy is indexed by, and GIT_TERMINAL_PROMPT is set
// after it so no invocation can block a session on a credential prompt.
//
// The boundary is shared rather than per-caller because an unexported one is
// the fix the next author reimplements by not implementing it: both properties
// belong to the channel every hook's git calls run through, not to the one
// caller that first needed them.
//
// Node core modules only, CommonJS, zero dependencies. Nothing here throws: git
// absent, a spawn error, a nonzero exit, or a run past the timeout all degrade
// to a null or to a status the caller reads, matching kit-goal-lib.js.

'use strict';

const { spawnSync } = require('child_process');

// Bound on one git call when the caller names none. Every caller here blocks
// something a session is waiting on, so a wedged git is a bounded cost rather
// than a hang.
const DEFAULT_TIMEOUT_MS = 4000;

// Ceiling on what one call may return, which is Node's own spawnSync default
// stated rather than inherited: output past it kills the child and the call
// reads as a failure, so no repository can make a hook hold an unbounded
// buffer.
const MAX_OUTPUT_BYTES = 1024 * 1024;

// The environment a git child runs under: this process's environment with every
// GIT_* key removed case-insensitively, plus the terminal-prompt refusal. None
// of the stripped variables is needed, since every call below passes
// `-C <repoDir>` to name the repository it means.
function gitChildEnv() {
    const env = { ...process.env };
    for (const k of Object.keys(env)) {
        if (/^GIT_/i.test(k)) delete env[k];
    }
    env.GIT_TERMINAL_PROMPT = '0';
    // Defence in depth for anything git itself spawns through a shell (an
    // alias, a credential helper): cmd.exe reads this variable from its own
    // environment and then resolves a bare command name against PATH alone.
    // The spawn working directory above is what closes the route for the git
    // call itself; this closes it one level down.
    env.NoDefaultCurrentDirectoryInExePath = '1';
    return env;
}

// Run git against repoDir and return { status, stdout } for a process that ran
// to completion, whatever its exit code, or null when it did not run at all:
// git absent, a spawn error, a kill past the timeout, or arguments that are not
// a string array. The exit code is part of the result because a git exit code
// is an answer to some callers (`merge-base --is-ancestor` spells three
// distinct outcomes as 0, 1 and anything else), and collapsing it would make
// those callers reimplement the spawn to get it back.
//
// args is an array and never a command string: nothing here runs a shell, so no
// value a repository supplies can be read as a command.
function gitRun(repoDir, args, options) {
    if (typeof repoDir !== 'string' || repoDir === '') return null;
    if (!Array.isArray(args)) return null;
    for (const a of args) {
        if (typeof a !== 'string') return null;
    }
    const opts = options || {};
    const timeout = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
    let res;
    try {
        res = spawnSync('git', ['-C', repoDir].concat(args), {
            cwd: __dirname,
            encoding: 'utf8',
            timeout,
            maxBuffer: MAX_OUTPUT_BYTES,
            stdio: ['ignore', 'pipe', 'ignore'],
            windowsHide: true,
            env: gitChildEnv()
        });
    } catch {
        return null;
    }
    if (!res || res.error || res.signal) return null;
    if (typeof res.status !== 'number' || typeof res.stdout !== 'string') return null;
    return { status: res.status, stdout: res.stdout };
}

// The stdout of a git call that succeeded, or null on any failure, which is the
// shape a caller wants when a question git could not answer is simply silence.
function gitOutput(repoDir, args, options) {
    const res = gitRun(repoDir, args, options);
    return res && res.status === 0 ? res.stdout : null;
}

module.exports = { gitRun, gitOutput, gitChildEnv, DEFAULT_TIMEOUT_MS, MAX_OUTPUT_BYTES };
