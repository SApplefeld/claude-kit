// Tests for plugins/claude-kit/hooks/memq-grant.js (the fleet memq grant).
//
// Node's built-in test runner, no framework (Node v24). The hook is spawned as
// a real child process, fed a PreToolUse payload on stdin, and asserted on by
// its stdout: a grant is one JSON allow decision, everything else is empty
// stdout with exit 0 (no decision, fall through to the normal permission
// flow). The hook never denies, so there is no exit-2 direction to pin.
//
// The expensive failure is a silent over-grant, so every hostile probe asserts
// that stdout carries no decision at all, not merely that the process exited 0.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'memq-grant.js');
const PLUGIN_ROOT = path.join(__dirname, '..', 'plugins', 'claude-kit');
const MEMQ = path.join(PLUGIN_ROOT, 'scripts', 'memq.js');
const MEMQ_FWD = MEMQ.split(path.sep).join('/');
const WIN = process.platform === 'win32';

// The PATH key must be found case-insensitively and mutated in place: on
// Windows the real key is usually `Path`, and adding a second `PATH` key to a
// plain-object env hands the child an ambiguous block.
function pathKey(env) {
    return Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
}

// A spread copy of process.env keeps the platform's real PATH key intact; the
// fleet variables are scrubbed so a suite run inside a fleet worker (where the
// parent environment carries them) cannot flip the no-signal cases, and the
// preload variables the hook refuses on are scrubbed so ambient tooling state
// cannot flip the grant cases. The interpreter's own directory is prepended to
// PATH so the hook's interpreter pin resolves `node` to the node running this
// suite on any host.
function baseEnv(extra) {
    const env = { ...process.env };
    for (const k of Object.keys(env)) {
        if (/^KIT_(?:MEMORY_ROOT|MEMORY_ROOT_ALLOW_DATA|RUN_ID|SPAWN_VECTOR|RUN_SECTION)$/i.test(k)
            || /^(?:NODE_OPTIONS|NODE_PATH|NODE_REPL_EXTERNAL_MODULE)$/i.test(k)) {
            delete env[k];
        }
    }
    const key = pathKey(env);
    env[key] = path.dirname(process.execPath) + path.delimiter + (env[key] || '');
    return Object.assign(env, extra || {});
}

// The fleet-store signal pair. The hook checks presence and the literal '1',
// never the path itself, so the value need not exist on disk.
const FLEET = {
    KIT_MEMORY_ROOT: path.join(os.tmpdir(), 'memq-grant-test-store'),
    KIT_MEMORY_ROOT_ALLOW_DATA: '1',
};

function runHook(command, opts) {
    const o = opts || {};
    const payload = { tool_name: 'tool_name' in o ? o.tool_name : 'Bash', tool_input: { command } };
    if (o.cwd) payload.cwd = o.cwd;
    if (o.noCommand) delete payload.tool_input.command;
    const env = o.envObject || baseEnv('env' in o ? o.env : FLEET);
    return spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify(payload),
        encoding: 'utf8',
        env,
    });
}

function assertGrant(res, label) {
    assert.strictEqual(res.status, 0, label + ': exit 0');
    let parsed;
    try {
        parsed = JSON.parse(res.stdout);
    } catch {
        assert.fail(label + ': stdout is not one JSON decision: ' + JSON.stringify(res.stdout));
    }
    assert.deepStrictEqual(Object.keys(parsed), ['hookSpecificOutput'], label);
    assert.strictEqual(parsed.hookSpecificOutput.hookEventName, 'PreToolUse', label);
    assert.strictEqual(parsed.hookSpecificOutput.permissionDecision, 'allow', label);
    assert.ok(typeof parsed.hookSpecificOutput.permissionDecisionReason === 'string'
        && parsed.hookSpecificOutput.permissionDecisionReason.length > 0, label + ': reason present');
}

function assertNoDecision(res, label) {
    assert.strictEqual(res.status, 0, label + ': exit 0 (the hook never denies)');
    assert.strictEqual(res.stdout, '', label + ': no decision on stdout');
}

// --- the one allowed shape -------------------------------------------------

test('the exact invocation is granted under both signals (quoted native path)', () => {
    assertGrant(runHook('node "' + MEMQ + '" recall'), 'quoted native path');
});

test('forward-slash spelling of the same path is granted, quoted or bare', () => {
    assertGrant(runHook('node "' + MEMQ_FWD + '" recall'), 'quoted forward slashes');
    assertGrant(runHook('node ' + MEMQ_FWD + ' recall'), 'bare forward slashes');
});

