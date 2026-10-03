'use strict';

// The gatherer's contract: the file screen on the closed base-name list,
// decided before any read, in lower case, on the normalized path and again on
// the file a link resolves to; the two refusal reasons and the guarantee that
// neither carries file content or a runtime message; the comment strip per
// extension family, a string-blind scan pinned as such; and the concatenation
// a check sends as its state. Every file here is written under a temporary
// directory, and nothing leaves the machine.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { gatherCode } = require('../plugins/grimoire/scripts/jev-gather.js');

// A recognizable secret, written into every refused file, so a result carrying
// it or any eight characters of it fails the sweep.
const PLANTED = 'PLANTED-FILE-SECRET-5c1d';

// The refused base names: one of each form the list closes over, the
// `.claude` parent rule, the upper-case spellings the Windows file system
// folds onto the same file, and the `.claude` parent written through a dot
// segment, which the screen reads on the normalized path. The dot-segment rows
// are joined by hand, since `path.join` would normalize them away.
const REFUSED = [
    '.env', '.env.local', '.env.production.backup', '.ENV',
    'server.pem', 'host.key', 'bundle.pfx', 'client.p12', 'trust.jks', 'app.keystore', 'prod.tfvars', 'HOST.KEY',
    'id_rsa', 'id_rsa.pub', 'id_ed25519', 'id_ed25519.pub', 'ID_RSA',
    '.npmrc', '.netrc', '.pgpass', '.git-credentials', 'secrets.json', 'putty.ppk', 'HOST.PPK',
    'credentials', 'credentials.json', 'Credentials.txt',
    'app.secrets.json', 'my.secrets', 'x.SECRETS.yaml',
    'kit-jev.json', 'kit-endpoint.json', 'kit-memory-db.json', 'kit-memory-db-logins.json', 'grimoire.local.json',
    'settings.local.json', 'KIT-JEV.JSON', '.envrc', '.ENVRC',
    path.join('.claude', 'settings.json'), path.join('.claude', 'settings.local.json'),
    path.join('.claude', 'anything.json'), path.join('.CLAUDE', 'ANYTHING.JSON'),
    ['.claude', '.', 'settings.json'].join(path.sep), ['.claude', 'x', '..', 'settings.json'].join(path.sep)
];

// Names the list does not reach, each a near-miss of a refused form: the
// control is on the shape, never on a name the list spells.
const READ = [
    'main.js', 'env.js', 'envrc', 'rsa_id.txt', 'id-rsa.md', 'credential.js', 'secretary.js', 'keys.md', 'pem.js',
    'kit-memory-db.js', 'kit-memory-db-logins.txt', 'pgpass', 'git-credentials.md', 'secrets.js', 'ppk.js',
    'settings.json', path.join('claude', 'settings.json'), path.join('.claude', 'notes.md')
];

function tempDir(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-jev-gather-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
}

// The path a test hands the gatherer: the name under the directory as spelled,
// so a dot segment in the name reaches the gatherer rather than `path.join`.
function given(dir, name) {
    return `${dir}${path.sep}${name}`;
}

// Writes the file at the name's normalized place and returns the path as
// given, which is where the gatherer is asked for it.
function write(dir, name, text) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf8');
    return given(dir, name);
}

// A symbolic link, or null where this box refuses to create one: on Windows
// a file link needs a privilege a plain account lacks, while a junction to a
// directory needs none. Only that refusal, EPERM, reads as null; any other
// failure is the test's own and is thrown.
function link(target, at, type) {
    try {
        fs.symlinkSync(target, at, type);
        return at;
    } catch (err) {
        if (err && err.code === 'EPERM') return null;
        throw err;
    }
}

// Every eight-character window of `secret` that `text` carries. Empty is
// clean.
function traces(secret, text) {
    const hits = [];
    for (let i = 0; i + 8 <= secret.length; i += 1) {
        const w = secret.slice(i, i + 8);
        if (text.includes(w)) hits.push(w);
    }
    return hits;
}

// ------------------------------------------------------------- the screen --

test('each refused base name is screened before any read: a missing file carrying the name reads screened file, never unreadable file', (t) => {
    const dir = tempDir(t);
    for (const name of REFUSED) {
        const p = given(dir, name);
        assert.deepEqual(gatherCode([p]), { ok: false, reason: 'screened file', path: p }, name);
    }
});

test('a refused file that exists is screened all the same, and no part of its content reaches the result', (t) => {
    const dir = tempDir(t);
    for (const name of REFUSED) {
        const p = write(dir, name, `${PLANTED}\n`);
        const out = gatherCode([p]);
        assert.deepEqual(out, { ok: false, reason: 'screened file', path: p }, name);
        assert.deepEqual(traces(PLANTED, JSON.stringify(out)), [], name);
    }
    // The sweep speaks: a text carrying the planted secret is named.
    assert.ok(traces(PLANTED, `x ${PLANTED} y`).length > 0);
});

