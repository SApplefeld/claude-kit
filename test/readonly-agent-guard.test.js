// Tests for plugins/claude-kit/hooks/readonly-agent-guard.js (the read-only
// contract of the kit's judgment agents).
//
// Node's built-in test runner, no framework (Node v24). The guard is spawned as a
// real child process, fed a PreToolUse payload on stdin, and asserted on by its
// exit code: 2 is a deny, 0 is an allow. Both directions are pinned for both
// classes, because each direction has an expensive failure: a guard that traps
// legitimate review work (a base-ref read, a suite run, a scratch write, a grep
// whose pattern contains a governed word) silently degrades every review, and a
// guard that lets a mutation through is the incident it exists to prevent.
//
// Two assertion rules keep a case from passing for the wrong reason. The guard
// fails open, so every allow case also asserts empty stderr: a swallowed
// exception exits 0 too, and a status-only assertion would go green on a broken
// guard. And every heuristic deny case asserts the reason text, so a deny reached
// by misclassifying an operand (a sed script read as a filename) fails here.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');

const GUARD = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'readonly-agent-guard.js');
const AGENTS = path.join(__dirname, '..', 'plugins', 'claude-kit', 'agents');

// A repo root on the running platform's own root (D:\repo on Windows, /repo on
// POSIX), so path classification is tested with real platform semantics. It holds
// no .git entry, which is the case the guard falls back to cwd for.
const CWD = path.resolve('/repo');
const OUTSIDE = path.resolve('/elsewhere/file');

// This repository and its test directory, for the cases that need a cwd really
// inside a git repo: the root walk and a cd target both touch the filesystem.
const REPO = path.resolve(__dirname, '..');
const REPO_SUBDIR = __dirname;

const STRICT = 'claude-kit:adversarial-reviewer';
const GATE = 'claude-kit:qa-verifier';

