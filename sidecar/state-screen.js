// The live-tree screen: whether a path a command is about to write under may
// serve as that write's target, answered against the whole of the operator's
// live ~/.claude tree.
//
// A shared module rather than a helper inside the command that needed it
// first, because two writers in this tree take a caller-supplied destination:
// sidecar/battery.js's --state-dir, under which a whole fixture state is
// created, and sidecar/harvest.js's --out, a single file of verbatim captured
// commands and their output. Both would land real plaintext inside the live
// store if aimed there, so both take the same screen with one posture; a
// predicate reached by requiring the sibling that happens to hold it is the
// shape Standing Brief Amendment 1 rules out.
//
// The screen is against the whole of ~/.claude rather than any subtree inside
// it: the daemon derives spool/, inbox/ and logs/ from whatever root it is
// handed, so a screen scoped to ~/.claude/kit-sidecar accepts ~/.claude itself
// and lets a caller put fabricated records straight into the operator's live
// home without the refused name ever appearing. And ~/.claude/kit-sidecar/
// spool is the fleet-wide capture activation lever, so an --out overwrite of a
// day file there is a write into live capture state.
//
// CONTAINMENT IS DECIDED ON FILESYSTEM IDENTITY, NOT ON STRINGS. A path is a
// spelling of an object, and one object has unboundedly many spellings: the
// drive letter and the `\\localhost\D$\` and `\\127.0.0.1\D$\` admin shares,
// the `\\?\` and `\\?\Volume{GUID}\` extended-length roots, the 8.3 alias of
// any segment, either case, either separator, any number of `.` and `x\..`
// steps, and any link or junction on any component. No canonicalizer collapses
// them: fs.realpathSync leaves an 8.3 spelling untouched, fs.realpathSync.native
// expands 8.3 and normalizes case and the extended-length roots but returns a
// UNC admin-share spelling unchanged, and neither turns one root form into the
// other. A screen built on comparing spellings therefore answers a different
// question for every spelling of the one directory it is guarding, which is how
// the same defect (a path INSIDE the live tree accepted, with the sentence
// saying it was screened and found outside printed over it) was found open on
// this module five times over.
//
// What has exactly one value per directory, across every spelling above and
// through every link, is the (dev, ino) pair the OS reports for it. So the
// screen resolves the candidate to the nearest ancestor that exists, then walks
// upward comparing that pair against the live tree's own.
//
// WHERE THAT INDEPENDENCE STOPS. An identity is a property of an object, so
// this reasoning covers exactly the spellings that reach the SAME object
// through this process's own file system calls. It does not cover a name that
// is a different object to Node and the same object to another consumer: the
// Win32 path parser strips trailing dots and spaces, so `~/.claude.` opens
// `~/.claude` from cmd or Explorer while Node's fs creates and stats a literal
// `.claude.` beside it. Identity cannot see that, by construction, and a name
// comparison has to. So the screen carries two views of the live tree, an
// object view and a name view anchored at the directory the tree sits in, and
// the name view canonicalizes case and trailing dots and spaces before it
// compares. Any future consumer-side canonicalization this compare does not
// know about is the shape of the next defect here.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// The live home tree no screened write may land in: the whole of ~/.claude.
function liveHomeTree(homeDir) {
    const home = (typeof homeDir === 'string' && homeDir !== '') ? homeDir : os.homedir();
    if (typeof home !== 'string' || home === '') return null;
    return path.resolve(home, '.claude');
}