// ------------------------------------------------------------------ links --

test('a link is screened by the name of the file it resolves to, before any read, and a link to an unlisted name is read', (t) => {
    const dir = tempDir(t);
    write(dir, '.env', `${PLANTED}\n`);
    const real = write(dir, 'real.js', 'const a = 1; // one\n');
    const toEnv = link(path.join(dir, '.env'), path.join(dir, 'util.js'), 'file');
    if (toEnv === null) {
        t.skip('this box refuses to create a file symlink (Windows without the privilege)');
        return;
    }
    const toReal = link(path.join(dir, 'real.js'), path.join(dir, 'alias.js'), 'file');
    const namedEnv = link(path.join(dir, 'real.js'), path.join(dir, '.env.link'), 'file');

    // `util.js -> .env`: the given name passes and the resolved name refuses,
    // with the path as given and none of the file.
    const out = gatherCode([toEnv]);
    assert.deepEqual(out, { ok: false, reason: 'screened file', path: toEnv });
    assert.deepEqual(traces(PLANTED, JSON.stringify(out)), []);

    // A file read earlier in the list is not carried past the refusal, since
    // every path is resolved and screened before any is read.
    const control = write(dir, 'control.js', `const planted = '${PLANTED}';\n`);
    const ordered = gatherCode([control, toEnv]);
    assert.deepEqual(ordered, { ok: false, reason: 'screened file', path: toEnv });
    assert.deepEqual(traces(PLANTED, JSON.stringify(ordered)), []);

    // `.env.link -> real.js`: the given name refuses on its own.
    assert.deepEqual(gatherCode([namedEnv]), { ok: false, reason: 'screened file', path: namedEnv });

    // `alias.js -> real.js`: an unlisted name on both sides is read, opened by
    // the path as given.
    assert.deepEqual(gatherCode([toReal]), { ok: true, code: `==== ${toReal}\nconst a = 1; \n`, files: 1 });
    assert.deepEqual(gatherCode([real]), { ok: true, code: `==== ${real}\nconst a = 1; \n`, files: 1 });
});

test('a link to a .claude directory refuses the .json files reached through it, by the resolved parent', (t) => {
    const dir = tempDir(t);
    write(dir, path.join('.claude', 'settings.json'), `{ "planted": "${PLANTED}" }\n`);
    write(dir, path.join('.claude', 'notes.md'), 'notes\n');
    const cfg = link(path.join(dir, '.claude'), path.join(dir, 'cfg'), 'junction');
    if (cfg === null) {
        t.skip('this box refuses to create a directory junction');
        return;
    }
    const settings = path.join(cfg, 'settings.json');
    const out = gatherCode([settings]);
    assert.deepEqual(out, { ok: false, reason: 'screened file', path: settings });
    assert.deepEqual(traces(PLANTED, JSON.stringify(out)), []);
    const notes = path.join(cfg, 'notes.md');
    assert.deepEqual(gatherCode([notes]), { ok: true, code: `==== ${notes}\nnotes\n`, files: 1 });
});

test('a link whose target is missing cannot be resolved and is unreadable file with the path and nothing else', (t) => {
    const dir = tempDir(t);
    const dangling = link(path.join(dir, 'missing.js'), path.join(dir, 'gone.js'), 'file');
    if (dangling === null) {
        t.skip('this box refuses to create a file symlink (Windows without the privilege)');
        return;
    }
    assert.deepEqual(gatherCode([dangling]), { ok: false, reason: 'unreadable file', path: dangling });
});

test('a file beside the refused names is read, and one refused name among many refuses the whole gather with nothing read riding', (t) => {
    const dir = tempDir(t);
    for (const name of READ) {
        const p = write(dir, name, 'const a = 1;\n');
        assert.deepEqual(gatherCode([p]), { ok: true, code: `==== ${p}\nconst a = 1;\n`, files: 1 }, name);
    }
    const control = write(dir, 'control.js', `const planted = '${PLANTED}';\n`);
    const refused = path.join(dir, 'nested', '.env');
    const out = gatherCode([control, refused]);
    assert.deepEqual(out, { ok: false, reason: 'screened file', path: refused });
    assert.deepEqual(traces(PLANTED, JSON.stringify(out)), [], 'the file read before the refusal is not carried');
});

test('a path that cannot be read is unreadable file with the path and nothing else', (t) => {
    const dir = tempDir(t);
    const missing = path.join(dir, 'gone.js');
    assert.deepEqual(gatherCode([missing]), { ok: false, reason: 'unreadable file', path: missing });
    const directory = path.join(dir, 'folder.js');
    fs.mkdirSync(directory);
    assert.deepEqual(gatherCode([directory]), { ok: false, reason: 'unreadable file', path: directory });
});

