#!/usr/bin/env node
// PreToolUse guard: the state under review is not the reviewer's to change.
//
// The kit's access model, by agent class:
//   Strict (adversarial-reviewer, blind-reviewer, security-reviewer,
//   council-member, design-facilitator, consultant, blind-reader,
//   prose-reviewer): the repo tree is read-only. Git and GitHub state
//   changes, writes into the tree, file mutations (delete, move, copy,
//   create, chmod), package installs, and formatters are all denied.
//   Gate-runner (qa-verifier): it builds and runs the suites, so inside a fixed
//   list of build-output directories (bin, obj, TestResults, node_modules, .vs),
//   matched at any depth, it may write and delete freely. Everywhere else in the
//   repo it may not write, delete, move, rename, or overwrite an existing file,
//   and git state, GitHub state, package installs that rewrite a lockfile, and
//   formatters are denied to it as well. That directory list is a policy
//   assumption, not a fact the guard checks: a repo that tracks content under one
//   of those names gets no protection there.
//   Every other agent type, and the main session, is untouched.
// The invariant is the state under review, and .kit/ (gitignored) is scratch
// space both classes may write.
//
// Plugin PreToolUse hooks fire for tool calls made inside subagents, and the
// payload carries the subagent identity, so the guard keys on the caller's role.
// Reads stay open by construction (a denylist blocks only what it names): git
// diff, git log, git grep, git merge-base, rg, dotnet build, dotnet test,
// node --test, and a redirect into .kit/ all run.
//
// Command text is analyzed against a quote-masked copy of itself: every
// position-finding pattern (a command name, a redirect operator, a segment
// separator) runs against a string whose quoted spans are blanked out, while
// operand text is read from the original. So a verb or a > inside a quoted
// argument is invisible (rg "the git commit flow" docs/ is a read), while
// echo x > "src/file" is still a write. A nested executor (sh -c, bash -c,
// pwsh -Command, cmd /c, eval, iex, claude -p, a here-string) has its payload
// analyzed recursively within a depth bound, so quoting is not a way around the
// guard.
// Containment is judged against the git root above the payload cwd, and relative
// operands resolve against any cd or Set-Location the command performs first, so
// neither a subdirectory cwd nor a directory switch moves a repo path out of
// scope.
//
// SAFETY: this hook can BLOCK a tool call, so it fails OPEN. Any parse error,
// unrecognized payload, missing command, unidentifiable agent, absent cwd, or
// path it cannot positively place in the tree exits 0 (allow). It exits 2 (deny)
// only when certain. A guard bug must never trap legitimate review work.

'use strict';

const fs = require('fs');
const path = require('path');

function readStdin() {
    try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

// The subagent's type, or null for a main-session call or any case we cannot
// positively identify (null means allow: the safe direction for a blocker).
function subagentType(p) {
    const cand = p.agent_type || p.agentType || p.subagent_type || p.subagentType;
    return (typeof cand === 'string' && cand.trim().length) ? cand.trim() : null;
}

// The policy class of an agent type: 'strict', 'gate', or null for every type
// the guard does not govern (implementers, docs-curator, general-purpose,
// Explore, the bare "claude" a background job's main session presents, and any
// unknown type). Matched by suffix so a plugin-namespaced id
// ("claude-kit:blind-reviewer") resolves, and anchored at the end so a longer
// name that merely contains one ("blind-reviewer-helper") does not.
function agentClass(t) {
    if (/(^|[:/])qa-verifier$/i.test(t)) return 'gate';
    if (/(^|[:/])(?:adversarial-reviewer|blind-reviewer|security-reviewer|council-member|design-facilitator|consultant|blind-reader|prose-reviewer)$/i.test(t)) return 'strict';
    return null;
}

// A copy of the command with every character inside a single- or double-quoted
// span replaced by NUL, preserving length so indexes stay usable against the
// original. Backslash escapes follow bash's two context rules, which differ: at
// the top level a backslash escapes ANY following character, so \" and \' are
// literal quotes that neither open nor close a span (a rule that must include
// the single quote, or echo \' opens a phantom span that blanks the rest of the
// command while bash runs it); inside a double-quoted span a backslash escapes
// only " \ $ or `, so a Windows separator ("src\file") stays a literal
// backslash rather than swallowing the next character. The double-quote rule is
// the reason sh -c "sh -c \"...\"" is read as one span rather than flipping
// quote parity for the rest of the line. Single-quoted spans are literal. An
// unterminated quote masks to the end of the string. Quoted text matches no
// pattern, which is what makes a governed verb or a redirect operator inside an
// argument invisible.
function maskQuoted(cmd) {
    const chars = cmd.split('');
    const dqEscapes = /["\\$`]/;
    for (let i = 0; i < chars.length; i++) {
        if (chars[i] === '\\' && i + 1 < chars.length) { i++; continue; }
        const q = chars[i];
        if (q !== '"' && q !== "'") continue;
        let j = i + 1;
        while (j < chars.length && chars[j] !== q) {
            if (q === '"' && chars[j] === '\\' && j + 1 < chars.length && dqEscapes.test(chars[j + 1])) {
                chars[j] = '\x00';
                j++;
            }
            chars[j] = '\x00';
            j++;
        }
        i = j;
    }
    return chars.join('');
}

// A copy of the masked command with the > characters inside a quoted-delimiter
// heredoc body blanked. A heredoc body is data the receiving command reads on
// stdin rather than shell syntax, so a > in one is a comparison or an arrow
// function; read as a redirect operator it denies ordinary work, since writing a
// driver script through a heredoc is how an agent that holds no Write tool
// authors one.
//
// A blanked body redirect keeps its own sentinel rather than the NUL quoted spans
// use, because the two need different treatment downstream: a > is both a
// redirect operator and a command boundary, and only the first reading is wrong
// inside a body. `segment` cuts on the sentinel as it would on the character, so
// an operand list still ends where the shell ends it, while `writeTargets` no
// longer sees a redirect. Erasing the boundary instead would merge a body's
// operands into the command around it, which is how a hidden `>` turns into
// altered parsing for every heuristic that reads operands.
//
// Only the redirect operator is blanked, never the whole span, and that bound is
// what makes the rest of this function's imprecision affordable. Command-position
// scanning runs over the body untouched, so a governed verb inside one still
// denies (the accepted false hit named in denyReason's header) and, more to the
// point, a body that really is a command still denies however it reaches a shell:
// `cat <<'EOF' | sh` needs no special case here, because the verb inside it was
// never hidden. The residual this leaves is a hidden redirect, and a redirect
// that lands leaves a tracked-file delta, which is exactly what the tree-state
// check around a review round sees. A hidden git or gh mutation would not, and
// nothing here can hide one.
//
// Only the quoted spellings (<<'EOF', <<"EOF") qualify. Both disable parameter
// expansion and command substitution, so their bodies are literal; an unquoted
// <<EOF still runs $(...) in its body and is left entirely alone.
//
// Three bounds keep the blanking near the body. A << preceded by another < is a
// here-string operand, not an introduction. The delimiter must be a whole word,
// so the desyncing spellings bash reads differently (<<'EOF'X, <<'E'OF) match
// nothing here and blank nothing. And the body starts after the introducing line,
// so a redirect on that line (cat > path <<'EOF', and the continuation case
// above) stays visible. What is left imprecise on purpose: a <<'X' sitting in
// comment or data position starts a span here that the shell never opens, so a
// redirect after it can go unseen. That costs a hidden file write, which the
// tree-state check catches, and buying it back would mean tracking comments and
// nested bodies through the mask.
const BODY_REDIRECT = '\x01';
function maskHeredocRedirects(cmd, masked) {
    const chars = masked.split('');
    const intro = /(?<!<)<<-?[ \t]*(?:'([^'\n]*)'|"([^"\n]*)")(?=[ \t\r\n;|&)]|$)/g;
    let m;
    while ((m = intro.exec(cmd)) !== null) {
        if (masked[m.index] === '\x00') continue;
        const delim = m[1] !== undefined ? m[1] : m[2];
        if (delim === '') continue;
        // The body opens after the introducing LOGICAL line, so a backslash
        // continuation carries it further: the shell removes the backslash and
        // the newline before it reads a body at all, which leaves any redirect
        // on the continued line genuine shell syntax rather than data. An even
        // run of trailing backslashes is an escaped backslash, not a
        // continuation.
        let nl = cmd.indexOf('\n', m.index + m[0].length);
        while (nl >= 0) {
            const trail = /\\+$/.exec(cmd.slice(0, nl));
            if (trail === null || trail[0].length % 2 === 0) break;
            nl = cmd.indexOf('\n', nl + 1);
        }
        if (nl < 0) continue;
        const esc = delim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const t = new RegExp('^[ \\t]*' + esc + '[ \\t]*\\r?$', 'm').exec(cmd.slice(nl + 1));
        const end = t === null ? cmd.length : nl + 1 + t.index;
        for (let i = nl + 1; i < end; i++) if (chars[i] === '>') chars[i] = BODY_REDIRECT;
    }
    return chars.join('');
}

// One command out of a chain, pipeline, or multi-line script: the original text
// from `from` up to the next unquoted shell separator, redirect, or line break.
// The cut is found in the masked copy, so a separator inside a quoted argument
// (sed -i 's/a/b/;s/c/d/' src/x) does not truncate the operand list. A newline
// ends a command as surely as a semicolon; without it the next line's command
// name reads as an operand of this one.
function segment(cmd, masked, from) {
    const cut = masked.slice(from).search(/[;|&<>)\r\n\x01]/);
    return cut < 0 ? cmd.slice(from) : cmd.slice(from, from + cut);
}

