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
//     positively resolved. On Windows a target must carry a drive-letter root
//     as written, and no other spelling is converted into one. A rootless
//     slash path resolves against this process's current drive while the
//     child's shell maps it elsewhere, and the /d/... spelling Git-Bash
//     accepts is rewritten by the MSYS runtime at exec, under an environment
//     variable that shell can be carrying from an earlier call and that this
//     hook cannot observe from its own process. Both spellings therefore name
//     one file to this hook and can name another to the child, which is the
//     divergence every rule here exists to prevent.
//   - The arguments past the script path are screened, not passed through.
//     node hands everything after the script to the script, so these are
//     memq's argv and memq validates its own input, but the grant is narrower
//     than the CLI: a prompt-free allow with no operator in the loop does not
//     cover a command that removes a shared record, reads a caller-named path
//     into the store, or loads code out of a directory this hook cannot
//     bound. The verb is judged by allowlist: the word right after the script
//     path, which is the one place memq reads a subcommand from, must be one
//     of the verbs this grant is meant to cover, and every other word there
//     withholds it. Left out of that list are delete-type and delete-operator,
//     which remove a shared-tier record outright, find, which is the only
//     verb that loads an embedder, and anchor, which rewrites a project-tier
//     record's anchors: line in place at a name the command line gives it.
//     Four flag shapes are refused wherever in the command they sit, since
//     that is where a flag can appear:
//     --body-file, which reads a caller-named path into the store; --update
//     carrying --body, which replaces a shared record's body whole;
//     --supersedes, which demotes and labels a record no pin protects from
//     it; and --rollup, which folds every expired journal entry's prose into
//     a tally and keeps the text in a single local .bak the sync never
//     carries. memq refuses the deletes, the body-file, the body-carrying
//     update and the supersedes pointer under the store signals as well, so
//     those five are a second lock rather than the only one; find, anchor and
//     --rollup are withheld here alone, since anchor has no second lock in
//     the CLI. What a
//     withheld grant costs on this vector is the capability itself: no
//     operator is watching a fleet worker's session, so the command does not
//     run rather than waiting for an approval. Each withholding below is
//     chosen against that price, not against a prompt.
//   - The interpreter is positively identified, not accepted by name. The
//     word `node` resolves through PATH in the child's shell, and this hook
//     inherits the same environment that child would get, so it walks that
//     PATH itself and grants only when the first `node` candidate it finds is
//     this very interpreter (realpath equality with process.execPath; on
//     Windows the wrapper spellings node.cmd/.bat/.com/.ps1 and an
//     extensionless `node` are candidates too, and none of them can equal the
//     real binary, so a planted wrapper anywhere ahead of it refuses). The
//     variables that select code for the granted child are refused outright
//     whenever they are set at all: NODE_OPTIONS (carries --require/--import),
//     NODE_PATH (steers module resolution), and NODE_REPL_EXTERNAL_MODULE (a
//     preloaded module). All three are node's own. No variable naming an
//     embedder directory is among them, because the one verb that loads an
//     embedder is withheld from the grant outright, which bounds the
//     directory question instead of screening for it.
//   - The whole command line is free of shell metacharacters: ; & | < > ` $
//     ( ) are refused anywhere, quoted spans included. The scan deliberately
//     does not parse quoting to be lenient inside it; quote parity is
//     shell-dependent (the memq.cmd %* expansion is the recorded example), so
//     bluntness is the design. Every C0 control byte and DEL is refused
//     anywhere too, tab excepted: bash strips NUL from a command line
//     outright, so a word screened here as delete-type\0 would reach the
//     child as delete-type, and what a shell does with the rest of that class
//     is unspecified rather than agreed. Word separators are space and tab
//     only, and every other whitespace character (NBSP, the Unicode
//     separators, and the controls the class above already takes) is refused
//     anywhere, because bash does not split on them and a splitter that did
//     would judge different words than the shell builds. Refused for the same
//     words-must-match reason: a backslash immediately before a quote, a
//     backslash outside a quoted span (bash consumes it), and an unquoted
//     word starting with # (bash drops the rest of the line as a comment).
//   - No word is one bash would rewrite before the child sees it. A brace,
//     a glob or a bracket in an unquoted span is refused, because brace and
//     pathname expansion happen after this hook has read the line and can
//     turn one word into several ({delete-type,--confirm-shared} is two words
//     to bash and one to any tokenizer that does not expand). A word opening
//     with an unquoted tilde is refused, because tilde expansion substitutes
//     the caller's own HOME into it and every screen here is a content test.
//     Both are span-scoped, since bash performs neither inside quotes, so a
//     description carrying [note] or ~/.claude is ordinary text. A tilde
//     later in a word is literal too, with one admitted exception noted at
//     the splitter: an assignment-shaped word expands after its = and after
//     each : within it, and keeps its non-tilde prefix, so it can become
//     neither a screened token nor the script path.
//
// Threat model: the expensive failure is a silent over-grant, a command this
// hook allows that runs anything other than this plugin's memq.js under this
// plugin's own interpreter. The metacharacter ban removes chaining,
// substitution, and redirection; the path equality removes substitute
// scripts; the interpreter pin removes a PATH-planted node, while node -e,
// npx, node.exe, and interpreters at other paths are refused as spellings
// before the pin is even consulted; the code-selection refusal removes code
// injected into a genuine invocation through the environment; the word rules
// keep the child's word list the same list this hook screened; and the
// argument screen keeps the commands that are not fit for a prompt-free allow
// out of the grant.
//
// The word list is the same list, and the words themselves diverge in one
// admitted way: bash collapses a doubled backslash to one inside a
// double-quoted span, and the splitter below copies a quoted span verbatim,
// so a word carrying \\ reaches the child one character shorter than this
// hook read it. Refusing a backslash inside quotes is not available, since
// the script path is quoted and full of backslashes on Windows, and the
// divergence is harmless against what the screens actually test. Those are a
// whole-word match against tokens that contain no backslash, and a
// path.resolve equality against this hook's own location. The collapse only
// ever removes a backslash, so a word that carries one still carries one
// after it and can never become a screened token, a screened token carries
// none and so passes through the collapse unchanged, and the two spellings of
// the target path resolve to the same file because path.resolve normalizes
// repeated separators.
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