// The filesystem identity of one path, or null when it has none this screen may
// compare on.
//
// `bigint: true` IS MANDATORY, and its absence is a silent failure rather than
// an error. The Number form of an inode loses the low digits of a large NTFS
// file id: one directory on this machine reports ino 6917529027648879000 in the
// Number form where the BigInt form reports 6917529027648878213. Rounded ids
// collide between neighbouring directories, and a collision here reads as "the
// candidate IS the live tree" or, worse in the other direction, lets two
// genuinely different objects compare equal by accident.
//
// A zero dev or ino means NOT COMPARABLE and never "not equal". Some file
// systems and some remote mounts report 0 for an inode they cannot supply, and
// treating that as a value makes every such object compare equal to every
// other one that also reports 0. Null propagates to `unscreened`, which is a
// hard stop for both callers.
//
// statSync FOLLOWS LINKS, and that is the property the whole design rests on:
// one identity comparison subsumes a link on the candidate and a link on the
// live tree alike, since both spellings stat to the object they resolve to.
// Substituting lstatSync here would compare the link itself and reopen exactly
// the hole this replaced.
function idOf(target) {
    try {
        const st = fs.statSync(target, { bigint: true });
        if (typeof st.dev !== 'bigint' || typeof st.ino !== 'bigint') return null;
        if (st.dev === 0n || st.ino === 0n) return null;
        return { dev: st.dev, ino: st.ino };
    } catch {
        return null;
    }
}

// Two identities name the same object. Null on either side is not comparable,
// so it is never equal.
function sameObject(a, b) {
    return a !== null && b !== null && a.dev === b.dev && a.ino === b.ino;
}

// The real path of one existing path, or null when it does not exist or cannot
// be resolved. `.native` first because it is the stronger canonicalizer (it
// expands an 8.3 alias, which the JavaScript implementation returns unchanged,
// and normalizes case and the extended-length roots); the JavaScript
// implementation is the fallback for the platforms and mount kinds where the
// native call errors for a reason other than absence.
//
// This is a convenience for producing a stable anchor to walk up from, NOT the
// containment test. Nothing here is compared as a string.
function realOf(target) {
    try {
        return fs.realpathSync.native(target);
    } catch (err) {
        if (err && err.code === 'ENOENT') return null;
        try {
            return fs.realpathSync(target);
        } catch {
            return null;
        }
    }
}

// The nearest existing ancestor of a path, as a real path, plus the segments
// that would sit below it and that ancestor's identity.
//
// The leaf usually does not exist: both callers are naming a target they are
// about to create. So the walk finds the deepest component that does exist,
// which is the deepest object an identity comparison can be made against, and
// hands back the rest as names.
//
// The upward walk terminates on every root form this machine can produce
// (`D:\`, `\\localhost\D$\`, `\\?\D:\`, `\\?\Volume{GUID}\`, `\\?\UNC\`, `/`):
// each reaches a path.dirname fixed point after its own segments are consumed,
// in one further step for every form except `\\?\UNC\`, which takes three
// (`\\?\UNC\host\share` to `\\?\UNC\host` to `\\?\UNC\`). That form does not
// reach this walk in practice anyway: realOf normalizes an extended-length UNC
// spelling to the plain `\\host\share\` one before the walk sees it.
function anchorOf(target) {
    let cur = path.resolve(target);
    const below = [];
    for (;;) {
        const real = realOf(cur);
        if (real !== null) {
            return { ok: true, anchor: real, trailing: below.slice().reverse(), id: idOf(real) };
        }
        const parent = path.dirname(cur);
        if (parent === cur) return { ok: false, anchor: null, trailing: [], id: null };
        below.push(path.basename(cur));
        cur = parent;
    }
}

// One name segment against another, under the canonicalization a consumer of
// this path might apply to it, on BOTH platforms and deliberately not gated on
// process.platform.
//
// Two normalizations, for one reason. The costs are asymmetric: a normalization
// this compare does not apply but some consumer does means a name that IS the
// live tree compares unequal and the write lands there, while a normalization
// applied where no consumer applies it means a directory nobody has is refused
// and somebody renames it.
//
// Case, because a case-insensitive volume folds it: an exact compare on a macOS
// APFS volume ACCEPTS `~/.CLAUDE/x`, which is the live store. Trailing dots and
// spaces, because the Win32 path parser strips them: `~/.claude.`, `~/.claude..`
// and `~/.claude ` all name `~/.claude` to cmd, to Explorer and to any program
// reaching the file system through Win32, even though Node's own fs does not
// apply that rule and will happily create a literal `.claude.` beside the real
// one. Not gated on platform because a Win32-canonicalizing consumer can be on
// the other end of a share, and because the cost of stripping where nothing
// strips is the rename above.
//
// The only literal that ever reaches this compare is the ASCII string
// `.claude`, so ASCII folding is total for the real input and no
// locale-dependent question arises.
function canonicalSegment(name) {
    return name.toLowerCase().replace(/[. ]+$/, '');
}