test('a writing invocation with quoted arguments is granted', () => {
    assertGrant(runHook('node "' + MEMQ + '" log build-quirk pass "stale stamp bites"'),
        'memq log with a quoted summary');
});

test('a quoted argument may carry a # (bash comments start only at an unquoted word)', () => {
    assertGrant(runHook('node "' + MEMQ + '" log k pass "fix #12"'), 'quoted hash in a summary');
});

test('space and tab whitespace around the allowed shape still grants', () => {
    assertGrant(runHook('  node   "' + MEMQ + '"\trecall  '), 'leading, doubled, tab, trailing');
});

test('a traversal that lands back on the real script is the real script', () => {
    const spelled = MEMQ_FWD.replace('scripts/memq.js', 'scripts/../scripts/memq.js');
    assertGrant(runHook('node "' + spelled + '" recall'), 'resolution decides, not spelling');
});

test('arguments after the script path are memq argv, not node flags', () => {
    // node passes everything past the script path to the script, so a
    // flag-shaped argument here reaches memq (which validates its own input),
    // never node itself.
    assertGrant(runHook('node "' + MEMQ + '" --eval whatever'), 'flag-shaped memq argv');
});

if (WIN) {
    test('a different-case spelling of the same path grants (Windows folds case)', () => {
        assertGrant(runHook('node "' + MEMQ.toUpperCase() + '" recall'), 'uppercase spelling');
    });

    test('mixed separators inside a quoted path grant', () => {
        const mixed = MEMQ.replace(path.sep, '/'); // first separator forward, rest native
        assertGrant(runHook('node "' + mixed + '" recall'), 'mixed separators');
    });

    test('the Git-Bash drive spelling of the same path grants', () => {
        const msys = '/' + MEMQ[0].toLowerCase() + MEMQ_FWD.slice(2);
        assertGrant(runHook('node ' + msys + ' recall'), 'MSYS /d/ spelling');
    });
}

// --- the environment gate --------------------------------------------------

test('the exact invocation with no signals, or half the pair, gets no grant', () => {
    const cmd = 'node "' + MEMQ + '" recall';
    assertNoDecision(runHook(cmd, { env: null }), 'neither signal');
    assertNoDecision(runHook(cmd, { env: { KIT_MEMORY_ROOT: FLEET.KIT_MEMORY_ROOT } }),
        'root without the allow signal');
    assertNoDecision(runHook(cmd, { env: { KIT_MEMORY_ROOT_ALLOW_DATA: '1' } }),
        'allow signal without the root');
    assertNoDecision(runHook(cmd, {
        env: { KIT_MEMORY_ROOT: FLEET.KIT_MEMORY_ROOT, KIT_MEMORY_ROOT_ALLOW_DATA: 'true' },
    }), 'allow signal must be the literal 1');
});

// --- the interpreter pin ---------------------------------------------------

test('a module-preload variable set alongside a perfect invocation gets no grant', () => {
    const cmd = 'node "' + MEMQ + '" recall';
    for (const [name, value] of [
        ['NODE_OPTIONS', '--require ' + MEMQ_FWD],
        ['NODE_PATH', path.join(os.tmpdir(), 'planted-modules')],
        ['NODE_REPL_EXTERNAL_MODULE', MEMQ_FWD],
    ]) {
        const extra = { ...FLEET };
        extra[name] = value;
        assertNoDecision(runHook(cmd, { env: extra }), name + ' set');
    }
    // Positive control: the same invocation with the same env minus the
    // preload variable grants, so the refusals above tested the variable and
    // not a broken fixture.
    assertGrant(runHook(cmd), 'positive control after the preload refusals');
});