// Banned anywhere in the command line, inside quotes or out: the shell's
// control and substitution characters, one of which turns one command into
// two, or into a command whose text the shell composes. The ban stays blunt
// across quoted spans because $ and ` expand inside double quotes, and
// because quote parity is the thing an attacker manipulates, so a rule that
// asked which span a character sat in would be asking the manipulated
// question. Carriage return and newline are not here: they are control bytes
// and the class below carries them, along with every other character in it.
// The classes overlap by design rather than partitioning the alphabet, since
// a character refused by two of them is refused either way; what the split
// buys is that each rule states one property, so a later change to what
// counts as a metacharacter cannot quietly stop refusing a line break.
const METACHARACTERS = /[;&|<>`$()]/;

// Banned anywhere, tab excepted: a C0 control byte or DEL. Bash strips NUL
// from a command line outright, so a word this hook reads as delete-type\0
// reaches the child as delete-type and every screen here has answered about a
// word the child never saw. The other controls are the same shape of
// divergence in waiting, since what a shell and this splitter each do with
// one is unspecified rather than agreed. Tab is the exception because bash
// splits words on it, which is what the splitter below does with it too.
const CONTROL_BYTE = /[\x00-\x08\x0a-\x1f\x7f]/;

// The characters bash rewrites into a different list of words than it was
// given, banned in unquoted spans only, by words() below. Brace expansion and
// pathname expansion both happen after this hook has read the command line and
// before the child sees its argv, so a word this hook reads as one literal can
// reach memq as several: {delete-type,--confirm-shared} is two words to bash
// and one to any tokenizer that does not expand, and --{update,body} is two
// more. Everything past the script path is screened by name below, so a
// rewrite this hook cannot see is a way around that screen.
//
// Bash performs neither expansion inside quotes, so a quoted span carrying one
// is ordinary free text: a summary reading "node --test test/*.test.js is
// green", a description carrying [note]. Banning those line-wide would
// withhold the grant from ordinary writing, and on the vector this hook serves
// there is no operator present to approve the fall-through.
const EXPANSION = /[{}*?\[\]]/;

// Any whitespace character that is not a plain space or tab, anywhere: bash
// does not split words on these, so the splitter below must never see one.
const ODD_WHITESPACE = /[^\S \t]/;

// A backslash immediately before a quote, anywhere: the shell and the word
// splitter below would read the quote differently.
const ESCAPED_QUOTE = /\\["']/;

// Environment variables that make the granted child load or resolve code the
// command line never names. All three are node's own: NODE_OPTIONS carries
// --require and --import, NODE_PATH steers module resolution, and
// NODE_REPL_EXTERNAL_MODULE names a module node preloads. The child inherits
// this hook's environment, so any of them being set at all refuses the grant.
//
// No variable of the kit's belongs here. The one memq path that loads code
// out of a named directory is find, which requires scripts/memory-index.js,
// which requires an embedder package out of KIT_EMBEDDER_ROOT and runs it in
// process; find is withheld by the argument screen below, so no granted
// command reaches that require. Screening the root would not have closed the
// class in any case, since embedderRoot() falls back to a directory under
// os.homedir() and that reads HOME or USERPROFILE, which are always set: a
// refusal on their presence would refuse every command there is. The other
// root this repo gates the same way, KIT_PLUGINS_ROOT, selects which memq a
// shim resolves; it is absent for its own reason, that the grant names this
// script by absolute path and the child loads no shim.
const PRELOAD_ENV = ['NODE_OPTIONS', 'NODE_PATH', 'NODE_REPL_EXTERNAL_MODULE'];

// The verbs a prompt-free allow covers, which is memq's own subcommand list
// minus the four this grant does not extend to. memq dispatches log, find,
// get, recall, recent, unstamped, touch, anchor, add-type, add-operator,
// delete-type, delete-operator, decay-scan, decay-prune and decay-done, and
// the four absent here are the two deletes, find, and anchor.
//
// anchor is the fourth, and it is withheld on what it authors rather than on
// what it destroys: it rewrites a record of the project tier in place, at a
// name the command line gives it. What the rewritten line buys is a claim
// about which files the memory is about and at which bytes, so a worker could
// re-anchor a record onto whatever the tree holds now and every drift surface
// would then report that memory as verified when nobody read it. The CLI has
// no second refusal for the verb, since it is the operator's own, so this
// screen is the only one.
//
// An allowlist rather than a denylist, because the two fail in opposite
// directions: a verb added to the CLI later is not covered until this list
// learns it, where a denylist would cover it the day it lands and say nothing.
// Of the shapes this grant withholds, find has no second lock in the CLI, so
// a new verb that loads code or reads a caller-named path would arrive with
// no layer refusing it at all. The cost is availability, and it is the right
// direction for a grant surface: the failure of an allowlist is a fleet
// worker losing a verb nobody has listed yet until this list learns it, and
// on an unattended vector a lost capability is recoverable by editing this
// list where an over-grant is not recoverable at all.
const GRANTED_VERBS = new Set(['log', 'get', 'recall', 'recent', 'unstamped', 'touch',
    'add-type', 'add-operator', 'decay-scan', 'decay-prune', 'decay-done']);

// Shell words of a metacharacter-clean command: space and tab split, a quoted
// span joins onto the current word the way the shell joins it ("a"b is one
// word ab). Null for the spellings where this splitter and the shell diverge:
// an unterminated quote, a backslash outside a quoted span, an unquoted word
// starting with # (a comment to bash, words to this splitter), an unquoted
// expansion character, and an unquoted tilde opening a word, where bash would
// hand the child either a different list of words than this one or a
// different word.
//
// The tilde is refused here, inside the splitter, because its significance is
// positional and a finished word no longer records where its characters came
// from. Bash expands a tilde only as a word's first character and only
// unquoted, substituting the caller's own HOME before the child is executed,
// and every screen past this point is a content test over the word list:
// HOME=delete-type turns a bare ~ into the delete verb, in a list where each
// of those screens has already passed. A tilde anywhere else in a word is
// literal, and admitting it is what keeps this splitter's word equal to the
// shell's: bash leaves a:~/y, --f=~/x and /a/~/b exactly as they are, so
// refusing one here would withhold the grant over a word nothing rewrites.
// (A Windows 8.3 short path such as C:\\Users\\LOCALA~1\\... is one such word,
// though it is not one the grant covers: the target is judged by
// path.resolve equality with no realpathSync anywhere, so an 8.3 spelling of
// the script path is refused at the path check like any other spelling that
// is not the resolved one.) A tilde reached through a quoted span
// is literal wherever it sits, which is what "~/.claude is the store root"
// is: a description, not a path.
//
// One word shape is not literal and is admitted anyway: bash also expands a
// tilde after the = of an assignment-shaped word and after each : within one,
// so FOO=~ reaches the child as FOO=/home/you and A=x:~ as A=x:/home/you. An
// assignment-shaped word begins with an identifier character, and the
// expansion keeps everything before the tilde, so such a word can become
// neither one of the screened tokens (delete-type, delete-operator,
// --body-file, --update, --body), which are matched whole, nor the script
// path, which is matched by path equality. What it can become is a longer
// argument of memq's own, which memq validates. A screen that ever matched a
// word's interior rather than the whole of it would have to revisit this.
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
        if (c === '~' && cur === null) return null;
        if (EXPANSION.test(c)) return null;
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
//
// What the pin bounds is the PATH lookup, which is one of the channels a
// shell resolves a command name through and the only one visible from
// outside the shell. A name resolved without that lookup is outside it: the
// Bash tool's shell persists across calls, so a function or an alias named
// node, defined by an earlier approved call, preempts PATH entirely, and
// this process sees the environment rather than the shell's own tables. No
// screen available here closes that, which is why the grant is bounded by
// blast radius as well: the one command it can allow is this plugin's own
// CLI, whose withheld verbs and flags hold whatever runs it.
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

// Whether a screened flag is among these words, in either spelling a shell
// can hand the child: the flag as its own word, or the flag with a value
// attached after '='. The '=' is part of the match rather than a bare prefix
// test, so --body screens --body= and never some later --bodyguard, and for
// the same reason --body does not screen --body-file: those two are
// independent screens and each answers for its own spellings. memq's parser
// answers 'unknown option' to every attached-value spelling today, so this
// costs no working invocation; what it buys is that the reason a caller-named
// path or a body-carrying repair gets no prompt-free allow is this hook's own
// rule rather than the next layer's parser. The widening can only ever refuse
// more, which is why it needs no audit of what the grant still covers: a word
// this test matches was already a word the grant had no business covering.
function screensFlag(argv, flag) {
    return argv.some((word) => word === flag || word.startsWith(flag + '='));
}

function grantable(p) {
    if (p.tool_name !== 'Bash') return false;

    const input = p.tool_input || {};
    const cmd = input.command;
    if (typeof cmd !== 'string' || !cmd.trim()) return false;
    if (METACHARACTERS.test(cmd) || CONTROL_BYTE.test(cmd) || ODD_WHITESPACE.test(cmd)
        || ESCAPED_QUOTE.test(cmd)) return false;

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
    // Three words at least, because the block below reads the interpreter,
    // the script path and the verb by index. A command shorter than that is
    // not the one shape this hook can grant.
    if (w === null || w.length < 3 || w[0] !== 'node') return false;

    const target = w[1];
    // On Windows only a drive-letter-rooted spelling is positively
    // resolvable, and it is taken as written. The /d/... spelling is not
    // converted into one here: the MSYS runtime rewrites such an argument at
    // exec, so what the child receives depends on MSYS_NO_PATHCONV and
    // MSYS2_ARG_CONV_EXCL in the shell that runs the command. Screening those
    // two variables would not settle it, because the Bash tool's shell keeps
    // state across calls and an earlier allowed call can export one into the
    // shell a later granted command runs in, which this process cannot see.
    // Refusing the spelling settles it, and it is the cheapest of these
    // costs: how the script path is spelled is the spawning engine's own
    // choice, so a drive-letter spelling is a requirement on the caller
    // rather than a capability withheld from it. Elsewhere, absolute or
    // nothing.
    if (path.sep === '\\') {
        if (!/^[A-Za-z]:[\\/]/.test(target)) return false;
    } else if (!path.isAbsolute(target)) {
        return false;
    }
    if (!samePath(path.resolve(target), MEMQ)) return false;

    // The grant covers what a fleet worker needs, which is not everything the
    // CLI can do. Five of the shapes it withholds are ones memq itself also
    // refuses under the store signals, so for those this screen is a second
    // lock: the two delete verbs, which remove a shared-tier record outright;
    // an --update carrying a body, which replaces one whole and keeps the text
    // it replaces only in a local .bak the sync never carries; --body-file
    // anywhere, which reads a caller-named path into the store; and
    // --supersedes, which demotes and labels a record no pin protects from it.
    // Three more are withheld here alone, with no second layer behind them:
    // find, which loads an embedder out of a directory the command line does
    // not name; --rollup, which discards prose no copy survives; and anchor,
    // which rewrites a project-tier record in place and with it the claim
    // every drift surface reads about which files that memory is still true
    // of. None of the eight belongs in a prompt-free allow with no operator
    // in the loop, and the three with no second lock are the ones a later
    // edit here would silently free.
    //
    // This screen is the second lock rather than a move of the first: the CLI
    // evaluates those signals in the child process, this hook evaluates them
    // in its own, and where the two disagree the child both skips its refusal
    // and resolves memoryRoot() to the operator's real store, so a caller-named
    // path would be read into the tier that syncs to a private remote.
    // Withholding a grant is silence, not a deny: the command is not blocked
    // here, it simply gets no prompt-free allow. On the unattended vector
    // this hook serves that is the whole of the outcome, since no operator is
    // there to approve what the grant withholds, so each screen below is
    // chosen knowing it costs a fleet worker the command outright. The flags
    // are matched by screensFlag,
    // which answers for the attached-value spelling as well as the whole
    // word, so what this screen withholds does not depend on how the CLI
    // parses --flag=value.
    //
    // The verb is judged against GRANTED_VERBS, so a word this hook has never
    // heard of withholds rather than passing through. find is the reason the
    // list is shaped that way and is this hook's only lock on it: it is the
    // one verb that loads code out of a directory named outside the command
    // line, requiring scripts/memory-index.js and through it an embedder
    // package under a root that falls back to one inside the caller's own
    // HOME. No environment screen can bound that directory, since HOME is
    // always set, so the verb is left off the list instead. The cost is
    // deliberate and worth naming: a fleet worker gets no semantic search at
    // all, not a prompt for one. It is affordable because recall is the
    // retrieval path an effort starts from by the memory skill's own design,
    // and recall, get, log, touch and the write verbs are untouched.
    if (!GRANTED_VERBS.has(w[2])) return false;
    if (screensFlag(w, '--body-file')) return false;
    if (screensFlag(w, '--update') && screensFlag(w, '--body')) return false;
    // --supersedes is withheld on which records it can reach, not on how much
    // it does to one. A pin is the operator's own exemption, and every other
    // way this grant lets a worker push a record down the store's answers
    // stops at one: archiveTargetsValid refuses a pinned name outright, so
    // the granted archive flags cannot touch an exempted record, and the
    // decay pass the scan feeds is bound by the same pin. This flag is not.
    // Its target is any live record of the tier, pinned or not, and what the
    // pointer then buys is a rank demotion in the semantic channel plus a
    // label on every surface that reads the name. So a worker with no
    // operator in the loop could read the pinned population off decay-scan,
    // which is granted and prints it by name, and demote in one further
    // command exactly the records the operator marked as the ones not to
    // touch. Withholding here is what keeps the pin the boundary it is on
    // every other granted path of the CLI. A worker's own file tools write
    // the field by hand without meeting this screen at all, which is the
    // residual the security model records against the destination block
    // rather than one a command screen can close.
    if (screensFlag(w, '--supersedes')) return false;
    // --rollup is withheld on how much it destroys, not on where the copy
    // goes: it replaces each expired journal group with one synthetic tally
    // line and drops the prose of every entry in that group, which is the
    // shape the delete verbs are withheld for. The granted writes bounded the
    // same way are bounded far tighter: a description-only --update rewrites
    // one index line and leaves the record it describes untouched, and
    // archiving is demotion, refused against a pinned record, with the record
    // still readable by name afterwards. What bounds it is that pair, the
    // reversibility and the pin, rather than the demotion class alone: a
    // demotion no pin can stop is not bounded by this comparison, which is
    // why --supersedes is screened above rather than read as archiving's
    // lighter cousin. So a bare decay-prune and the archive flags stay
    // granted.
    //
    // The cost is real and deliberate: the kit's own close-out runs
    // decay-prune --rollup, and a fleet worker reaching that step loses the
    // rollup with nothing to prompt and nobody to approve it. What that costs
    // is growth in a journal an attended session compacts later, against a
    // prompt-free allow for the one operation in this CLI that discards prose
    // outright.
    if (screensFlag(w, '--rollup')) return false;

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
