#!/usr/bin/env node
// PreToolUse grant: under the engine's write-gated spawn vector, Bash refuses
// `node <script>` even for the kit's own memq CLI, so a fleet worker on that
// vector loses memory recall and outcome logging. This hook emits an allow
// decision for exactly one command shape and stays silent on everything else.
//
// The grant requires ALL of:
//   - The fleet-store signals: KIT_MEMORY_ROOT set and
//     KIT_MEMORY_ROOT_ALLOW_DATA === '1'. The check is memq's own exported
//     storeSignalsPresent(), required from the scripts/ directory beside this
//     hook, so the hook and the CLI cannot drift apart on what a fleet store
//     is. memq.js dispatches only under require.main, so the load runs no CLI
//     code, and a load failure means no grant (granting an invocation of a
//     script that cannot load serves nobody).
//   - The tool is Bash and the command is one `node` invocation whose first
//     argument is an absolute spelling that resolves, by normalized path
//     equality, to this plugin's own scripts/memq.js. The target is anchored
//     to the hook's on-disk location (__dirname), never to an environment
//     variable, so no inherited setting can point the grant at another tree.
//     Path equality, never a pattern: a lookalike path, a traversal landing
//     elsewhere, a same-named script under another root, and a symlink
//     spelled from another path all fail it. Relative spellings are refused
//     outright: the Bash tool's shell keeps a working directory across calls
//     that nothing pins to the payload cwd, so a relative target cannot be
//     positively resolved. On Windows a target must carry a drive-letter
//     root; a rootless slash path resolves against this process's current
//     drive while Git-Bash maps it under its own installation root, two
//     different files, so it cannot be positively resolved either.
//   - The interpreter is positively identified, not accepted by name. The
//     word `node` resolves through PATH in the child's shell, and this hook
//     inherits the same environment that child would get, so it walks that
//     PATH itself and grants only when the first `node` candidate it finds is
//     this very interpreter (realpath equality with process.execPath; on
//     Windows the wrapper spellings node.cmd/.bat/.com/.ps1 and an
//     extensionless `node` are candidates too, and none of them can equal the
//     real binary, so a planted wrapper anywhere ahead of it refuses). The
//     module-preload environment variables are refused outright whenever they
//     are set at all, because node honors them in the granted child:
//     NODE_OPTIONS (carries --require/--import), NODE_PATH (steers module
//     resolution), NODE_REPL_EXTERNAL_MODULE (a preloaded module).
//   - The whole command line is free of shell metacharacters: ; & | < > ` $
//     ( ) newline and carriage return are refused anywhere, quoted spans
//     included. The scan deliberately does not parse quoting to be lenient
//     inside it; quote parity is shell-dependent (the memq.cmd %* expansion
//     is the recorded example), so bluntness is the design. Word separators
//     are space and tab only, and every other whitespace character (NBSP,
//     VT, FF, the Unicode separators) is refused anywhere, because bash does
//     not split on them and a splitter that did would judge different words
//     than the shell builds. Refused for the same words-must-match reason: a
//     backslash immediately before a quote, a backslash outside a quoted
//     span (bash consumes it), and an unquoted word starting with # (bash
//     drops the rest of the line as a comment).
//
// Threat model: the expensive failure is a silent over-grant, a command this
// hook allows that runs anything other than this plugin's memq.js under this
// plugin's own interpreter. The metacharacter ban removes chaining,
// substitution, and redirection; the path equality removes substitute
// scripts; the interpreter pin removes a PATH-planted node, while node -e,
// npx, node.exe, and interpreters at other paths are refused as spellings
// before the pin is even consulted; the preload-variable refusal removes
// code injected into a genuine invocation through the environment. Arguments
// after the script path are ungoverned by intent: node passes everything
// past the script to the script, so they are memq's argv, and memq validates
// its own input.
//
// SAFETY: this hook only GRANTS; it never denies and never exits 2. On any
// input outside the one shape, any parse failure, unreadable payload,
// unresolvable path or interpreter, or exception, it emits no decision and
// exits 0, which falls through to the engine's normal permission flow. For a
// grant hook, silence is the safe failure: the opposite direction from the
// kit's deny guards, whose fail-open is allowing.

'use strict';

const fs = require('fs');
const path = require('path');