function sameSegment(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.toLowerCase() === b.toLowerCase()) return true;
    const canonical = canonicalSegment(a);
    // `.` and `..` both canonicalize to the empty string, and an empty form is
    // not a name: it must never make two unlike segments compare equal.
    if (canonical === '') return false;
    return canonical === canonicalSegment(b);
}

// Whether `below` begins with `tail`, segment by segment.
function startsWithSegments(below, tail) {
    if (tail.length > below.length) return false;
    for (let i = 0; i < tail.length; i += 1) {
        if (!sameSegment(below[i], tail[i])) return false;
    }
    return true;
}

// The live tree, described as every (identity, name tail) pair a candidate can
// be caught by. Each view is one object to identify plus the names that must
// follow it.
//
// TWO VIEWS, because an identity test alone cannot see a name that is not a
// name to this process but is one to another consumer. The object view is the
// strong test: when `~/.claude` exists it has an identity, and matching it
// catches every spelling and every link on either side with no string
// comparison at all. The parent view anchors at the directory the live tree
// sits in and compares the one name below it, which is the only test available
// when the live tree does not exist yet (a fresh machine, or a fixture home in
// this suite), and is also what catches `~/.claude.` and `~/.claude ` when it
// DOES exist: those are separate objects to Node's fs and the same object to
// every Win32 consumer, so the object view answers no and the name view
// answers yes.
//
// When the live tree is absent the two views coincide, and the duplicate is
// dropped so the comparison list a caller renders names each test once.
function liveViews(live) {
    const resolved = path.resolve(live);
    const views = [];
    const push = (anchor, trailing) => {
        if (!anchor.ok || anchor.id === null) return;
        const already = views.some((v) => sameObject(v.id, anchor.id)
            && v.trailing.length === trailing.length
            && v.trailing.every((seg, i) => sameSegment(seg, trailing[i])));
        if (already) return;
        views.push({ id: anchor.id, trailing, anchor: anchor.anchor });
    };
    const direct = anchorOf(resolved);
    push(direct, direct.trailing);
    const parent = path.dirname(resolved);
    if (parent !== resolved) {
        const above = anchorOf(parent);
        push(above, [...above.trailing, path.basename(resolved)]);
    }
    return views;
}

// The containment walk. From the candidate's anchor upward, each ancestor is
// asked whether it is one of the live tree's views, with the names accumulated
// below it carrying whichever part of the live path that view compares by name.
//
// The walk starts from the REALPATH of the anchor, never from the spelling that
// was handed in: starting from the spelling would walk the parents of a name
// that may pass through a link, and every comparison after the first would then
// be about a directory the write never touches.
//
// The view that matched is returned, so the caller can say which rule refused
// rather than asserting one.
function walkContainment(candidate, views) {
    let cur = candidate.anchor;
    const below = candidate.trailing.slice();
    for (;;) {
        const curId = idOf(cur);
        // An ancestor whose identity cannot be read might BE the live tree, so
        // this is a cannot-measure and never an acceptance.
        if (curId === null) return { status: 'unscreened', at: cur };
        for (const view of views) {
            if (sameObject(curId, view.id) && startsWithSegments(below, view.trailing)) {
                return { status: 'refused', at: cur, view };
            }
        }
        const parent = path.dirname(cur);
        if (parent === cur) return { status: 'ok' };
        below.unshift(path.basename(cur));
        cur = parent;
    }
}

// A path with every link on it followed, computed on the nearest ancestor that
// exists when the leaf does not. Retained because the refusal-only overlay
// below is built on it and because callers render the resolved operands it
// reports; it is not the containment test.
function realpathOf(target) {
    const resolved = path.resolve(target);
    let existing = resolved;
    const trailing = [];
    for (;;) {
        try {
            const real = fs.realpathSync(existing);
            return { ok: true, path: path.resolve(real, ...trailing.slice().reverse()) };
        } catch {
            const parent = path.dirname(existing);
            if (parent === existing) return { ok: false, path: resolved };
            trailing.push(path.basename(existing));
            existing = parent;
        }
    }
}