// Reason fragments the guard reports, so a deny is pinned to its cause.
const GIT = /a git state change \(git /;
const WRITE = /a write into the tree under review/;
const PATHMUT = /a path mutation in the tree under review/;
const BULK = /a (?:bulk|piped) (?:delete|mutation)/;
const NESTED = /inside a nested shell/;

function runGuard(payload) {
    return spawnSync(process.execPath, [GUARD], {
        input: JSON.stringify(payload),
        encoding: 'utf8',
    });
}

function bash(agentType, command) {
    const p = { tool_name: 'Bash', tool_input: { command }, cwd: CWD };
    if (agentType !== null) p.agent_type = agentType;
    return p;
}

function assertAllowed(agentType, command) {
    const r = runGuard(bash(agentType, command));
    assert.strictEqual(r.stderr, '', `expected no stderr for ${agentType}: ${command}`);
    assert.strictEqual(r.status, 0, `expected allow for ${agentType}: ${command}`);
}

// `reason` is the fragment the denial must name. Omitted only where the case is
// about class resolution rather than about which heuristic fired.
function assertDenied(agentType, command, reason) {
    const r = runGuard(bash(agentType, command));
    assert.strictEqual(r.status, 2, `expected deny for ${agentType}: ${command}`);
    assert.match(r.stderr, /may not change the state under review/);
    if (reason) assert.match(r.stderr, reason, `wrong reason for ${agentType}: ${command}`);
}

function allowAll(agentType, commands) {
    for (const c of commands) assertAllowed(agentType, c);
}

// The same two assertions with an explicit payload cwd.
function assertAllowedAt(cwd, agentType, command) {
    const r = runGuard({ tool_name: 'Bash', agent_type: agentType, cwd, tool_input: { command } });
    assert.strictEqual(r.stderr, '', `expected no stderr at ${cwd}: ${command}`);
    assert.strictEqual(r.status, 0, `expected allow at ${cwd}: ${command}`);
}

function assertDeniedAt(cwd, agentType, command, reason) {
    const r = runGuard({ tool_name: 'Bash', agent_type: agentType, cwd, tool_input: { command } });
    assert.strictEqual(r.status, 2, `expected deny at ${cwd}: ${command}`);
    if (reason) assert.match(r.stderr, reason, `wrong reason at ${cwd}: ${command}`);
}

function denyAll(agentType, cases) {
    for (const [c, reason] of cases) assertDenied(agentType, c, reason);
}

test('all six judgment agents resolve to the strict class, namespaced or bare', () => {
    for (const t of ['adversarial-reviewer', 'blind-reviewer', 'security-reviewer', 'council-member',
        'design-facilitator', 'consultant', 'claude-kit:adversarial-reviewer',
        'claude-kit:blind-reviewer', 'claude-kit:security-reviewer', 'claude-kit:council-member',
        'claude-kit:design-facilitator', 'claude-kit:consultant']) {
        assertDenied(t, 'git commit -m x', GIT);
    }
});

test('a type that merely contains a judgment agent name is not governed', () => {
    allowAll('blind-reviewer-helper', ['git commit -m x']);
    allowAll('my-adversarial-reviewer', ['git commit -m x']);
    allowAll('reviewer', ['git commit -m x']);
    allowAll('consultant-helper', ['git commit -m x']);
    allowAll('my-consultant', ['git commit -m x']);
});

// The last case is the one that pins the *class* rather than merely pinning
// that the type is governed at all. Every other command here is denied for the
// gate class too, so a future edit that misfiled `consultant` under 'gate'
// would leave them all green while silently granting in-tree file creation,
// deletion anywhere under a bin/obj/node_modules/.vs/TestResults name at any
// depth, and package installs. `touch` on a fresh path is the discriminator:
// strict denies it, the gate class allows it deliberately for test scaffolding.
test('consultant: git state changes, tree writes, and path mutations are denied', () => {
    denyAll('claude-kit:consultant', [
        ['git commit -m x', GIT],
        ['echo findings > src/notes.md', WRITE],
        ['rm src/a.cs', PATHMUT],
        ['mv src/a.cs src/b.cs', PATHMUT],
        ['touch src/new.cs', PATHMUT],
    ]);
});

test('consultant: reads and scratch writes pass', () => {
    allowAll('claude-kit:consultant', ['git diff main...HEAD', 'git log --oneline -20',
        'rg "denyReason" plugins/', 'echo findings > .kit/consult-notes.md']);
});

test('strict class: git state mutations are denied', () => {
    for (const sub of ['add .', 'am patch', 'apply p.patch', 'cherry-pick abc',
        'checkout main', 'checkout-index -a', 'clean -fd', 'clone https://x/y', 'commit -m x',
        'filter-branch --all', 'gc', 'init', 'merge main', 'mergetool', 'mv a b', 'prune', 'pull',
        'push origin main', 'read-tree HEAD', 'rebase main', 'reset --hard', 'restore src/x',
        'revert abc', 'rm src/x', 'sparse-checkout set src', 'stash',
        'switch main', 'update-index --refresh', 'update-ref refs/heads/x abc']) {
        assertDenied(STRICT, `git ${sub}`, GIT);
    }
});

test('strict class: submodule and bisect deny only their mutating subverbs', () => {
    allowAll(STRICT, ['git submodule status', 'git submodule', 'git submodule summary',
        'git bisect log', 'git bisect view', 'git bisect visualize']);
    for (const cmd of ['git submodule update --init', 'git submodule add https://x/y sub',
        'git submodule deinit sub', 'git submodule sync', 'git submodule set-url sub https://x/z',
        'git bisect start', 'git bisect good', 'git bisect bad HEAD', 'git bisect reset',
        'git bisect run npm test']) {
        assertDenied(STRICT, cmd, /a git (?:submodule|bisect) mutation/);
    }
});

test('a git invocation asking for help is a read', () => {
    allowAll(STRICT, ['git gc --help', 'git commit -h', 'git checkout --help', 'git push --help']);
});

test('a help flag counts only immediately after the subcommand', () => {
    // Anywhere later the token can be an option's value and the command still
    // acts: git stash push -m "-h" stashes, git clean -fd -e -h deletes with -h
    // consumed as the exclude pattern, git commit -am "--help" commits.
    allowAll(STRICT, ['git stash --help', 'git clean --help']);
    denyAll(STRICT, [
        ['git stash push -m "-h"', GIT],
        ['git clean -fd -e -h', GIT],
        ['git commit -am "--help"', GIT],
    ]);
});

test('strict class: git reads are allowed', () => {
    allowAll(STRICT, ['diff', 'diff --stat HEAD~1', 'log -p', 'show HEAD', 'status --porcelain',
        'grep -n foo', 'blame src/x', 'rev-parse HEAD', 'rev-list --count HEAD', 'ls-files',
        'describe --tags', 'shortlog -sn', 'cat-file -p HEAD', 'fetch origin', 'remote -v',
        'config --get user.name', 'symbolic-ref --quiet --short HEAD'].map(s => `git ${s}`));
});

test('strict class: git merge-base is a read, not a merge', () => {
    allowAll(STRICT, ['git merge-base main HEAD', 'git merge-base --fork-point origin/main']);
});

test('strict class: branch, tag, and worktree deny only their mutating forms', () => {
    allowAll(STRICT, ['git branch', 'git branch --list', 'git branch -a', 'git branch -r',
        'git branch --contains abc', 'git tag', 'git tag -l', 'git tag --list',
        'git tag --list "*-sign*"', 'git tag --sort=-creatordate',
        'git worktree list', 'git worktree list --porcelain',
        'git worktree list ../add-review', 'git worktree list ../add', 'git worktree list add']);
    for (const cmd of ['git branch -d old', 'git branch -D old', 'git branch -m a b',
        'git branch --delete old', 'git branch --force main abc', 'git branch --set-upstream-to=origin/x',
        'git tag -d v1', 'git tag -a v1 -m x', 'git tag --delete v1',
        'git worktree add ../wt main', 'git worktree remove ../wt', 'git worktree prune']) {
        assertDenied(STRICT, cmd, /a git (?:branch|tag|worktree) mutation/);
    }
});

test('strict class: global flags between git and the subcommand do not hide a mutation', () => {
    for (const cmd of ['git -C . commit -m x', 'git --no-pager checkout main',
        'git -c user.name=x commit -m y', 'git --git-dir=.git commit -m z',
        'git --git-dir .git reset --hard']) {
        assertDenied(STRICT, cmd, GIT);
    }
    allowAll(STRICT, ['git -C . diff', 'git --no-pager log -p']);
});

test('strict class: a chained mutation behind a read is denied', () => {
    assertDenied(STRICT, 'git diff && git checkout main', GIT);
    assertDenied(STRICT, 'git status; git stash', GIT);
});

test('quoted text is not a command: a governed verb inside an argument is a read', () => {
    allowAll(STRICT, ['rg "git commit" plugins/', 'rg "the git commit flow" docs/',
        "rg 'git push' --glob '*.md'", 'rg "=> handler" src', 'rg -n "IEnumerable<string> items" src/',
        'git log --grep=checkout', 'rg "rm -rf" scripts/', 'rg "Remove-Item" plugins/',
        'echo "run git commit when ready"']);
});

test('a nested shell is judged on what it runs', () => {
    for (const cmd of ['sh -c "git commit -m x"', "bash -c 'rm src/x'",
        'bash -lc "git push origin main"', 'sh -c "echo x > src/file"',
        'eval "git reset --hard"', 'pwsh -Command "Remove-Item src/x"',
        'powershell -NoProfile -Command "Set-Content -Path src/x -Value y"']) {
        assertDenied(STRICT, cmd, NESTED);
    }
    allowAll(STRICT, ['sh -c "git diff"', 'bash -c "node --test test/x.test.js"',
        'bash scripts/verify.sh', 'sh -c "echo x > .kit/report.md"']);
});

test('cmd and iex are nested executors whose quoted payload is analyzed', () => {
    // Quoting the payload is the natural spelling for both (cmd /c "..."), and
    // the mask hides a quoted verb from command position, so only the recursion
    // sees it. The unquoted form keeps the verb in command position and is
    // caught by the outer scan, so both spellings deny.
    denyAll(STRICT, [
        ['cmd /c "git commit -m x"', NESTED],
        ['cmd /c git commit -m x', GIT],
        ['cmd.exe /c "rm README.md"', NESTED],
        ['cmd //c "git commit -m x"', NESTED],
        ['cmd /k "git push origin main"', NESTED],
        ["iex 'git commit -m x'", NESTED],
        ['iex "git push origin main"', NESTED],
        ["Invoke-Expression 'Remove-Item README.md'", NESTED],
    ]);
    allowAll(STRICT, ['cmd /c "git diff"', 'iex "git diff"']);
});

test('strict class: writes into the tree are denied', () => {
    denyAll(STRICT, [
        ['echo x > src/file', WRITE],
        ['echo x >> src/file', WRITE],
        ['echo x > "src/file"', WRITE],
        [`echo x > ${path.join(CWD, 'src', 'file')}`, WRITE],
        ['cat > docs/notes.md <<EOF', WRITE],
        ['node x.js | tee report.md', WRITE],
        ['node x.js | tee -a report.md', WRITE],
        ['node x.js | tee .kit/log src/file', WRITE],
        ["sed -i 's/a/b/' plugins/claude-kit/hooks/x.js", WRITE],
        ["sed -i 's|a|b|' src/x.cs", WRITE],
        ["sed -i 's/a/b/;s/c/d/' src/x.cs", WRITE],
        ["sed -i -e 's/a/b/' -e 's/c/d/' src/x.cs", WRITE],
        ["sed --in-place 's/a/b/' src/x", WRITE],
    ]);
});

test('strict class: a redirect that is not a repo path is allowed', () => {
    allowAll(STRICT, ['node --test test/x.test.js 2>&1 | tail -20', 'dotnet test 2>/dev/null',
        'node x.js > /dev/null', 'node x.js > NUL', 'echo x > .kit/report.md', 'echo x > .kit\\report.md',
        `echo x > ${path.join(CWD, '.kit', 'report.md')}`, `echo x > ${OUTSIDE}`,
        'echo x > $SCRATCH/out.txt', 'echo x > %TEMP%\\out.txt', 'echo x > ~/notes.md',
        'node x.js | tee .kit/log.txt', "sed -n '1,20p' src/x.cs"]);
});

test('the repo root and its ancestors are inside the tree under review', () => {
    denyAll(STRICT, [
        ['rm -rf .', PATHMUT],
        ['rm -rf ./', PATHMUT],
        ['rm -rf ..', PATHMUT],
        ['rm -rf ../..', PATHMUT],
        [`rm -rf ${CWD}`, PATHMUT],
        ['Remove-Item -Recurse -Force .', PATHMUT],
        ['Remove-Item -Recurse -Force ..', PATHMUT],
    ]);
    allowAll(STRICT, [`rm -rf ${OUTSIDE}`, `rm -rf ${path.resolve('/elsewhere')}`]);
});

test('strict class: a move deletes its source, so both operands count', () => {
    denyAll(STRICT, [
        ['mv src/tracked.cs .kit/keep.cs', PATHMUT],
        ['mv src/tracked.cs /elsewhere/keep.cs', PATHMUT],
        ['mv src/a src/b', PATHMUT],
        ['Move-Item src/a.txt .kit/a.txt', PATHMUT],
        ['Rename-Item src/a.js b.js', PATHMUT],
    ]);
    // A copy leaves its source in place, so only the destination counts.
    allowAll(STRICT, ['cp plugins/claude-kit/hooks/x.js .kit/x.js',
        'Copy-Item -Path src/a.txt -Destination .kit/a.txt', 'Copy-Item src/a.txt .kit/a.txt',
        `cp src/a.txt ${OUTSIDE}`]);
});

test('strict class: file mutation commands are denied in the tree, allowed into .kit/', () => {
    denyAll(STRICT, [
        ['rm src/x', PATHMUT],
        ['rm -rf obj', PATHMUT],
        ['rmdir src/empty', PATHMUT],
        ['touch src/x.cs', PATHMUT],
        ['chmod +x scripts/run.sh', PATHMUT],
        ['cp plugins/claude-kit/hooks/x.js plugins/claude-kit/hooks/y.js', PATHMUT],
    ]);
    allowAll(STRICT, ['rm -rf .kit/tmp', `rm ${OUTSIDE}`, `chmod 755 ${OUTSIDE}`, 'ls -la src',
        'cat src/x', 'rg pattern plugins/']);
});

test('bulk delete idioms are denied for both classes', () => {
    for (const agent of [STRICT, GATE]) {
        denyAll(agent, [
            ['find . -name "*.js" -delete', BULK],
            ['find src -type f -delete', BULK],
            ['find . -name "*.cs" -exec sed -i "s/a/b/" {} +', BULK],
            ['find . -type f -exec rm {} \\;', BULK],
            ['find . -type d -execdir rmdir {} \\;', BULK],
            ['git ls-files | xargs rm', BULK],
            ['git ls-files | xargs -n 1 rm', BULK],
            ['rg -l foo | xargs sed -i "s/a/b/"', BULK],
            // A git verb piped through xargs is still in command position, so the
            // git heuristic names this one first.
            ['git ls-files | xargs git rm', GIT],
        ]);
        allowAll(agent, ['find . -name "*.js" -print', 'find src -type f | head -5',
            'git ls-files | xargs grep -l TODO', 'rg -l foo | xargs wc -l']);
    }
});

test('a lockfile-rewriting install is denied to both classes; npm ci is the gate-runner\'s', () => {
    for (const agent of [STRICT, GATE]) {
        for (const cmd of ['npm install', 'npm install --save-dev x', 'pnpm add x',
            'yarn install', 'npm update', 'npm --prefix . install', 'npm -C . install']) {
            assertDenied(agent, cmd, /a package-manager mutation/);
        }
        allowAll(agent, ['npm test', 'npm run test', 'npm run build', 'pnpm test',
            'node --test test/x.test.js', 'dotnet build', 'dotnet test', 'prettier --check .']);
    }
    assertDenied(STRICT, 'npm ci', /a package-manager mutation \(npm ci\)/);
    assertAllowed(GATE, 'npm ci');
});

test('package-manager verb aliases and bare installs carry the same policy', () => {
    for (const agent of [STRICT, GATE]) {
        // npm i is the most common spelling of install; yarn 1 and pnpm install
        // when run with no verb at all.
        for (const cmd of ['npm i', 'npm i lodash', 'npm in x', 'npm ins x', 'npm inst x',
            'npm up', 'npm upgrade', 'pnpm i', 'pnpm up', 'yarn add x', 'yarn up x',
            'yarn', 'pnpm', 'yarn --frozen-lockfile']) {
            assertDenied(agent, cmd, /a package-manager mutation/);
        }
        allowAll(agent, ['yarn --version', 'pnpm -v', 'npm view lodash', 'npm ls']);
    }
});

test('formatters are denied for both classes', () => {
    for (const agent of [STRICT, GATE]) {
        for (const cmd of ['dotnet format', 'dotnet format --severity warn', 'prettier -w src',
            'prettier --write .']) {
            assertDenied(agent, cmd, /a formatter run/);
        }
        allowAll(agent, ['dotnet build', 'dotnet test', 'prettier --check .']);
    }
});

test('formatter package scripts are denied; check-only formatter passes are not', () => {
    for (const agent of [STRICT, GATE]) {
        for (const cmd of ['npm run format', 'npm run fmt', 'npm run lint:fix',
            'npm run lint -- --fix', 'pnpm run format', 'yarn run fmt']) {
            assertDenied(agent, cmd, /a formatter run/);
        }
        // A lint that only checks stays open, and so does a check-only
        // dotnet format: both are legitimate gate steps that write nothing.
        allowAll(agent, ['npm run lint', 'npm run format:check',
            'dotnet format --verify-no-changes', 'dotnet format --check',
            'dotnet format --verify-no-changes --severity warn']);
    }
});

test('GitHub state mutations are denied for both classes', () => {
    for (const agent of [STRICT, GATE]) {
        denyAll(agent, [
            ['gh pr merge 1', /a pull-request mutation \(gh pr merge\)/],
            ['gh pr close 1', /a pull-request mutation/],
            ['gh pr edit 1 --title x', /a pull-request mutation/],
            ['gh pr comment 1 --body x', /a pull-request mutation/],
            ['gh pr review 1 --approve', /a pull-request mutation/],
            ['gh pr ready 1', /a pull-request mutation/],
            ['gh release create v1', /a release mutation/],
            ['gh api -X POST /repos/x/y/issues', /a write API call \(gh api POST\)/],
            ['gh api --method DELETE /repos/x/y/git/refs/heads/z', /a write API call \(gh api DELETE\)/],
        ]);
        allowAll(agent, ['gh pr view 1', 'gh pr diff 1', 'gh pr list', 'gh pr list --search "merge"',
            'gh run list', 'gh api /repos/x/y/pulls/1', 'gh api -X GET /repos/x/y']);
    }
});

test('a gh flag value does not shift the command group out of view', () => {
    for (const agent of [STRICT, GATE]) {
        denyAll(agent, [
            ['gh -R owner/name pr merge 1', /a pull-request mutation \(gh pr merge\)/],
            ['gh --repo owner/name pr merge 1', /a pull-request mutation/],
            ['gh --hostname github.example.com pr close 1', /a pull-request mutation/],
            ['gh -R owner/name release create v1', /a release mutation/],
            ['gh api -XPOST /repos/x/y', /a write API call \(gh api POST\)/],
            ['gh api -X=POST /repos/x/y', /a write API call \(gh api POST\)/],
            ['gh -R owner/name api -X PATCH /repos/x/y', /a write API call \(gh api PATCH\)/],
        ]);
        allowAll(agent, ['gh -R owner/name pr view 1', 'gh --repo owner/name pr diff 1',
            'gh pr list --json number,title', 'gh -R owner/name api -XGET /repos/x/y']);
    }
});

test('gh api with a field flag and no explicit method is a write (POST is its default)', () => {
    for (const agent of [STRICT, GATE]) {
        denyAll(agent, [
            ['gh api repos/o/r/issues/1/comments -f body=hi', /a write API call/],
            ['gh api repos/o/r -F key=1', /a write API call/],
            ['gh api repos/o/r --field key=1', /a write API call/],
            ['gh api repos/o/r --raw-field key=1', /a write API call/],
            ['gh api repos/o/r --input body.json', /a write API call/],
        ]);
        allowAll(agent, ['gh api repos/o/r', 'gh api -X GET repos/o/r -f q=1',
            'gh api --method GET repos/o/r --field per_page=100']);
    }
});

test('outward gh verbs beyond pr and release are denied for both classes', () => {
    for (const agent of [STRICT, GATE]) {
        denyAll(agent, [
            ['gh repo delete o/r --yes', /a repository mutation \(gh repo delete\)/],
            ['gh repo edit o/r --visibility private', /a repository mutation/],
            ['gh repo rename newname', /a repository mutation/],
            ['gh repo archive o/r', /a repository mutation/],
            ['gh workflow run ci.yml', /a workflow mutation \(gh workflow run\)/],
            ['gh workflow enable ci.yml', /a workflow mutation/],
            ['gh workflow disable ci.yml', /a workflow mutation/],
            ['gh secret set TOKEN', /a secret mutation \(gh secret set\)/],
            ['gh secret delete TOKEN', /a secret mutation/],
            ['gh variable set NAME', /a variable mutation/],
            ['gh variable delete NAME', /a variable mutation/],
            ['gh issue close 1', /an issue mutation \(gh issue close\)/],
            ['gh issue edit 1 --title x', /an issue mutation/],
            ['gh issue comment 1 --body x', /an issue mutation/],
            ['gh issue delete 1', /an issue mutation/],
        ]);
        allowAll(agent, ['gh repo view o/r', 'gh workflow list', 'gh workflow view ci.yml',
            'gh secret list', 'gh variable list', 'gh issue list', 'gh issue view 1']);
    }
});

test('strict class: PowerShell writers into the tree are denied', () => {
    denyAll(STRICT, [
        ['Set-Content -Path src/file -Value x', PATHMUT],
        ['Out-File -FilePath src\\file', PATHMUT],
        ['Out-File -Encoding utf8 src/file', PATHMUT],
        ['Add-Content src/file "text"', PATHMUT],
        ['Clear-Content src/x.js', PATHMUT],
        ['node x.js | Tee-Object -FilePath src/log.txt', PATHMUT],
        ['Remove-Item src/file', PATHMUT],
        ['Remove-Item src', PATHMUT],
        ['Remove-Item -Force -Recurse src/dir', PATHMUT],
        ['Remove-Item -Recurse -Force test', PATHMUT],
        ['New-Item -Path src/file -ItemType File', PATHMUT],
        ['Copy-Item a.txt src/b.txt', PATHMUT],
        ['Copy-Item -Path .kit/a.txt -Destination src/b.txt', PATHMUT],
    ]);
});

test('strict class: the PowerShell aliases carry the same policy as their cmdlets', () => {
    denyAll(STRICT, [
        ['ri -Recurse -Force plugins', PATHMUT],
        ['del plugins\\claude-kit\\hooks\\x.js', PATHMUT],
        ['erase src/x.js', PATHMUT],
        ['rd src/empty', PATHMUT],
        ['mi src/a src/b', PATHMUT],
        ['move src/a src/b', PATHMUT],
        ['ren src/a.js b.js', PATHMUT],
        ['rni src/a.js b.js', PATHMUT],
        ['ac -Path src/file -Value x', PATHMUT],
        ['clc src/file', PATHMUT],
        ['ni -Path src/file -ItemType File', PATHMUT],
        ['cpi a.txt src/b.txt', PATHMUT],
        ['copy a.txt src/b.txt', PATHMUT],
    ]);
    allowAll(STRICT, ['ri .kit/tmp', `del ${OUTSIDE}`, 'cpi src/a.txt .kit/a.txt',
        'ac -Path .kit/log.md -Value x']);
});

test('a PowerShell pipeline into a destructive cmdlet is a bulk mutation', () => {
    for (const agent of [STRICT, GATE]) {
        denyAll(agent, [
            ['Get-ChildItem plugins -Recurse | Remove-Item', BULK],
            ['gci -Recurse | Remove-Item -Force', BULK],
            ['Get-ChildItem src | ri -Force', BULK],
            ['Get-ChildItem src | Rename-Item -NewName x', BULK],
        ]);
        allowAll(agent, ['Get-ChildItem plugins -Recurse', 'Get-ChildItem src | Select-Object Name',
            'Get-ChildItem src | Measure-Object']);
    }
});

test('strict class: PowerShell writers outside the tree are allowed', () => {
    allowAll(STRICT, ['Set-Content -Path .kit/report.md -Value x', `Out-File -FilePath ${OUTSIDE}`,
        `Out-File -Encoding utf8 ${OUTSIDE}`, `Remove-Item ${OUTSIDE}`, 'Remove-Item .kit/tmp',
        'Get-Content src/file', 'Select-String -Pattern x -Path src/*']);
});

test('gate-runner: builds, suites, and its own output are allowed', () => {
    allowAll(GATE, ['dotnet build', 'dotnet test', 'npm test', 'npm ci',
        'rm -rf obj', 'rm -rf bin obj', 'rm -rf node_modules', 'rm -rf TestResults',
        'Remove-Item -Recurse -Force obj', 'touch src/x.cs', 'cp src/a src/b',
        'New-Item -Path src/fixture.json -ItemType File',
        'dotnet test --logger trx 2>&1 | tail -40', 'echo x > .kit/qa.md',
        'dotnet build > obj/build.log', 'dotnet test > TestResults/run.txt',
        'Out-File -FilePath obj/build.log']);
});

test('the build-output allowance is the gate-runner class alone', () => {
    denyAll(STRICT, [
        ['dotnet build > obj/build.log', WRITE],
        ['rm -rf obj', PATHMUT],
    ]);
});

test('the gate-runner may create but not overwrite', () => {
    // cp overwrites an existing destination by default, and -Force truncates
    // whatever the target holds, so the creating allowance stops where content
    // would be destroyed. README.md exists at the repo root.
    assertDeniedAt(REPO, GATE, 'cp .kit/x.md README.md', PATHMUT);
    assertDeniedAt(REPO, GATE, 'Copy-Item .kit/a.txt README.md', PATHMUT);
    assertDenied(GATE, 'New-Item -Path README.md -Force -ItemType File', PATHMUT);
    assertDenied(GATE, 'Copy-Item -Path .kit/a.txt -Destination src/b.txt -Force', PATHMUT);
    // A new file, a no-clobber copy, and scratch stay the gate-runner's.
    assertAllowedAt(REPO, GATE, 'cp .kit/x.md .kit/y.md');
    assertAllowedAt(REPO, GATE, 'cp -n .kit/x.md README.md');
    assertAllowedAt(REPO, GATE, 'cp .kit/x.md no-such-file-here.md');
    assertAllowedAt(REPO, GATE, 'New-Item -Path no-such-file-here.json -ItemType File');
});

test('gate-runner: destroying tracked content and changing git state are denied', () => {
    denyAll(GATE, [
        ['git commit -m x', GIT],
        ['git checkout main', GIT],
        ['git stash', GIT],
        ['git branch -D old', /a git branch mutation/],
        ['echo x > src/file', WRITE],
        ["sed -i 's/a/b/' src/x", WRITE],
        ['node x.js | tee src/log.txt', WRITE],
        ['Set-Content -Path src/file -Value x', PATHMUT],
        ['rm -rf src', PATHMUT],
        ['rm src/x.cs', PATHMUT],
        ['mv src/a src/b', PATHMUT],
        ['Remove-Item -Recurse -Force src', PATHMUT],
        ['Rename-Item src/a.js b.js', PATHMUT],
        ['rm -rf .', PATHMUT],
        ['sh -c "git commit -m x"', NESTED],
    ]);
});

test('containment is judged against the git root, not the payload cwd', () => {
    // The payload cwd is a real subdirectory of a real git repo, so the root walk
    // finds the repo above it and a relative path back out stays in the tree.
    assertDeniedAt(REPO_SUBDIR, STRICT, 'rm ../README.md', PATHMUT);
    assertDeniedAt(REPO_SUBDIR, STRICT, 'rm ../plugins/claude-kit/hooks/docs-write-guard.js', PATHMUT);
    assertDeniedAt(REPO_SUBDIR, STRICT, 'sed -i s/a/b/ ../plugins/claude-kit/hooks/docs-write-guard.js', WRITE);
    assertDeniedAt(REPO_SUBDIR, STRICT, `rm ${path.join(REPO, 'README.md')}`, PATHMUT);
    assertDeniedAt(REPO_SUBDIR, STRICT, 'rm x.log', PATHMUT);
    assertAllowedAt(REPO_SUBDIR, STRICT, 'rm ../.kit/scratch.md');
    assertAllowedAt(REPO_SUBDIR, STRICT, `rm ${OUTSIDE}`);
    assertAllowedAt(REPO_SUBDIR, STRICT, 'git diff -- ../plugins');
});

// Drive-letter spellings exist only where paths carry a drive letter.
test('alternate absolute spellings of an in-tree path are the same path', { skip: !/^[A-Za-z]:\\/.test(REPO) }, () => {
    // The Git-Bash form /<drive>/<rest> is what pwd prints inside the Bash
    // tool, so it names in-tree files with no evasive intent; the \\?\ prefix
    // is the extended-length spelling of the same drive path.
    const gitBash = `/${REPO[0].toLowerCase()}${REPO.slice(2).replace(/\\/g, '/')}/README.md`;
    assertDeniedAt(REPO, STRICT, `rm ${gitBash}`, PATHMUT);
    assertDeniedAt(REPO, STRICT, `Remove-Item \\\\?\\${path.join(REPO, 'README.md')}`, PATHMUT);
    // An 8.3 short name and a UNC share spelling of an in-tree path are
    // accepted misses: placing them needs filesystem round-trips.
    assertAllowedAt(REPO, STRICT, `rm \\\\localhost\\${REPO[0].toLowerCase()}\\README.md`);
});

test('a directory switch inside the command moves the base for relative operands', () => {
    assertDeniedAt(REPO, STRICT, 'cd test && rm ../README.md', PATHMUT);
    assertDeniedAt(REPO, STRICT, 'cd .kit && rm ../README.md', PATHMUT);
    assertDeniedAt(REPO, STRICT, 'cd test && echo x > ../README.md', WRITE);
    assertDeniedAt(REPO, STRICT, 'pushd test; rm ../README.md', PATHMUT);
    // .kit/ is writable from anywhere, and a switch target routed through a
    // variable is unknowable before the shell runs, which allows.
    assertAllowedAt(REPO, STRICT, 'cd test && echo x > ../.kit/report.md');
    assertAllowedAt(REPO, STRICT, 'cd $TARGET && rm ../README.md');
});

test('a literal switch target that does not resolve still gets the path check', () => {
    // A failed literal cd cannot move the shell out of the tree: with ; the
    // shell does not move at all, and with && an earlier command in the chain
    // may create the directory before the switch runs, so both candidate bases
    // are judged instead of skipping the containment check. Only a target the
    // guard genuinely cannot know (cd $TARGET above) skips it.
    assertDeniedAt(REPO, STRICT, 'mkdir -p tmp && cd tmp && rm ../README.md', PATHMUT);
    assertDeniedAt(REPO, STRICT, 'cd nosuchdir; rm README.md', PATHMUT);
    assertDeniedAt(REPO, STRICT, 'cd nosuchdir; echo x > README.md', WRITE);
    assertDeniedAt(REPO, STRICT, 'cd no-such-directory && rm ../README.md', PATHMUT);
    assertDeniedAt(REPO, GATE, 'cd bin; rm -rf ../plugins', PATHMUT);
});

test('a governed command keeps its identity when pathed, suffixed, or escaped', () => {
    denyAll(STRICT, [
        ['\\git commit -m x', GIT],
        ['/usr/bin/git commit -m x', GIT],
        ['git.exe commit -m x', GIT],
        ['./node_modules/.bin/prettier --write .', /a formatter run/],
        ['dotnet-format', /a formatter run/],
        ['/bin/rm -rf src', PATHMUT],
        ['/bin/sh -c "git commit -m x"', NESTED],
    ]);
    // A verb split by quoting or assembled through a variable stays allowed, as
    // the accepted-misses comment records.
    allowAll(STRICT, ['"git" commit -m x', "g'i't commit -m x", 'git${IFS}commit',
        '/usr/bin/git diff', 'git.exe log -p']);
});

test('escaped quotes do not hide a mutation', () => {
    denyAll(STRICT, [
        ['sh -c "sh -c \\"git commit\\""', NESTED],
        ['echo \\" ; git commit -m x', GIT],
        ['echo \\"quoted\\" && rm src/x', PATHMUT],
    ]);
});

test('a top-level backslash escapes any character, the single quote included', () => {
    // Bash reads a top-level \' as a literal quote; a masker that only honors
    // " \ $ ` there opens a phantom span that blanks the rest of the command
    // while the shell runs it.
    denyAll(STRICT, [
        [String.raw`echo \' ; git commit -m x`, GIT],
        [String.raw`echo \' && rm -rf plugins`, PATHMUT],
        [String.raw`echo \' ; rm -rf .`, PATHMUT],
    ]);
    // Inside a double-quoted span only " \ $ ` are escapable, so a Windows
    // separator survives the quoting and the operand still classifies in-tree.
    assertDenied(STRICT, String.raw`Set-Content -Path "src\file" -Value x`, PATHMUT);
});

test('a nested executor beyond a shell is judged the same way', () => {
    denyAll(STRICT, [
        ['claude -p "git commit -m x"', NESTED],
        ['claude --print "rm -rf src"', NESTED],
        ['bash <<< "git commit -m x"', NESTED],
        ['pwsh -EncodedCommand ZwBpAHQA', /an encoded command/],
        ['powershell -enc ZwBpAHQA', /an encoded command/],
    ]);
    allowAll(STRICT, ['claude -p "review the diff and report"', 'bash <<< "git diff"']);
});

test('a >| redirect is still a redirect', () => {
    assertDenied(STRICT, 'echo x >| plugins/x.js', WRITE);
    assertAllowed(STRICT, 'echo x >| .kit/report.md');
});

test('truncate empties a file, so it is a destructive command', () => {
    for (const agent of [STRICT, GATE]) {
        assertDenied(agent, 'truncate -s 0 plugins/x.js', PATHMUT);
        assertAllowed(agent, 'truncate -s 0 .kit/log.txt');
    }
});

test('the gate-runner allowance covers no commonly tracked directory', () => {
    denyAll(GATE, [
        ['rm -rf dist', PATHMUT],
        ['rm -rf coverage', PATHMUT],
        ['rm -rf docs', PATHMUT],
        ['rm package-lock.json', PATHMUT],
    ]);
    allowAll(GATE, ['rm -rf bin', 'rm -rf obj', 'rm -rf .vs', 'rm -rf TestResults', 'rm -rf node_modules']);
});

test('ungoverned agent types allow a command a strict agent is denied', () => {
    for (const t of ['claude-kit:implementer-opus', 'claude-kit:implementer-sonnet', 'claude',
        'claude-kit:docs-curator', 'general-purpose', 'Explore', 'some-unknown-type']) {
        assertAllowed(t, 'git commit -m x');
    }
});

test('an absent agent type allows (main session)', () => {
    assertAllowed(null, 'git commit -m x');
});

test('unparseable payload fails open', () => {
    const r = spawnSync(process.execPath, [GUARD], { input: 'not json', encoding: 'utf8' });
    assert.strictEqual(r.stderr, '');
    assert.strictEqual(r.status, 0);
});

test('a payload with no command fails open', () => {
    const r = runGuard({ tool_name: 'Bash', agent_type: STRICT, cwd: CWD, tool_input: {} });
    assert.strictEqual(r.stderr, '');
    assert.strictEqual(r.status, 0);
});

test('a payload with no cwd keeps the path-independent heuristics only', () => {
    const noCwd = command => runGuard({ tool_name: 'Bash', agent_type: STRICT, tool_input: { command } });
    const reasons = [
        ['git commit -m x', GIT],
        ['gh pr merge 1', /a pull-request mutation \(gh pr merge\)/],
        ['dotnet format', /a formatter run/],
        ['npm install', /a package-manager mutation/],
    ];
    for (const [command, reason] of reasons) {
        const r = noCwd(command);
        assert.strictEqual(r.status, 2, `expected deny without a cwd: ${command}`);
        assert.match(r.stderr, reason, `wrong reason without a cwd: ${command}`);
    }
    for (const command of ['echo x > src/file', 'rm -rf src']) {
        const r = noCwd(command);
        assert.strictEqual(r.stderr, '', `expected no stderr without a cwd: ${command}`);
        assert.strictEqual(r.status, 0, `a path cannot be placed without a cwd: ${command}`);
    }
});

test('camelCase and subagent_type identity fields resolve too', () => {
    for (const field of ['agentType', 'subagent_type', 'subagentType']) {
        const p = { tool_name: 'Bash', cwd: CWD, tool_input: { command: 'git commit -m x' } };
        p[field] = STRICT;
        assert.strictEqual(runGuard(p).status, 2, `expected deny via ${field}`);
    }
});

test('the denial names the agent and the correct moves', () => {
    const r = runGuard(bash(STRICT, 'git checkout main'));
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, /claude-kit:adversarial-reviewer/);
    assert.match(r.stderr, /a git state change \(git checkout\)/);
    assert.match(r.stderr, /final message/);
    assert.match(r.stderr, /\.kit\//);
    assert.match(r.stderr, /orchestrator/);
});

test('the encoded-command flag is a PowerShell spelling, not bash flag bundling', () => {
    // -ec is how bash bundles -e -c, so the check is scoped to a PowerShell
    // invocation. A bundled bash payload is still judged on what it runs.
    allowAll(STRICT, ["bash -ec 'git diff | head'", "sh -ec 'rg foo src'", 'bash -e -c "git log"']);
    denyAll(STRICT, [
        ['pwsh -EncodedCommand aGk=', /an encoded command/],
        ['powershell -enc aGk=', /an encoded command/],
        ['pwsh -ec aGk=', /an encoded command/],
        ["bash -ec 'git commit -m x'", NESTED],
    ]);
});

test('a newline ends a command, so the next line is not an operand of this one', () => {
    // Without the line break in the segment cut, the gate class's canonical clean
    // reads "dotnet" as an operand of rm, and a strict agent tidying its own
    // scratch reads "rg" the same way. Both are routine, so the over-block would
    // land on day one.
    allowAll(GATE, ['rm -rf obj\ndotnet build', 'rm -rf bin\r\ndotnet test']);
    allowAll(STRICT, ['rm .kit/tmp.md\nrg pattern plugins/', 'cat src/a\nls src']);
    // A mutation on any line is still caught.
    denyAll(STRICT, [
        ['git log\ngit checkout main', GIT],
        ['rg foo src\nrm src/x.cs', PATHMUT],
    ]);
});

test('naming a ref to create is a mutation, filtering on one is a read', () => {
    denyAll(STRICT, [
        ['git branch scratch-branch', /a git branch creation/],
        ['git branch feature/x main', /a git branch creation/],
        ['git tag v9.9.9', /a git tag creation/],
        ['git tag -u KEYID v1', /a git tag mutation/],
    ]);
    allowAll(STRICT, ['git branch', 'git branch --list', 'git branch -a', 'git branch -r',
        'git branch -v', 'git branch --contains abc', 'git branch --merged main',
        'git branch --points-at HEAD', 'git branch --sort=-committerdate',
        'git tag', 'git tag -l', 'git tag --list "v*"', 'git tag --contains abc',
        'git tag --points-at HEAD', 'git tag --sort=-creatordate']);
});

test('the modern bisect aliases mutate like the ones they replace', () => {
    denyAll(STRICT, [
        ['git bisect new', /a git bisect mutation/],
        ['git bisect old', /a git bisect mutation/],
    ]);
    allowAll(STRICT, ['git bisect log', 'git bisect view', 'git bisect terms']);
});

test('the dotnet project mutators are package mutations for both classes', () => {
    for (const agent of [STRICT, GATE]) {
        denyAll(agent, [
            ['dotnet add package Newtonsoft.Json', /a package-manager mutation \(dotnet add\)/],
            ['dotnet remove package Foo', /a package-manager mutation \(dotnet remove\)/],
            ['dotnet new classlib -o src/Foo', /a package-manager mutation \(dotnet new\)/],
        ]);
        allowAll(agent, ['dotnet build', 'dotnet test', 'dotnet restore', 'dotnet --version']);
    }
});

test('a writable directory counts at any depth, not only at the repo root', () => {
    // .kit/ is gitignored wherever it sits, and a solution's build output lives at
    // src/<project>/obj as readily as at obj.
    assertAllowedAt(REPO_SUBDIR, STRICT, 'echo x > .kit/notes.md');
    allowAll(STRICT, ['echo x > src/Foo/.kit/notes.md']);
    allowAll(GATE, ['rm -rf src/Foo/obj', 'rm -rf src/Foo/bin', 'echo x > src/Foo/obj/build.log']);
    // The allowance is still scoped to those names.
    denyAll(GATE, [['rm -rf src/Foo/Models', PATHMUT]]);
    denyAll(STRICT, [['rm -rf src/Foo/obj', PATHMUT]]);
});

test('cp reads its destination from -t when the invocation carries one', () => {
    allowAll(STRICT, ['cp -t .kit src/a.cs', 'cp --target-directory=.kit src/a.cs',
        'cp src/a.cs .kit/a.cs']);
    denyAll(STRICT, [
        ['cp -t src/Models .kit/a.cs', PATHMUT],
        ['cp --target-directory=src .kit/a.cs', PATHMUT],
    ]);
});

test('the governed agents are granted no file-writing tool', () => {
    for (const name of ['adversarial-reviewer', 'blind-reviewer', 'security-reviewer',
        'council-member', 'design-facilitator', 'consultant', 'qa-verifier']) {
        const text = fs.readFileSync(path.join(AGENTS, `${name}.md`), 'utf8');
        const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
        assert.ok(fm, `${name}.md has no frontmatter`);
        const line = /^tools:[ \t]*(.+)$/m.exec(fm[1]);
        assert.ok(line, `${name}.md declares no tools list`);
        const granted = line[1].split(',').map(s => s.trim());
        // NotebookEdit belongs in this list for the same reason the other three
        // do: hooks.json matches the guard on Bash and PowerShell only, so any
        // file-writing tool granted here writes outside the guard's scope
        // entirely and the shell denylist never sees it.
        for (const tool of ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']) {
            assert.ok(!granted.includes(tool), `${name}.md grants ${tool}, so the guard's shell-only scope no longer covers it`);
        }
    }
});

// These agents' effort is a literal committed skills cite as load-bearing:
// executing-work's reviewer-effort table calls `high` the frontmatter default
// that keeps a fable-tier dispatch off the Workflow route, finishing-work says
// the same of the finishing gate, and the consult skill says the same of the
// consultant. Reverting one of these lines to `medium` would leave the whole
// suite green while the gate silently dropped a notch and the skills asserted a
// value no longer true, which is the same gap the third doctrine-parity test
// closes for the doctrine's own grant.
test('the reviewers and the consultant pin the effort the skills cite as their frontmatter default', () => {
    for (const name of ['adversarial-reviewer', 'blind-reviewer', 'security-reviewer', 'consultant']) {
        const text = fs.readFileSync(path.join(AGENTS, `${name}.md`), 'utf8');
        const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
        assert.ok(fm, `${name}.md has no frontmatter`);
        const line = /^effort:[ \t]*(\S+)[ \t]*$/m.exec(fm[1]);
        assert.ok(line, `${name}.md declares no effort, so it inherits the session's and the `
            + 'skills\' "frontmatter default" claim is no longer true of it');
        assert.strictEqual(line[1], 'high', `${name}.md pins effort ${line[1]}, but `
            + 'the dispatching skills name `high` as this agent\'s '
            + 'frontmatter default; change the skills too, or restore the pin');
    }
});

// A heredoc body is data the receiving command reads on stdin, not shell syntax,
// so a > inside one is a comparison or an arrow rather than a redirect. The guard
// blanks that operator and nothing else: command-position scanning runs over the
// body untouched, which is why a body reaching a shell is still governed and why
// no receiver list is needed. The deny cases below carry most of the weight, since
// the narrow mechanism is what makes the introduction-matching imprecision
// affordable, and each of them passes only because the operator is all that moved.

test('a quoted heredoc body carrying > is data rather than a redirect', () => {
    const r = runGuard(bash(STRICT, "node <<'EOF'\nconst f = (a) => a > 1;\nconsole.log(f(2) >= 1);\nEOF"));
    assert.strictEqual(r.status, 0, r.stderr);
    assert.strictEqual(r.stderr, '');
});

// The blanking reaches the redirect operator and nothing else, so every shape
// below still denies on the verb. That is the property the imprecision rides on:
// a body reaching a shell is a command wherever it sits, and no spelling of a
// heredoc can hide one.

test('a mutating verb inside a heredoc body is still scanned', () => {
    const r = runGuard(bash(STRICT, "cat <<'EOF'\ngit commit -m x\nEOF"));
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, GIT);
});