// -------------------------------------------------------------- the strip --

// One text per family, written under each of the family's extensions. The
// expected text keeps the newline each line comment ended on and every
// newline inside a block, so the line structure survives.
const SLASH = 'const x = 1; // trailing\n// whole line\n/* block\nspans */ const y = 2;\nconst z = 3; /* inline */ const w = 4;\n';
const SLASH_STRIPPED = 'const x = 1; \n\n\n const y = 2;\nconst z = 3;  const w = 4;\n';
const DASH = 'SELECT 1 -- trailing\n-- whole line\n/* block\nspans */ SELECT 2\n';
const DASH_STRIPPED = 'SELECT 1 \n\n\n SELECT 2\n';
const HASH = 'x = 1 # trailing\n# whole line\ny = 2\n';
const HASH_STRIPPED = 'x = 1 \n\ny = 2\n';

test('comments are stripped by extension family, and any other extension is sent as it stands', (t) => {
    const dir = tempDir(t);
    const cases = [
        ['.js', SLASH, SLASH_STRIPPED], ['.mjs', SLASH, SLASH_STRIPPED], ['.cjs', SLASH, SLASH_STRIPPED],
        ['.ts', SLASH, SLASH_STRIPPED], ['.cs', SLASH, SLASH_STRIPPED], ['.JS', SLASH, SLASH_STRIPPED],
        ['.sql', DASH, DASH_STRIPPED],
        ['.ps1', HASH, HASH_STRIPPED], ['.sh', HASH, HASH_STRIPPED], ['.py', HASH, HASH_STRIPPED],
        ['.md', SLASH + DASH + HASH, SLASH + DASH + HASH], ['.txt', SLASH, SLASH], ['.json', HASH, HASH], ['', SLASH, SLASH]
    ];
    for (const [ext, text, expected] of cases) {
        const p = write(dir, `file${ext}`, text);
        assert.deepEqual(gatherCode([p]), { ok: true, code: `==== ${p}\n${expected}`, files: 1 }, ext || 'no extension');
    }
});

test('a line comment that ends the file, and a block that never closes, strip to the end', (t) => {
    const dir = tempDir(t);
    const noNewline = write(dir, 'a.js', 'const x = 1; // the end');
    assert.deepEqual(gatherCode([noNewline]), { ok: true, code: `==== ${noNewline}\nconst x = 1; \n`, files: 1 });
    const open = write(dir, 'b.sql', 'SELECT 1\n/* never\ncloses');
    assert.deepEqual(gatherCode([open]), { ok: true, code: `==== ${open}\nSELECT 1\n\n`, files: 1 });
});

test('the scan knows no strings: a comment opener inside a string literal loses the rest of its line, pinned as the stated behaviour', (t) => {
    const dir = tempDir(t);
    const cases = [
        ['.js', 'const u = "http://host/x"; const v = 1;\nconst w = 2;\n', 'const u = "http:\nconst w = 2;\n'],
        ['.sql', "SELECT '--not a comment' AS a, 1 AS b\nSELECT 2\n", "SELECT '\nSELECT 2\n"],
        ['.py', 'u = "a#b"; v = 1\nw = 2\n', 'u = "a\nw = 2\n']
    ];
    for (const [ext, text, expected] of cases) {
        const p = write(dir, `file${ext}`, text);
        assert.deepEqual(gatherCode([p]), { ok: true, code: `==== ${p}\n${expected}`, files: 1 }, ext);
    }
});

test('a CRLF file keeps its line endings where a line comment is cut and inside a stripped block', (t) => {
    const dir = tempDir(t);
    const p = write(dir, 'a.js', 'const x = 1; // note\r\nconst y = 2;\r\n');
    assert.deepEqual(gatherCode([p]), { ok: true, code: `==== ${p}\nconst x = 1; \r\nconst y = 2;\r\n`, files: 1 });
    const block = write(dir, 'b.js', 'const x = 1;\r\n/* a\r\nb\r\nc */ const y = 2;\r\n');
    assert.deepEqual(gatherCode([block]), { ok: true, code: `==== ${block}\nconst x = 1;\r\n\r\n\r\n const y = 2;\r\n`, files: 1 });
});

// ---------------------------------------------------------- the gathering --

test('the code is the files in argument order, each opened by a line naming the path as given, and the count rides beside it', (t) => {
    const dir = tempDir(t);
    write(dir, 'first.js', 'const a = 1; // one');
    write(dir, 'second.py', 'b = 2 # two\n');
    const forward = `${dir.replace(/\\/g, '/')}/first.js`;
    const second = path.join(dir, 'second.py');
    const out = gatherCode([second, forward]);
    assert.deepEqual(out, {
        ok: true,
        code: `==== ${second}\nb = 2 \n==== ${forward}\nconst a = 1; \n`,
        files: 2
    });
});