test('a PATH-planted node ahead of the real interpreter gets no grant', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memq-grant-node-'));
    try {
        const cmd = 'node "' + MEMQ + '" recall';
        const plants = WIN ? ['node', 'node.exe', 'node.cmd'] : ['node'];
        for (const name of plants) {
            fs.writeFileSync(path.join(dir, name), 'planted\n', 'utf8');
            const env = baseEnv(FLEET);
            const key = pathKey(env);
            env[key] = dir + path.delimiter + env[key];
            assertNoDecision(runHook(cmd, { envObject: env }), 'planted ' + name);
            fs.rmSync(path.join(dir, name));
        }
        // Positive control: the same extra directory on PATH but empty, so the
        // refusals above came from the plant and not the extra PATH entry.
        const env = baseEnv(FLEET);
        const key = pathKey(env);
        env[key] = dir + path.delimiter + env[key];
        assertGrant(runHook(cmd, { envObject: env }), 'empty extra PATH entry still grants');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('an empty PATH, or one holding no node, gets no grant (unidentifiable interpreter)', () => {
    // A deleted PATH is not probeable through spawnSync on Windows: libuv
    // re-injects the required variables (PATH among them) from the parent
    // when they are absent, so the empty string is the strongest deliverable
    // form of "no PATH".
    const cmd = 'node "' + MEMQ + '" recall';
    const empty = baseEnv(FLEET);
    empty[pathKey(empty)] = '';
    assertNoDecision(runHook(cmd, { envObject: empty }), 'empty PATH');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memq-grant-nonode-'));
    try {
        const bare = baseEnv(FLEET);
        bare[pathKey(bare)] = dir;
        assertNoDecision(runHook(cmd, { envObject: bare }), 'PATH with no node anywhere');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

// --- the hostile inventory -------------------------------------------------

test('each banned metacharacter refuses the grant, after the path and inside quotes', () => {
    for (const ch of [';', '&', '|', '<', '>', '`', '$', '(', ')', '\n', '\r']) {
        const name = JSON.stringify(ch);
        assertNoDecision(runHook('node "' + MEMQ + '" recall ' + ch + ' echo pwned'),
            name + ' after the script path');
        assertNoDecision(runHook('node "' + MEMQ + '" log k pass "a' + ch + 'b"'),
            name + ' inside a quoted argument');
    }
});

test('whitespace bash does not split on refuses the grant anywhere', () => {
    // NBSP, VT, FF, and the Unicode separators are single-word content to bash
    // and would be separators to a naive splitter; the hook bans them outright.
    for (const ch of ['\u00A0', '\u000B', '\u000C', '\u2028', '\u2029', '\u3000']) {
        const name = 'U+' + ch.codePointAt(0).toString(16).toUpperCase();
        assertNoDecision(runHook('node' + ch + '"' + MEMQ + '" recall'), name + ' after node');
        assertNoDecision(runHook('node "' + MEMQ + '"' + ch + 'recall'), name + ' after the path');
    }
});

test('a second command after the script path has no metacharacter-free spelling', () => {
    assertNoDecision(runHook('node "' + MEMQ + '" recall; node evil.js'), 'semicolon chain');
    assertNoDecision(runHook('node "' + MEMQ + '" recall && rm -rf .'), 'and chain');
    assertNoDecision(runHook('node "' + MEMQ + '" recall\nnode evil.js'), 'newline chain');
});

test('an unquoted comment tail refuses the grant (bash and the splitter disagree past #)', () => {
    assertNoDecision(runHook('node "' + MEMQ + '" recall # innocent tail'), 'comment tail');
    assertNoDecision(runHook('node "' + MEMQ + '" recall #tail'), 'comment tail, no space');
});

test('node -e and inline evaluation get no grant', () => {
    assertNoDecision(runHook('node -e evil'), 'node -e');
    assertNoDecision(runHook('node --eval evil'), 'node --eval');
    assertNoDecision(runHook('node -e "require(\'child_process\')"'), 'node -e with code');
});

test('a node flag before the script path gets no grant', () => {
    // The highest-value near-miss: --require ahead of the script would run
    // attacker code inside a genuine memq invocation if the first-argument
    // check ever regressed to "the target appears among the words".
    assertNoDecision(runHook('node --require evil.js "' + MEMQ + '" recall'), '--require first');
    assertNoDecision(runHook('node -r evil.js "' + MEMQ + '" recall'), '-r first');
    assertNoDecision(runHook('node --inspect "' + MEMQ + '" recall'), '--inspect first');
});

test('node with no argument at all gets no grant', () => {
    assertNoDecision(runHook('node'), 'bare node');
    assertNoDecision(runHook('  node  '), 'bare node with whitespace');
});

test('npx gets no grant, even aimed at the real script', () => {
    assertNoDecision(runHook('npx memq recall'), 'npx by name');
    assertNoDecision(runHook('npx "' + MEMQ + '" recall'), 'npx at the real path');
});

test('only the bare executable name node is granted', () => {
    assertNoDecision(runHook('node.exe "' + MEMQ + '" recall'), 'node.exe');
    assertNoDecision(runHook('"C:/other/node.exe" "' + MEMQ + '" recall'), 'another node, absolute');
    assertNoDecision(runHook('/usr/bin/node "' + MEMQ + '" recall'), 'another node, unix path');
    assertNoDecision(runHook('NODE "' + MEMQ + '" recall'), 'uppercase executable name');
    assertNoDecision(runHook('X=1 node "' + MEMQ + '" recall'), 'env assignment ahead of node');
});

test('a relative spelling gets no grant, with or without a payload cwd', () => {
    // The Bash tool's shell keeps a working directory across calls that
    // nothing pins to the payload cwd, so a relative target is unresolvable
    // even when it would land on the real script from the claimed cwd.
    const rel = 'node scripts/memq.js recall';
    assertNoDecision(runHook(rel, { cwd: PLUGIN_ROOT }), 'relative against the plugin root');
    assertNoDecision(runHook(rel), 'relative with no cwd');
    assertNoDecision(runHook('node ./scripts/memq.js recall', { cwd: PLUGIN_ROOT }), 'dot-relative');
});

test('a lookalike or same-named script at another path gets no grant', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memq-grant-'));
    try {
        const fake = path.join(dir, 'scripts', 'memq.js').split(path.sep).join('/');
        assertNoDecision(runHook('node "' + fake + '" recall'), 'same name, different root');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    assertNoDecision(runHook('node "' + MEMQ_FWD + '.bak" recall'), 'suffix lookalike');
    assertNoDecision(runHook('node "' + MEMQ_FWD + 'x" recall'), 'prefix-of-real trick');
});

test('a traversal reaching another script gets no grant', () => {
    const other = MEMQ_FWD.replace('scripts/memq.js', 'scripts/../hooks/memq-grant.js');
    assertNoDecision(runHook('node "' + other + '" recall'), 'traversal to a sibling hook');
});

test('unicode and percent-encoded lookalikes of the path get no grant', () => {
    assertNoDecision(runHook('node "' + MEMQ_FWD.replace(/memq\.js$/, 'mem\uFF51.js') + '" recall'),
        'full-width q');
    const encoded = MEMQ_FWD.replace('scripts/memq.js', 'scripts/%2e%2e/scripts/memq.js');
    assertNoDecision(runHook('node "' + encoded + '" recall'), 'literal %2e%2e segment');
});

if (WIN) {
    test('a rootless or drive-relative spelling gets no grant on Windows', () => {
        // A rootless slash path resolves against this process's current drive
        // but Git-Bash maps it under its own installation root: two different
        // files, so it cannot be positively resolved.
        assertNoDecision(runHook('node ' + MEMQ_FWD.slice(2) + ' recall'), 'rootless slash path');
        assertNoDecision(runHook('node ' + MEMQ_FWD.replace(':/', ':') + ' recall'),
            'drive-relative path');
    });

    test('a junction landing on the real script from another path gets no grant', (t) => {
        // Path equality is textual after normalization: a link that points at
        // the real file still spells a different path, and refusing it is the
        // narrow direction.
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memq-grant-'));
        try {
            try {
                fs.symlinkSync(path.join(PLUGIN_ROOT, 'scripts'), path.join(dir, 'link'), 'junction');
            } catch {
                t.skip('junction creation denied on this host: the link-spelling refusal was not exercised');
                return;
            }
            const viaLink = path.join(dir, 'link', 'memq.js').split(path.sep).join('/');
            assertNoDecision(runHook('node "' + viaLink + '" recall'), 'junction spelling');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
}

test('quote-parity tricks get no grant', () => {
    assertNoDecision(runHook('node "' + MEMQ + '" log k pass "unterminated'), 'odd quote count');
    assertNoDecision(runHook('node \\"' + MEMQ_FWD + '\\" recall'), 'backslash-escaped quotes');
    assertNoDecision(runHook('node "' + MEMQ + '" pass ""a" b & c""'),
        'parity flip aimed at a cmd.exe-style reparse (carries &)');
});

test('an unquoted backslash spelling gets no grant (the shell would eat it)', () => {
    if (!WIN) return; // the spelling only arises for native Windows paths
    assertNoDecision(runHook('node ' + MEMQ + ' recall'), 'bare backslash path');
});

test('another tool name, a missing command, and a broken payload get no grant', () => {
    assertNoDecision(runHook('node "' + MEMQ + '" recall', { tool_name: 'PowerShell' }),
        'PowerShell payload');
    assertNoDecision(runHook('node "' + MEMQ + '" recall', { tool_name: undefined }),
        'no tool name at all');
    assertNoDecision(runHook('', {}), 'empty command');
    assertNoDecision(runHook('x', { noCommand: true }), 'missing command field');
    const res = spawnSync(process.execPath, [HOOK], {
        input: 'not json', encoding: 'utf8', env: baseEnv(FLEET),
    });
    assertNoDecision(res, 'unparseable payload');
});