// String containment, decided on the relative path's first segment. Used ONLY
// by the refusal-only overlay below; see the note there for why its known
// defects are inert in that position.
function isAtOrUnder(candidate, ancestor) {
    if (candidate.toLowerCase() === ancestor.toLowerCase()) return true;
    const rel = path.relative(ancestor, candidate);
    if (rel === '') return true;
    if (path.isAbsolute(rel)) return false;
    // Split on either separator: the operands are resolved before they reach
    // here, but a predicate that reads containment must not depend on which
    // separator produced the relative path.
    return rel.split(/[\\/]/)[0] !== '..';
}

// The string overlay, whose answers are consumed in ONE direction only.
//
// It makes the four spelling-and-realpath comparisons this module used to
// decide on, and the caller keeps its `refused` and discards its `ok` and its
// `unscreened` entirely.
//
// Two of its known defects produce a FALSE OK and are inert in that position: a
// UNC spelling makes path.relative return an absolute path so isAbsolute
// short-circuits all four comparisons, and on POSIX a genuine child directory
// named with a literal backslash in it splits into a leading `..`. An overlay
// structurally unable to grant `ok` cannot act on either.
//
// The third is not inert, and it is stated here rather than repaired.
// isAtOrUnder folds case unconditionally, so on a case-sensitive filesystem a
// genuinely separate `~/.CLAUDE` beside `~/.claude` is REFUSED, and a refusal
// is the one answer the caller consumes. Repairing it here would change no
// answer: canonicalSegment and sameSegment above fold case unconditionally too,
// so the identity walk's name view refuses that same path on its own. The fold
// is deliberate on the asymmetry sameSegment's own note states: applying a
// normalization where no consumer applies it means a directory nobody has is
// refused and somebody renames it, while omitting one some consumer applies
// means a path that IS the live tree is accepted and the write lands there.
// Refusing `~/.CLAUDE` is the first cost, taken knowingly.
//
// So do not "fix" the overlay, and do not delete it as dead. What it buys is a
// second, independently-derived refusal path: if the identity walk is ever
// wrong in the accepting direction on some mount or platform where stat
// identities are not what they are here, a plain spelling match still refuses.
// Two screens that fail differently refuse the union of what either refuses.
function stringOverlay(resolved, live) {
    const candidateReal = realpathOf(resolved);
    const liveReal = realpathOf(live);
    const real = candidateReal.path;
    const base = { resolved, real, live, liveReal: liveReal.path };
    if (!candidateReal.ok || !liveReal.ok) return { ...base, status: 'unscreened', compared: [] };
    const comparisons = [
        ['the candidate spelling against the live spelling', resolved, live,
            'it names a path inside the live ~/.claude tree'],
        ['the candidate realpath against the live spelling', real, live,
            'a link on it resolves into the live ~/.claude tree, so writing through it would write there'],
        ['the candidate spelling against the live realpath', resolved, liveReal.path,
            'the live ~/.claude tree resolves through a link to this path, so writing here would write into it'],
        ['the candidate realpath against the live realpath', real, liveReal.path,
            'a link on one side or the other resolves both to the same live ~/.claude tree, so writing through it would write there']
    ];
    const compared = comparisons.map(([label]) => label);
    for (const [, candidate, ancestor, detail] of comparisons) {
        if (isAtOrUnder(candidate, ancestor)) return { ...base, status: 'refused', compared, detail };
    }
    return { ...base, status: 'ok', compared };
}

// What one live view actually compares, said as the comparison it is, for the
// list a caller renders its one reassurance sentence from.
//
// Composed from the view rather than fixed, because the two views compare
// different things and a caller printing a constant would claim the wrong one.
// The walk also never reads the target's own identity when the target does not
// exist, which is the ordinary case for both callers, so the operand it names
// is the deepest existing directory on the path rather than the target.
function comparisonLabel(view) {
    const from = 'the filesystem identity (device and inode) of the deepest existing directory on this '
        + 'path, and of every directory above it';
    if (view.trailing.length === 0) {
        return `${from}, against the live ~/.claude tree's own identity`;
    }
    return `${from}, against the identity of the directory the live ~/.claude tree sits in, `
        + `with the name${view.trailing.length > 1 ? 's' : ''} ${view.trailing.join('/')} compared below it`;
}