// One token with its surrounding quotes removed. Inside double quotes a backslash
// before " \ $ or ` escapes that character, so one level of quoting is undone the
// way the shell would undo it; a Windows path separator (src\file) is left alone.
function unquote(t) {
    if (t.length > 1 && t.startsWith('"') && t.endsWith('"')) {
        return t.slice(1, -1).replace(/\\(["\\$`])/g, '$1');
    }
    if (t.length > 1 && t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1);
    return t.replace(/^["']|["']$/g, '');
}

// Whitespace-separated tokens of a segment, unquoted.
function tokens(seg) {
    return (seg.match(/"(?:\\.|[^"\\])*"|'[^']*'|\S+/g) || []).map(unquote);
}

// Every index just past an occurrence of one of `names` in command position
// (start of string, or after whitespace or a shell separator) in the masked
// command, paired with the matched name, lowercased. An invocation may carry a
// leading backslash (\git), a directory prefix (/usr/bin/git,
// ./node_modules/.bin/prettier), and an executable suffix (git.exe), since all
// three are ordinary ways to name the same command. Residual false hit, accepted:
// an operand whose final path element is exactly a governed name (wc -l docs/rm)
// reads as an invocation, which matters only if a following operand then places
// in the tree. The mask keeps a name inside a quoted argument from matching at
// all.
function commandPositions(masked, names) {
    const re = new RegExp(
        `(?:^|[\\s;|&(])\\\\?(?:[^\\s;|&(]*[\\\\/])?(${names.join('|')})(?:\\.(?:exe|cmd|bat|ps1))?(?=\\s|$)`,
        'gi'
    );
    const out = [];
    let m;
    while ((m = re.exec(masked)) !== null) out.push({ name: m[1].toLowerCase(), at: m.index + m[0].length });
    return out;
}

// Directories inside the repo a class may mutate freely. .kit/ is gitignored
// scratch for both classes. The gate-runner list is the .NET and Node build
// output a gate legitimately clears; dist and coverage are deliberately absent
// because both are commonly tracked, while bin is present because rm -rf bin obj
// is the canonical clean in this kit's default stack.
const KIT_ONLY = ['.kit'];
const GATE_OUTPUT_DIRS = ['.kit', 'bin', 'obj', 'testresults', 'node_modules', '.vs'];

// The git root at or above `dir`: the nearest ancestor holding a .git entry, or
// `dir` itself when there is none. Containment is judged against this rather than
// against the payload cwd, so a subagent working from a subdirectory cannot reach
// the rest of the tree through a relative path (rm ../README.md).
function repoRoot(dir) {
    let cur = dir;
    for (let i = 0; i < 64; i++) {
        try { if (fs.existsSync(path.join(cur, '.git'))) return cur; } catch { return dir; }
        const parent = path.dirname(cur);
        if (parent === cur) break;
        cur = parent;
    }
    return dir;
}

// The target of the last cd / pushd / Set-Location before position `end`, or null
// when the command switches no directory ahead of that point. The verbs are found
// in the masked copy, so one named inside a quoted argument does not count.
function lastPathSwitchBefore(cmd, masked, end) {
    const re = /(?:^|[\s;&|(])(?:cd|pushd|chdir|Set-Location|sl)(?=\s)/gi;
    let target = null;
    let m;
    while ((m = re.exec(masked)) !== null) {
        if (m.index >= end) break;
        const t = /^\s*("[^"]*"|'[^']*'|[^\s;&|)]+)/.exec(cmd.slice(m.index + m[0].length));
        if (t) target = t[1];
    }
    return target;
}

// The candidate directories a mutation at `at` could run in. With no directory
// switch ahead of it, the payload cwd. A switch to a literal target that
// resolves to a real directory moves the base there. A literal target that does
// not resolve (the directory does not exist yet, or names a file) yields two
// candidates, because a failed literal cd cannot move the shell out of the
// tree, only deeper into it or nowhere at all: the target as it would resolve
// (an earlier command in the chain may create it, mkdir -p tmp && cd tmp) and
// the cwd itself (with ; a failed cd leaves the shell exactly where it was). A
// target routed through a variable or a backtick is unknowable before the shell
// runs, so no candidate is returned and the caller allows.
function effectiveDirs(cmd, masked, at, cwd) {
    const target = lastPathSwitchBefore(cmd, masked, at);
    if (target === null) return [cwd];
    const bare = unquote(target);
    if (!bare || bare.startsWith('-') || /[$%`]/.test(bare)) return [];
    let resolved;
    try { resolved = path.resolve(cwd, bare); } catch { return []; }
    try {
        if (fs.statSync(resolved).isDirectory()) return [resolved];
    } catch { /* not a directory today: judge both candidates below */ }
    return [resolved, cwd];
}

// A target path resolved against `base`, with the alternate spellings of an
// absolute path normalized first: a \\?\ extended-length prefix on a drive path
// is stripped, and on a Windows host the Git-Bash form /<drive>/<rest> becomes
// <drive>:/<rest> (it is what pwd prints inside the Bash tool, so it names
// in-tree files with no evasive intent). Null for everything that cannot be
// resolved before the shell runs, which is the fail-open direction: a
// descriptor dup (2>&1), a path built through a shell or environment variable,
// a home-relative path, the null device.
function resolveTarget(raw, base) {
    let s = String(raw || '').trim().replace(/^["']|["']$/g, '');
    if (!s) return null;
    if (s.startsWith('&')) return null;                       // a descriptor, not a path
    if (/^\\\\\?\\[A-Za-z]:/.test(s)) s = s.slice(4);         // extended-length prefix
    if (path.sep === '\\' && /^\/[A-Za-z]\//.test(s)) s = `${s[1]}:${s.slice(2)}`;
    if (/[$%`]/.test(s) || s.startsWith('~')) return null;    // unresolvable before the shell runs
    if (/^(?:\/dev\/null|nul)$/i.test(s)) return null;        // the null device
    try { return path.resolve(base, s); } catch { return null; }
}

// True when a target path lands in the tree under review: inside `root` and
// outside the class's writable directories, or an ancestor of `root`, since
// deleting an ancestor takes the tree with it. Relative operands resolve against
// `base`, the directory the command runs in. False for everything the guard
// cannot positively place in the tree.
function inTreeTarget(raw, base, root, writable) {
    const resolved = resolveTarget(raw, base);
    if (resolved === null) return false;
    const outward = p => path.isAbsolute(p) || /^\.\.(?:[\\/]|$)/.test(p);
    const rel = path.relative(root, resolved);
    if (rel === '') return true;                              // the repo root itself
    // A writable directory counts at any depth, not only at the repo root: .kit/
    // is gitignored wherever it sits, and a solution's build output lives at
    // src/<project>/obj as readily as at obj.
    if (!outward(rel)) {
        return !rel.split(/[\\/]/).some(part => writable.includes(part.toLowerCase()));
    }
    return !outward(path.relative(resolved, root));           // an ancestor of the repo
}

// True when a target resolves to something that already exists on disk. The
// overwrite rule for the creating commands hangs on this: creating a new file
// is visible in git status, overwriting an existing one destroys its content. A
// stat failure reads as not-there, the fail-open direction.
function targetExists(raw, base) {
    const resolved = resolveTarget(raw, base);
    if (resolved === null) return false;
    try { return fs.existsSync(resolved); } catch { return false; }
}

// git subcommands that always change repo, index, worktree, or remote state.
// Whole-token comparison, never a word-boundary regex: "merge-base" is a read a
// reviewer runs constantly to resolve a base ref, and a \b alternation on "merge"
// would match it. symbolic-ref is absent deliberately: reading the current branch
// (git symbolic-ref --quiet --short HEAD) is a read the kit's own hooks run.
// Three entries are deliberate over-blocks, because the mutating form is the
// dangerous one and the read-only form is cheap to lose: "stash" (a reviewer
// stashing the diff under review is the catastrophic case, so git stash list goes
// with it), "clean" (git clean -nd only lists), and "apply" (git apply --check
// only validates).
const GIT_MUTATIONS = new Set([
    'add', 'am', 'apply', 'checkout', 'checkout-index', 'cherry-pick', 'clean',
    'clone', 'commit', 'filter-branch', 'gc', 'init', 'merge', 'mergetool', 'mv',
    'prune', 'pull', 'push', 'read-tree', 'rebase', 'reset', 'restore', 'revert',
    'rm', 'sparse-checkout', 'stash', 'switch', 'update-index', 'update-ref',
]);

// git global flags that take their value as a separate following token. An
// =-joined form (--git-dir=x) is one token and consumes nothing, so the
// subcommand after it is still read correctly.
const GIT_VALUE_FLAGS = /^(?:-C|-c|--git-dir|--work-tree|--namespace|--exec-path|--config-env)$/;

// A short description of the git state mutation in the command, or null when
// every git invocation in it is a read. Scans the whole string, so a chain
// (git diff && git checkout main) is judged on its worst member, and skips the
// global flags between "git" and the subcommand (git -C . commit,
// git --no-pager checkout). Reads stay allowed, including the ones that share a
// prefix with a mutation (merge-base, ls-files), the read subverbs of the
// subcommands that do both (git submodule status, git bisect log, git branch
// --list), and an invocation asking for help. fetch, remote, and config are
// deliberately absent: they touch no tracked file in the tree under review, and
// resolving a base ref (git fetch origin, git config --get) is review work.
// True when a git branch or tag invocation names a ref to create: it carries a
// bare operand and none of its own read flags, which are the ones that turn an
// operand into a filter (git branch --contains abc) rather than a new name.
function refCreation(rest, readLong, readShort) {
    if (rest.some(a => readLong.test(a) || readShort.test(a))) return false;
    return rest.some(a => !a.startsWith('-'));
}

function gitMutation(cmd, masked) {
    for (const hit of commandPositions(masked, ['git'])) {
        const toks = tokens(segment(cmd, masked, hit.at));
        let i = 0;
        while (i < toks.length && toks[i].startsWith('-')) {
            i += GIT_VALUE_FLAGS.test(toks[i]) ? 2 : 1;
        }
        const sub = (toks[i] || '').toLowerCase();
        if (!sub) continue;
        const rest = toks.slice(i + 1);
        // A help flag is documentation only in the position git itself reads it,
        // immediately after the subcommand. Anywhere later it can be an option's
        // value and the command still acts (git stash push -m "-h" stashes,
        // git clean -fd -e -h deletes with -h as the exclude pattern).
        if (rest[0] === '--help' || rest[0] === '-h') continue;
        if (GIT_MUTATIONS.has(sub)) return `a git state change (git ${sub})`;
        // Subcommands that read in their bare form and mutate either under a flag
        // or by naming a ref to create. Creating a ref is a repo-state change that
        // leaves the worktree byte-identical, so the tree-state check cannot see
        // it; a read flag (--list, --contains, --points-at, --merged, --sort) keeps
        // an operand a filter rather than a new name.
        if (sub === 'branch') {
            if (rest.some(a => /^-[dDmMcCf]$/.test(a) || /^--(?:delete|move|copy|force|set-upstream-to|unset-upstream)/.test(a))) {
                return 'a git branch mutation';
            }
            if (refCreation(rest, /^--(?:list|contains|no-contains|points-at|merged|no-merged|sort|format|all|remotes|verbose)/, /^-[alrvq]+$/)) {
                return 'a git branch creation';
            }
        }
        if (sub === 'tag') {
            if (rest.some(a => /^-[dasmufF]$/.test(a) || /^--(?:delete|annotate|sign|local-user|force|file)/.test(a))) {
                return 'a git tag mutation';
            }
            if (refCreation(rest, /^--(?:list|contains|no-contains|points-at|merged|no-merged|sort|format)/, /^-[lnq]+$/)) {
                return 'a git tag creation';
            }
        }
        // Subcommands that mutate under a subverb, which is their first bare
        // operand: git worktree list, git submodule status, and git bisect log
        // stay reads, and a path that merely contains a verb does not count.
        const subverb = (rest.filter(a => !a.startsWith('-'))[0] || '').toLowerCase();
        if (sub === 'worktree' && /^(?:add|remove|move|prune)$/.test(subverb)) return 'a git worktree mutation';
        if (sub === 'submodule' && /^(?:add|update|deinit|sync|set-url|absorbgitdirs)$/.test(subverb)) return 'a git submodule mutation';
        if (sub === 'bisect' && /^(?:start|good|bad|new|old|skip|reset|run|replay)$/.test(subverb)) return 'a git bisect mutation';
    }
    return null;
}

// gh global flags that take their value as a separate following token, so the
// command group after them is read correctly (gh -R owner/name pr merge).
const GH_VALUE_FLAGS = /^(?:-R|--repo|--json|--jq|--template|--hostname)$/;

// A description of a GitHub state mutation in the command, or null. Merging,
// closing, or commenting on the pull request under review, mutating the
// repository or an issue, dispatching a workflow, or writing a secret or
// variable changes the state the review is about, reaches outside the machine,
// and leaves the worktree byte-identical, so the tree-state check around a
// review round cannot see it. Reads stay allowed: gh pr view, gh pr diff,
// gh run list, and a GET through gh api. gh api's own default method is GET
// normally and POST once any parameter flag adds a field, so a field or body
// flag with no explicit method is a write.
function ghMutation(cmd, masked) {
    for (const hit of commandPositions(masked, ['gh'])) {
        const toks = tokens(segment(cmd, masked, hit.at));
        const bare = [];
        for (let i = 0; i < toks.length; i++) {
            if (toks[i].startsWith('-')) { if (GH_VALUE_FLAGS.test(toks[i])) i++; continue; }
            bare.push(toks[i]);
        }
        const group = (bare[0] || '').toLowerCase();
        const verb = (bare[1] || '').toLowerCase();
        if (group === 'pr' && /^(?:merge|close|edit|comment|review|ready)$/.test(verb)) {
            return `a pull-request mutation (gh pr ${verb})`;
        }
        if (group === 'release' && /^(?:create|delete|edit)$/.test(verb)) {
            return `a release mutation (gh release ${verb})`;
        }
        if (group === 'repo' && /^(?:delete|edit|rename|archive)$/.test(verb)) {
            return `a repository mutation (gh repo ${verb})`;
        }
        if (group === 'workflow' && /^(?:run|enable|disable)$/.test(verb)) {
            return `a workflow mutation (gh workflow ${verb})`;
        }
        if ((group === 'secret' || group === 'variable') && /^(?:set|delete)$/.test(verb)) {
            return `a ${group} mutation (gh ${group} ${verb})`;
        }
        if (group === 'issue' && /^(?:close|edit|comment|delete)$/.test(verb)) {
            return `an issue mutation (gh issue ${verb})`;
        }
        if (group === 'api') {
            let method = null;
            let sendsBody = false;
            for (let i = 0; i < toks.length; i++) {
                const m = /^(?:-X|--method)=?(.*)$/.exec(toks[i]);
                if (m) method = m[1] || toks[i + 1] || null;
                if (/^(?:-f|-F|--field|--raw-field|--input)(?:=|$)/.test(toks[i])) sendsBody = true;
            }
            if (method && !/^get$/i.test(method)) return `a write API call (gh api ${method.toUpperCase()})`;
            if (!method && sendsBody) return 'a write API call (gh api with fields defaults to POST)';
        }
    }
    return null;
}

// Targets of the shell writers that create, overwrite, or truncate a file, each
// paired with the position of the writer so the caller can resolve it against the
// directory that write would run in: a >, >>, or >| redirect (which covers
// heredoc-into-file, cat > path <<EOF), tee, and sed's in-place file operands.
// The operators are located in the masked copy, so a quoted > is not one, while
// each target is read from the original text. A descriptor dup (2>&1, >&2) is
// captured as a target and rejected by the path classifier rather than by the
// operator.
function writeTargets(cmd, masked) {
    const out = [];
    const redirect = />>?\|?/g;
    let m;
    while ((m = redirect.exec(masked)) !== null) {
        const at = m.index + m[0].length;
        const t = /^\s*(&\d*|"[^"]*"|'[^']*'|[^\s;|&<>]+)/.exec(cmd.slice(at));
        if (t) out.push({ target: t[1], at: m.index });
    }
    for (const hit of commandPositions(masked, ['tee'])) {
        for (const t of tokens(segment(cmd, masked, hit.at)).filter(a => !a.startsWith('-'))) {
            out.push({ target: t, at: hit.at });
        }
    }
    for (const hit of commandPositions(masked, ['sed'])) {
        const toks = tokens(segment(cmd, masked, hit.at));
        if (!toks.some(a => /^-i/.test(a) || a === '--in-place')) continue;
        // With -e or -f the script arrives as that flag's value, so every bare
        // operand is a file; with neither, the first bare operand is the script.
        let scripted = false;
        const files = [];
        for (let i = 0; i < toks.length; i++) {
            const t = toks[i];
            if (/^-[ef]$/.test(t) || /^--(?:expression|file)$/.test(t)) { scripted = true; i++; continue; }
            if (/^--(?:expression|file)=/.test(t)) { scripted = true; continue; }
            if (t.startsWith('-')) continue;
            files.push(t);
        }
        for (const t of (scripted ? files : files.slice(1))) out.push({ target: t, at: hit.at });
    }
    return out;
}

// Shell commands that destroy or displace what they name (rm deletes, mv removes
// its source, truncate empties), and the ones that only create or adjust (touch
// and chmod leave content in place). The split is the class boundary: a
// gate-runner may create, and neither class may destroy. cp and the copy/new
// cmdlets sit on both sides of it: aimed at a path that does not exist they
// create, aimed at one that does (or forced) they overwrite and destroy its
// content, so the gate-runner is denied only their overwriting form
// (overwriteTargets below) while the strict class is denied both forms.
const DESTRUCTIVE_CMDS = ['rm', 'rmdir', 'mv', 'truncate'];
const CREATING_CMDS = ['cp', 'touch', 'chmod'];

// The PowerShell cmdlets that write or truncate a file's content, the ones that
// destroy or displace a file, and the ones that only create a copy or a new item.
// Each list carries the standard aliases alongside the canonical names, because
// PowerShell is the primary shell on the hosts this ships to and an alias is what
// a PowerShell-native writer reaches for. Set-Content's alias "sc" is
// deliberately absent: it collides with sc.exe, the Windows service controller,
// and that false positive costs more than the alias covers. Matched in command
// position, so an embedded name (Reset-Content) does not hit.
const PS_WRITE = ['Out-File', 'Set-Content', 'Add-Content', 'ac', 'Clear-Content', 'clc', 'Tee-Object'];
const PS_DESTRUCTIVE = ['Remove-Item', 'ri', 'rd', 'del', 'erase', 'Move-Item', 'mi', 'move', 'Rename-Item', 'ren', 'rni'];
const PS_CREATING = ['Copy-Item', 'cpi', 'copy', 'New-Item', 'ni'];

// The cmdlet names whose destination operand is the only one that matters, since
// they leave their source in place.
const PS_COPY_NAMES = /^(?:copy-item|cpi|copy)$/;

// Cmdlet parameters whose value is a following token and is never a path, so that
// value is not mistaken for a repo write (-Encoding utf8). Every other parameter
// is treated as a switch (-Force, -Recurse), which leaves the token after it
// available as a positional path.
const PS_VALUE_PARAMS = /^-(?:Encoding|Value|Delimiter|Filter|Include|Exclude|ItemType|Name|NewName|Width|InputObject|Stream)(?::|$)/i;

// A token shaped like a filesystem path: it carries a separator, an extension, or
// a leading dot. Positional operands past the first are filtered through this, so
// a value left over from an unrecognized parameter does not read as a path
// (Out-File -Encoding utf8 <path outside the repo>).
function looksLikePath(s) {
    return /[\\/]/.test(s) || s.startsWith('.') || /\.[A-Za-z0-9]{1,8}$/.test(s);
}

// The operands of one cmdlet invocation: the values of the named path parameters
// (-Path / -FilePath / -LiteralPath / -Destination, joined by a space or a
// colon), and the positional operands in order.
function cmdletOperands(toks) {
    const named = {};
    const positional = [];
    for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        if (!t.startsWith('-')) { positional.push(t); continue; }
        const m = /^-(FilePath|Path|LiteralPath|Destination)(?::(.+))?$/i.exec(t);
        let value = m && m[2] ? m[2] : null;
        const takesNextToken = (m && !value) || PS_VALUE_PARAMS.test(t);
        if (takesNextToken && i + 1 < toks.length && !toks[i + 1].startsWith('-')) {
            if (!value) value = toks[i + 1];
            i++;                       // the token is this parameter's value
        }
        if (m && value) named[m[1].toLowerCase()] = value;
    }
    return { named, positional };
}

// The path operands of a cmdlet invocation that could change the tree. The first
// positional operand of an item cmdlet is PowerShell's -Path parameter, so it
// counts as a path whatever it looks like (Remove-Item test); later positionals
// are filtered by shape.
function cmdletPaths(name, named, positional) {
    if (PS_COPY_NAMES.test(name)) {
        const dest = named.destination || positional[1];
        return (dest && looksLikePath(dest)) ? [dest] : [];
    }
    const out = [named.filepath, named.path, named.literalpath, named.destination].filter(Boolean);
    positional.forEach((t, i) => {
        if (i === 0 || looksLikePath(t)) out.push(t);
    });
    return out;
}

// Flags of a shell mutator whose value is a following token and is not a path to
// be judged: truncate's size, and the reference file it reads to get one.
const SHELL_VALUE_FLAGS = { truncate: /^(?:-s|--size|-r|--reference)$/ };

// The destination of a cp invocation: the value of -t/--target-directory when it
// carries one, else the last bare operand. Only the destination is written, so
// copying a repo file out into scratch is not a mutation of the tree.
function cpDestination(toks) {
    for (let i = 0; i < toks.length; i++) {
        const m = /^(?:-t|--target-directory)(?:=(.+))?$/.exec(toks[i]);
        if (!m) continue;
        if (m[1]) return m[1];
        return i + 1 < toks.length ? toks[i + 1] : null;
    }
    const bare = toks.filter(a => !a.startsWith('-'));
    return bare.length ? bare[bare.length - 1] : null;
}

// Every {name, target, at} the named shell commands and cmdlets in a command
// would change. Operand rules: rm, rmdir, mv, truncate, touch, and the write
// cmdlets change each operand they name (mv deletes its source, so its source
// counts); cp and Copy-Item keep only their destination; chmod's first operand is
// its mode, not a path.
function mutationTargets(cmd, masked, shellNames, cmdletNames) {
    const out = [];
    for (const hit of commandPositions(masked, shellNames)) {
        const toks = tokens(segment(cmd, masked, hit.at));
        const valueFlags = SHELL_VALUE_FLAGS[hit.name] || /^$/;
        let operands = [];
        for (let i = 0; i < toks.length; i++) {
            if (toks[i].startsWith('-')) { if (valueFlags.test(toks[i])) i++; continue; }
            operands.push(toks[i]);
        }
        if (hit.name === 'cp') {
            const dest = cpDestination(toks);
            operands = dest === null ? [] : [dest];
        }
        if (hit.name === 'chmod') operands = operands.slice(1);
        for (const target of operands) out.push({ name: hit.name, target, at: hit.at });
    }
    for (const hit of commandPositions(masked, cmdletNames)) {
        const { named, positional } = cmdletOperands(tokens(segment(cmd, masked, hit.at)));
        for (const target of cmdletPaths(hit.name, named, positional)) {
            out.push({ name: hit.name, target, at: hit.at });
        }
    }
    return out;
}

// Every {name, target, at, force} the creating commands would write, for the
// caller's overwrite check: cp overwrites an existing destination by default
// (unless -n/--no-clobber promises not to), and Copy-Item or New-Item under
// -Force overwrites or truncates whatever sits at the target. `force` carries
// the flag so a forced invocation is judged destructive without a stat.
function overwriteTargets(cmd, masked) {
    const out = [];
    for (const hit of commandPositions(masked, ['cp'])) {
        const toks = tokens(segment(cmd, masked, hit.at));
        if (toks.some(a => a === '-n' || a === '--no-clobber')) continue;
        const dest = cpDestination(toks);
        if (dest !== null) out.push({ name: 'cp', target: dest, at: hit.at, force: false });
    }
    for (const hit of commandPositions(masked, PS_CREATING)) {
        const toks = tokens(segment(cmd, masked, hit.at));
        const force = toks.some(a => /^-Force$/i.test(a));
        const { named, positional } = cmdletOperands(toks);
        for (const target of cmdletPaths(hit.name, named, positional)) {
            out.push({ name: hit.name, target, at: hit.at, force });
        }
    }
    return out;
}

// Commands a bulk idiom drives whose operands are filenames from somewhere else,
// so no path in the command text can be classified.
const BULK_MUTATORS = /^(?:rm|rmdir|mv|truncate|chmod|remove-item|ri|rd|del|erase|move-item|mi|rename-item|ren|rni|clear-content|clc)$/;

// A description of a bulk delete or rewrite, or null. git ls-files | xargs rm and
// Get-ChildItem -Recurse | Remove-Item each remove the whole tracked worktree
// while naming no path at all, which is why the idiom is judged rather than its
// operands. Both classes are denied it.
function bulkMutation(cmd, masked) {
    for (const hit of commandPositions(masked, ['find'])) {
        const toks = tokens(segment(cmd, masked, hit.at));
        if (toks.includes('-delete')) return 'a bulk delete (find -delete)';
        for (let i = 0; i < toks.length; i++) {
            if (toks[i] !== '-exec' && toks[i] !== '-execdir') continue;
            const verb = (toks[i + 1] || '').toLowerCase();
            if (BULK_MUTATORS.test(verb) || verb === 'sed') return `a bulk mutation (find ${toks[i]} ${verb})`;
        }
    }
    for (const hit of commandPositions(masked, ['xargs'])) {
        const toks = tokens(segment(cmd, masked, hit.at));
        const bare = [];
        for (let i = 0; i < toks.length; i++) {
            const t = toks[i];
            if (t.startsWith('-')) { if (/^-(?:n|I|P|L|d|E|s|a)$/.test(t)) i++; continue; }
            bare.push(t);
        }
        const verb = (bare[0] || '').toLowerCase();
        if (BULK_MUTATORS.test(verb)) return `a piped mutation (xargs ${verb})`;
        if (verb === 'sed' && toks.some(a => /^-i/.test(a) || a === '--in-place')) return 'a piped mutation (xargs sed -i)';
        if (verb === 'git' && GIT_MUTATIONS.has((bare[1] || '').toLowerCase())) return `a piped mutation (xargs git ${bare[1]})`;
    }
    // A destructive cmdlet downstream of a pipe with no path operand takes its
    // items from the pipeline (Get-ChildItem plugins -Recurse | Remove-Item).
    for (const hit of commandPositions(masked, PS_DESTRUCTIVE)) {
        if (masked.lastIndexOf('|', hit.at) < 0) continue;
        const { named, positional } = cmdletOperands(tokens(segment(cmd, masked, hit.at)));
        if (cmdletPaths(hit.name, named, positional).length === 0) return `a piped mutation (${hit.name} from a pipeline)`;
    }
    return null;
}

// Package-manager global flags that take their value as a separate following
// token, so the verb after them is still read correctly (npm --prefix . install).
const PKG_VALUE_FLAGS = /^(?:--prefix|-C|--workspace|-w|--registry|--filter|--dir)$/;

// The verb of a command invocation: its first bare operand, skipping flags and
// the values of the flags `valueFlags` names.
function firstVerb(cmd, masked, at, valueFlags) {
    const toks = tokens(segment(cmd, masked, at));
    for (let i = 0; i < toks.length; i++) {
        if (toks[i].startsWith('-')) { if (valueFlags.test(toks[i])) i++; continue; }
        return toks[i].toLowerCase();
    }
    return '';
}

// A description of a package-manager mutation, or null. Installing and updating
// rewrite a tracked lockfile, so both classes are denied them under every verb
// alias npm accepts (npm i, npm up); yarn 1 and pnpm install when run with no
// verb at all, so a bare invocation counts too unless it only asks for the
// version or help. npm ci installs from the lockfile without rewriting it,
// which makes it the gate-runner's legitimate way to prepare a suite run.
// Running the gate is untouched either way: npm test and npm run build pass.
function packageMutation(cmd, masked, strict) {
    for (const hit of commandPositions(masked, ['npm', 'pnpm', 'yarn'])) {
        const verb = firstVerb(cmd, masked, hit.at, PKG_VALUE_FLAGS);
        if (/^(?:i|in|ins|inst|install|add|up|upgrade|update)$/.test(verb)) {
            return `a package-manager mutation (${hit.name} ${verb})`;
        }
        if (verb === 'ci' && strict) return `a package-manager mutation (${hit.name} ci)`;
        if (!verb && /^(?:pnpm|yarn)$/.test(hit.name)) {
            const toks = tokens(segment(cmd, masked, hit.at));
            if (!toks.some(a => /^(?:--version|-v|--help|-h)$/i.test(a))) {
                return `a package-manager mutation (a bare ${hit.name} installs)`;
            }
        }
    }
    // The .NET equivalents: add and remove rewrite a tracked project file, and new
    // scaffolds files into the tree. dotnet build, test, restore, and run pass.
    for (const hit of commandPositions(masked, ['dotnet'])) {
        const verb = firstVerb(cmd, masked, hit.at, /^$/);
        if (/^(?:add|remove|new)$/.test(verb)) return `a package-manager mutation (dotnet ${verb})`;
    }
    return null;
}

// A description of a formatter run, or null. A formatter rewrites every tracked
// source file it touches and is no part of running a gate, so both classes are
// denied it: dotnet format in its writing form, prettier with -w/--write, and a
// package script that formats (run format, run fmt, a script named *:fix, or a
// run carrying --fix). Check-only invocations write nothing and are legitimate
// gate steps, so they pass: dotnet build, dotnet test, dotnet format with
// --verify-no-changes or --check, prettier --check, and npm run lint.
function formatterRun(cmd, masked) {
    for (const hit of commandPositions(masked, ['dotnet'])) {
        if (firstVerb(cmd, masked, hit.at, /^$/) !== 'format') continue;
        const toks = tokens(segment(cmd, masked, hit.at));
        if (toks.includes('--verify-no-changes') || toks.includes('--check')) continue;
        return 'a formatter run (dotnet format)';
    }
    if (commandPositions(masked, ['dotnet-format']).length) return 'a formatter run (dotnet-format)';
    for (const hit of commandPositions(masked, ['prettier'])) {
        if (tokens(segment(cmd, masked, hit.at)).some(a => a === '-w' || a === '--write')) return 'a formatter run (prettier --write)';
    }
    for (const hit of commandPositions(masked, ['npm', 'pnpm', 'yarn'])) {
        const toks = tokens(segment(cmd, masked, hit.at));
        let i = 0;
        while (i < toks.length && toks[i].startsWith('-')) {
            i += PKG_VALUE_FLAGS.test(toks[i]) ? 2 : 1;
        }
        if ((toks[i] || '').toLowerCase() !== 'run') continue;
        const script = (toks[i + 1] || '').toLowerCase();
        if (script === 'format' || script === 'fmt' || script.endsWith(':fix') || toks.includes('--fix')) {
            return `a formatter run (${hit.name} run ${script})`;
        }
    }
    return null;
}

// A base64 -EncodedCommand payload hides what it runs, and a governed agent has
// no legitimate use for one, so the flag itself is the verdict for both classes.
// Decoding it would add a parser for no gain. The check is scoped to a PowerShell
// invocation because the abbreviations collide: -ec is also how bash bundles
// -e -c, and `bash -ec 'git diff | head'` is an ordinary read.
function encodedCommand(cmd, masked) {
    for (const hit of commandPositions(masked, ['pwsh', 'powershell'])) {
        const toks = tokens(segment(cmd, masked, hit.at));
        if (toks.some(a => /^-{1,2}(?:ec|enc|encodedcommand)$/i.test(a))) {
            return 'an encoded command (-EncodedCommand)';
        }
    }
    return null;
}

// Nested executors: a shell or agent that runs command text handed to it as an
// argument. Their flags carry the payload (-c, -lc, -Command, cmd's /c or /k,
// eval's and iex's operands, claude's -p) and so does a here-string
// (bash <<< "..."). cmd and iex matter on a PowerShell-primary host: quoting the
// payload (cmd /c "git commit -m x") is the natural spelling, and without the
// recursion it would mask the verb out of command position entirely.
const NESTED_EXECUTORS = ['sh', 'bash', 'zsh', 'dash', 'pwsh', 'powershell', 'cmd', 'eval', 'iex', 'invoke-expression', 'claude'];
const NESTED_FLAGS = /^-{1,2}(?:[a-z]*c|command|cmd|p|print)$/i;

// The command text a nested executor would run. The caller analyzes each payload
// recursively, so a quoted mutation is judged on what it does, and delegating one
// to another agent (claude -p "git commit") is judged the same way.
function nestedPayloads(cmd, masked) {
    const out = [];
    for (const hit of commandPositions(masked, NESTED_EXECUTORS)) {
        const hs = /^\s*<<</.exec(masked.slice(hit.at));
        if (hs) {
            const t = /^\s*("(?:\\.|[^"\\])*"|'[^']*'|\S+)/.exec(cmd.slice(hit.at + hs[0].length));
            if (t) out.push(unquote(t[1]));
        }
        const toks = tokens(segment(cmd, masked, hit.at));
        if (hit.name === 'eval' || hit.name === 'iex' || hit.name === 'invoke-expression') {
            out.push(...toks.filter(a => !a.startsWith('-')));
            continue;
        }
        if (hit.name === 'cmd') {
            // The payload follows /c or /k; //c is the Git-Bash spelling that
            // keeps MSYS path mangling off the switch, and it reaches cmd as /c.
            for (let i = 0; i < toks.length; i++) {
                if (!/^\/{1,2}[ck]$/i.test(toks[i])) continue;
                if (toks[i + 1]) out.push(toks[i + 1]);
            }
            continue;
        }
        for (let i = 0; i < toks.length; i++) {
            if (!NESTED_FLAGS.test(toks[i])) continue;
            const payload = toks[i + 1];
            if (payload && !payload.startsWith('-')) out.push(payload);
        }
    }
    return out;
}

// The reason this command changes the state under review, or null when it is a
// read the class may run. Path-dependent heuristics are skipped when the payload
// carries no cwd, since a target cannot be placed without one; the
// path-independent ones still apply.
//
// Known misses, accepted under the fail-open posture and backstopped by the
// tree-state check executing-work runs around a review round: a writer the
// heuristics do not name (dd of=, install -m, ln -sf, a python or node one-liner,
// an editor), a path assembled from a variable or split by quoting inside a token
// ("git" commit, g'i't commit, git${IFS}commit), an in-tree path spelled as an
// 8.3 short name (SAPPLE~1) or a UNC share (\\localhost\d\...), both of which
// need filesystem round-trips to normalize for a shape that takes deliberate
// evasion to produce, a bulk idiom other than find, xargs, and a PowerShell
// pipeline, a nested executor deeper than the recursion bound, and a git
// subcommand that writes files as a side effect of a read (git format-patch,
// git archive), which leaves a tracked-file delta the backstop does see, and a
// redirect standing inside a heredoc body the shell never opens (maskHeredocRedirects
// above carries which spellings do that), which leaves that same delta. In the
// other direction the residual false hit is a governed verb in genuine command
// position whose effect is not what it looks like (a mutating verb inside a
// heredoc body, whose text is scanned wherever it sits, since a body reaching a
// shell is a command). Analysis is regex-per-heuristic over the
// whole string, so cost grows with the square of command length (a 80 KB command
// takes seconds); the agent authoring that string is the only party it delays.
function denyReason(cmd, cwd, strict, depth) {
    const masked = maskHeredocRedirects(cmd, maskQuoted(cmd));

    const stateChange = gitMutation(cmd, masked)
        || ghMutation(cmd, masked)
        || formatterRun(cmd, masked)
        || bulkMutation(cmd, masked)
        || encodedCommand(cmd, masked)
        || packageMutation(cmd, masked, strict);
    if (stateChange) return stateChange;

    if (cwd) {
        const root = repoRoot(cwd);
        // A gate-runner's build output directories are not the tree under review,
        // so neither writing nor destroying content there is a mutation of
        // reviewed state. The strict class writes only .kit/.
        const writable = strict ? KIT_ONLY : GATE_OUTPUT_DIRS;
        for (const w of writeTargets(cmd, masked)) {
            for (const base of effectiveDirs(cmd, masked, w.at, cwd)) {
                if (inTreeTarget(w.target, base, root, writable)) {
                    return `a write into the tree under review (${w.target})`;
                }
            }
        }
        // Destroying content is denied to both classes. Creating a file is a
        // gate-runner's normal operation, visible in git status and caught by the
        // tree-state backstop, so the creating commands are the strict class's
        // alone, except in their overwriting form, which destroys content and is
        // denied to the gate-runner below.
        const groups = [{ shell: DESTRUCTIVE_CMDS, cmdlets: PS_WRITE.concat(PS_DESTRUCTIVE), writable }];
        if (strict) groups.push({ shell: CREATING_CMDS, cmdlets: PS_CREATING, writable: KIT_ONLY });
        for (const g of groups) {
            for (const hit of mutationTargets(cmd, masked, g.shell, g.cmdlets)) {
                for (const base of effectiveDirs(cmd, masked, hit.at, cwd)) {
                    if (inTreeTarget(hit.target, base, root, g.writable)) {
                        return `a path mutation in the tree under review (${hit.name} ${hit.target})`;
                    }
                }
            }
        }
        if (!strict) {
            for (const hit of overwriteTargets(cmd, masked)) {
                for (const base of effectiveDirs(cmd, masked, hit.at, cwd)) {
                    if (inTreeTarget(hit.target, base, root, writable)
                        && (hit.force || targetExists(hit.target, base))) {
                        return `a path mutation in the tree under review (${hit.name} ${hit.target})`;
                    }
                }
            }
        }
    }

    if (depth < 2) {
        for (const inner of nestedPayloads(cmd, masked)) {
            const nested = denyReason(inner, cwd, strict, depth + 1);
            if (nested) return `${nested}, inside a nested shell`;
        }
    }
    return null;
}

function main() {
    let p = {};
    try { p = JSON.parse(readStdin() || '{}'); } catch { return; } // parse fail: allow

    const t = subagentType(p);
    if (!t) return;                    // main session or undetermined: allow
    const cls = agentClass(t);
    if (!cls) return;                  // an agent type the guard does not govern: allow

    const input = p.tool_input || p.toolInput || (p.tool && p.tool.input) || {};
    const cmd = input.command;
    if (typeof cmd !== 'string' || !cmd.trim()) return;   // no command to judge: allow

    const cwd = (typeof p.cwd === 'string' && p.cwd.trim()) ? p.cwd.trim() : null;
    const reason = denyReason(cmd, cwd, cls === 'strict', 0);
    if (!reason) return;               // a read: allow

    // The verdict is recorded before the message is written, so a failure while
    // writing cannot turn a decided deny into an allow.
    process.exitCode = 2;
    process.stderr.write(
        `Blocked: the ${t} subagent may not change the state under review, and this command is ` +
        `${reason}. The tree must stay exactly as the orchestrator left it: an edit here invalidates ` +
        `your own findings and every other in-flight agent's reading of the same state. Findings and ` +
        `recommended changes go in your final message, scratch and evidence files go to .kit/ ` +
        `(gitignored, and writable), and a probe that must mutate the tree is the orchestrator's to ` +
        `run - name it in your findings instead of running it. Reads are unaffected: git diff, ` +
        `git log, git grep, rg, and running the build or the suite all work.\n`
    );
    process.exit(2);                   // deny
}

try { main(); } catch { /* fail open */ }
process.exit(process.exitCode === 2 ? 2 : 0);