test('a heredoc body piped onward to a shell is still governed', () => {
    const r = runGuard(bash(STRICT, "cat <<'EOF' | sh\ngit commit -am pwn\nEOF"));
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, GIT);
});

test('a here-string is not a heredoc introduction and disarms nothing', () => {
    const r = runGuard(bash(STRICT, 'grep -q docs <<< "$out"\necho hi > README.md'));
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, WRITE);
});

test('a delimiter carrying text outside the quotes blanks nothing', () => {
    const r = runGuard(bash(STRICT, "cat <<'EOF'X\nfiller\nEOFX\necho hi > README.md"));
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, WRITE);
});

test('a split delimiter blanks nothing either', () => {
    const r = runGuard(bash(STRICT, "cat <<'E'OF\nfiller\nEOF\necho hi > README.md"));
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, WRITE);
});

test('a backslash-continued introducing line keeps its redirect', () => {
    const r = runGuard(bash(STRICT, "cat <<'EOF' \\\n> README.md\nhi\nEOF"));
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, WRITE);
});

test('a blanked body redirect still ends an operand list', () => {
    const r = runGuard(bash(STRICT, "# <<'A'\ncp /etc/hosts README.md > /dev/null"));
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, PATHMUT);
});

test('a blanked body redirect cannot push a ref creation past its flags', () => {
    const r = runGuard(bash(STRICT, "# <<'A'\ngit branch pwned > --list"));
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, /a git branch creation/);
});

test('an introduction in comment position cannot hide a verb', () => {
    const r = runGuard(bash(STRICT, "# <<'A'\ngit commit -am pwn\nA"));
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, GIT);
});

test('a heredoc into a nested shell is code, and stays governed', () => {
    const r = runGuard(bash(STRICT, "bash <<'EOF'\ngit commit -m x\nEOF"));
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, GIT);
});

test('an unquoted heredoc body still expands, so it stays scanned', () => {
    const r = runGuard(bash(STRICT, 'cat <<EOF\n$(git commit -m x)\nEOF'));
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, GIT);
});

test('the redirect on a heredoc intro line is outside the body and still denies', () => {
    const r = runGuard(bash(STRICT, "cat > README.md <<'EOF'\nhello\nEOF"));
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, WRITE);
});

test('the terminator ends the blanking, so a command after it is still scanned', () => {
    const r = runGuard(bash(STRICT, "cat <<'EOF' > .kit/scratch.txt\nhello\nEOF\ngit commit -m x"));
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, GIT);
});