// Whether a path may serve as a screened write's target.
//
// Three answers, and the third is the one this screen exists to keep distinct
// from the first: `ok`, the path was compared against the live home tree and no
// comparison put it inside; `refused`, one of the comparisons did; and
// `unscreened`, the comparison could not be made at all, because this process
// has no home directory to compare against, or because neither the candidate
// nor the live tree has any component that resolves, or because an ancestor on
// the way up has no identity this screen can read. An unscreened path is never
// treated as an accepted one, and any sentence a caller prints about this
// screen is composed from this answer rather than asserted over it.
//
// This function throws nothing, by construction: every fs call it reaches sits
// inside a try, and both callers treat `unscreened` as a hard stop, so widening
// unscreened into ok to be helpful would defeat the whole module.
//
// `homeDir` is the home this screen resolves its live tree from, and it is
// REQUIRED AT EVERY CALL SITE, including the shipped ones. Both shipped callers
// pass it as `undefined`, which is what makes the shipped path compare against
// os.homedir() exactly as a one-operand call would have; what a one-operand call
// does NOT do is say so. The operand carries the answer to "which tree is this
// screened against" at every site, so a caller that means the operator's own
// store says so by passing the value that names it rather than by omitting the
// question, and a reader auditing the file can tell a site that decided from a
// site that did not. Passing nothing is the shape eight closures of one defect
// class were written over, and a call site that drops back to one argument
// reintroduces it: the suite refuses any call carrying fewer than two arguments,
// on that ground rather than on a claim about the value, in this file's two
// callers as well as in its own cases.
function screenStateDir(target, homeDir) {
    const live = liveHomeTree(homeDir);
    const resolved = path.resolve(target);
    if (live === null) {
        return {
            status: 'unscreened',
            resolved,
            // Every answer carries `compared`, on every branch, because a
            // caller rendering the list must not have to know which branch it
            // is holding: an absent key here reads as no comparison to a caller
            // that checks and throws in one that does not.
            compared: [],
            detail: 'this process has no home directory, so the live store has no path to compare against'
        };
    }

    // The overlay first, and only its refusal is consumed.
    const overlay = stringOverlay(resolved, live);
    if (overlay.status === 'refused') return overlay;

    const base = { resolved, real: overlay.real, live, liveReal: overlay.liveReal };

    const candidateAnchor = anchorOf(resolved);
    const views = liveViews(live);
    const compared = [...views.map(comparisonLabel), ...overlay.compared];
    if (!candidateAnchor.ok || candidateAnchor.id === null) {
        return {
            ...base,
            status: 'unscreened',
            compared,
            detail: 'no component of this path could be resolved to an object with a readable filesystem '
                + 'identity, so it cannot be compared against the live store'
        };
    }
    if (views.length === 0) {
        return {
            ...base,
            status: 'unscreened',
            compared,
            detail: 'no component of the live ~/.claude path could be resolved to an object with a readable '
                + 'filesystem identity, so there is nothing to compare against'
        };
    }

    const walk = walkContainment(candidateAnchor, views);
    if (walk.status === 'unscreened') {
        return {
            ...base,
            status: 'unscreened',
            compared,
            detail: 'a directory above this path has no readable filesystem identity, so whether it is the '
                + 'live ~/.claude tree cannot be established'
        };
    }
    if (walk.status === 'refused') {
        return {
            ...base,
            status: 'refused',
            compared,
            detail: walk.view.trailing.length > 0
                ? `a directory above it is the same object as the directory the live ~/.claude tree sits in, `
                    + `and the names below it begin with ${walk.view.trailing.join('/')}, so writing here `
                    + 'would write into the live store'
                : 'it is the same filesystem object as the live ~/.claude tree, or sits under it, so writing '
                    + 'here would write into the live store'
        };
    }
    return { ...base, status: 'ok', compared };
}

module.exports = {
    liveHomeTree,
    realpathOf,
    isAtOrUnder,
    idOf,
    anchorOf,
    screenStateDir
};