function readStdin() {
    try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

// The one target this hook can ever grant.
const MEMQ = path.join(__dirname, '..', 'scripts', 'memq.js');

// Banned anywhere in the command line, inside quotes or out.
const METACHARACTERS = /[;&|<>`$()\r\n]/;

// Any whitespace character that is not a plain space or tab, anywhere: bash
// does not split words on these, so the splitter below must never see one.
const ODD_WHITESPACE = /[^\S \t]/;

// A backslash immediately before a quote, anywhere: the shell and the word
// splitter below would read the quote differently.
const ESCAPED_QUOTE = /\\["']/;

// Environment variables that make node load or resolve code the command line
// never names. The granted child inherits this hook's environment, so any of
// them being set at all refuses the grant.
const PRELOAD_ENV = ['NODE_OPTIONS', 'NODE_PATH', 'NODE_REPL_EXTERNAL_MODULE'];

// Shell words of a metacharacter-clean command: space and tab split, a quoted
// span joins onto the current word the way the shell joins it ("a"b is one
// word ab). Null for the spellings where this splitter and the shell diverge:
// an unterminated quote, a backslash outside a quoted span, and an unquoted
// word starting with # (a comment to bash, words to this splitter).
function words(cmd) {
    const out = [];
    let cur = null;
    for (let i = 0; i < cmd.length; i++) {
        const c = cmd[i];
        if (c === '"' || c === "'") {
            const close = cmd.indexOf(c, i + 1);
            if (close < 0) return null;
            cur = (cur === null ? '' : cur) + cmd.slice(i + 1, close);
            i = close;
            continue;
        }
        if (c === '\\') return null;
        if (c === '#' && cur === null) return null;
        if (c === ' ' || c === '\t') {
            if (cur !== null) { out.push(cur); cur = null; }
            continue;
        }
        cur = (cur === null ? '' : cur) + c;
    }
    if (cur !== null) out.push(cur);
    return out;
}

// Normalized path equality. path.relative applies the platform's own case
// rule, so on Windows a different-case spelling of the same file is equal
// (refusing it would break the grant, not narrow it) while on a
// case-sensitive filesystem it is not.
function samePath(a, b) {
    return path.relative(a, b) === '';
}

// The Git-Bash spelling of an absolute path (/d/rest) becomes d:/rest on a
// Windows host: it is what pwd prints inside the Bash tool, an ordinary
// spelling of the same file with no evasive intent.
function driveSpelling(s) {
    if (path.sep === '\\' && /^\/[A-Za-z]\//.test(s)) return s[1] + ':' + s.slice(2);
    return s;
}

// Candidate filenames PATH could offer the child's shell as `node`, in the
// order a wrapper would preempt the binary. None of the wrapper spellings can
// realpath-equal the real binary, so one anywhere ahead of it refuses.
const NODE_CANDIDATES = path.sep === '\\'
    ? ['node', 'node.cmd', 'node.bat', 'node.com', 'node.ps1', 'node.exe']
    : ['node'];

// True when the first `node` candidate on PATH is this very interpreter
// (realpath equality with process.execPath). An empty PATH, a realpath
// failure at the winning candidate, or no candidate at all refuses: an
// interpreter this hook cannot positively identify is not one it grants.
function interpreterIsSelf() {
    const pathVar = process.env.PATH;
    if (!pathVar) return false;
    for (const dir of pathVar.split(path.delimiter)) {
        if (!dir) continue;
        for (const name of NODE_CANDIDATES) {
            const candidate = path.join(dir, name);
            let isFile = false;
            try { isFile = fs.statSync(candidate).isFile(); } catch { /* not here */ }
            if (!isFile) continue;
            try {
                return samePath(fs.realpathSync(candidate), fs.realpathSync(process.execPath));
            } catch {
                return false;
            }
        }
    }
    return false;
}

function grantable(p) {
    if (p.tool_name !== 'Bash') return false;

    const input = p.tool_input || {};
    const cmd = input.command;
    if (typeof cmd !== 'string' || !cmd.trim()) return false;
    if (METACHARACTERS.test(cmd) || ODD_WHITESPACE.test(cmd) || ESCAPED_QUOTE.test(cmd)) return false;

    // Cheap pre-screen before the module load: half the signal pair, so it can
    // only refuse what storeSignalsPresent() would refuse. An attended session
    // (no KIT_MEMORY_ROOT) never pays for loading memq on every Bash call.
    if (!process.env.KIT_MEMORY_ROOT) return false;
    try {
        if (!require(MEMQ).storeSignalsPresent()) return false;
    } catch {
        return false;
    }

    for (const name of PRELOAD_ENV) {
        if (process.env[name] !== undefined) return false;
    }

    const w = words(cmd);
    if (w === null || w.length < 2 || w[0] !== 'node') return false;

    const target = driveSpelling(w[1]);
    // On Windows only a drive-letter-rooted spelling is positively
    // resolvable: a rootless or drive-relative one means different files to
    // this process and to the child's shell. Elsewhere, absolute or nothing.
    if (path.sep === '\\') {
        if (!/^[A-Za-z]:[\\/]/.test(target)) return false;
    } else if (!path.isAbsolute(target)) {
        return false;
    }
    if (!samePath(path.resolve(target), MEMQ)) return false;

    // Last, because it stats the filesystem: only a command that already
    // matches everything else pays for the PATH walk.
    return interpreterIsSelf();
}

function main() {
    let p;
    try { p = JSON.parse(readStdin() || '{}'); } catch { return; } // no decision
    if (!grantable(p)) return;                                     // no decision
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'allow',
            permissionDecisionReason: 'kit memq CLI: one node invocation of this plugin\'s own '
                + 'scripts/memq.js, metacharacter-free, under the gated fleet memory store'
        }
    }) + '\n');
}

try { main(); } catch { /* any failure: no decision */ }
// Zero without process.exit(): the grant is a single stdout write the engine
// depends on (a truncated write reads as no decision and the worker loses
// memq), and forcing the exit can discard a write still in flight on a pipe.
// Nothing above sets a nonzero code, and main() is wrapped, so the process
// ends at 0 once stdout has drained.
process.exitCode = 0;
