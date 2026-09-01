#!/usr/bin/env sh
# Dev-clone setup for the claude-kit repo: record the kaizen signpost and wire git
# hooks. Run from the repo root: ./setup.sh
#
# POSIX only. On Windows these first-run duties live in doctor: doctor.cmd -Fix
# does setup and verification in one pass. This script remains the POSIX path
# until a doctor.sh exists (tracked in docs/backlog.md).
#
# The operating doctrine ships via the plugin now (the operating-instructions
# skill), so setup no longer installs a user-level CLAUDE.md. On Claude Code the
# doctrine-refresh hook maintains ~/.claude/claude-kit-doctrine.md and your
# ~/.claude/CLAUDE.md imports it with one line (see the Next hints).

set -e

# Resolve Paths.
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TARGET_DIR="$HOME/.claude"

# Validate this is the kit repo (so the signpost's kitRepoPath is meaningful).
if [ ! -f "$SCRIPT_DIR/plugins/claude-kit/.claude-plugin/plugin.json" ]; then
    echo "Not the claude-kit repo root (plugins/claude-kit/.claude-plugin/plugin.json missing). Run from the repo root." >&2
    exit 1
fi

# Ensure Target Directory.
mkdir -p "$TARGET_DIR"

# Record the kaizen signpost: where this machine's kit clone lives, so kaizen
# capture (the kaizen skill) can find the clone from any project. Machine-local,
# never committed. This file may already carry operator-set keys this script
# does not own (compactNudgeFloor among them), so the write merges into any
# existing object rather than replacing it: kitRepoPath and machine are the
# only two keys this script overwrites, and everything else already in the
# file survives the run untouched. A signpost that is absent, or whose
# contents do not parse as a JSON object, still gets the plain two-key
# template - a merge has nothing to merge into in either case.
#
# The write itself goes to a sibling temp file that is then renamed into
# place, never to the signpost path directly. A rename replaces the directory
# entry, so nothing is ever written THROUGH a link of any kind standing at
# that path - symbolic link, hard link, or one planted between the check below
# and the write - and an interrupted run cannot leave a truncated signpost
# with the operator's keys destroyed. The temp file is a sibling so the rename
# stays within one volume, where it is atomic.
#
# The `-L` check that survives alongside it is detection rather than defence:
# an operator who deliberately points this path at a dotfiles repo is told the
# signpost was not written instead of having their link quietly replaced by a
# real file. It fires on every run, where the doctor's equivalent fires only
# when it has a signpost to write; that asymmetry is accepted, the two writers
# reaching this file on different schedules. A dangling link is refused by the
# same check and would otherwise simply be replaced by the rename.
#
# node carries the JSON merge rather than a hand-rolled shell parser, but it is
# a run-time dependency of the kit rather than a setup-time one (a fresh clone
# runs this script before installing the plugin), so its absence must not abort
# the run: an absent signpost still gets the two-key template, and an existing
# one is left alone rather than flattened by a wholesale write.
SIGNPOST="$TARGET_DIR/claude-kit.local.json"
MACHINE=$(hostname 2>/dev/null || echo unknown)
SIGNPOST_REFUSED=0
if [ -L "$SIGNPOST" ]; then
    echo "Refused to write $SIGNPOST: it is a link. Remove it and re-run setup.sh so the signpost is written as a real file." >&2
    SIGNPOST_REFUSED=1
elif command -v node >/dev/null 2>&1; then
    SIGNPOST="$SIGNPOST" KIT_REPO_PATH="$SCRIPT_DIR" KIT_MACHINE="$MACHINE" node -e '
        const fs = require("fs");
        const signpost = process.env.SIGNPOST;
        let merged = null;
        try {
            const parsed = JSON.parse(fs.readFileSync(signpost, "utf8"));
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) merged = parsed;
        } catch { merged = null; }
        if (!merged) merged = {};
        merged.kitRepoPath = process.env.KIT_REPO_PATH;
        merged.machine = process.env.KIT_MACHINE;
        const tmp = signpost + ".tmp-" + process.pid;
        fs.writeFileSync(tmp, JSON.stringify(merged, null, 2) + "\n");
        try {
            fs.renameSync(tmp, signpost);
        } catch (err) {
            try { fs.unlinkSync(tmp); } catch { /* the temp file is the only orphan to clear */ }
            throw err;
        }
    '
    echo "Recorded kaizen signpost at $SIGNPOST"
elif [ -e "$SIGNPOST" ]; then
    echo "node not found; left the existing $SIGNPOST untouched (a wholesale rewrite would drop any keys it carries). Install node and re-run setup.sh to record this clone." >&2
else
    # Nothing exists at this path (the -L and -e tests above both said so), so
    # the redirect creates the file rather than truncating anything through a
    # link.
    printf '{\n  "kitRepoPath": "%s",\n  "machine": "%s"\n}\n' "$SCRIPT_DIR" "$MACHINE" > "$SIGNPOST"
    echo "Recorded kaizen signpost at $SIGNPOST (node not found; wrote the two-key template without a merge)"
fi

# Wire Git Hooks. Make the hook + build script executable and point this clone at
# .githooks so the pre-commit hook rebuilds plugins/claude-kit.zip when plugin
# sources change.
if command -v git >/dev/null 2>&1; then
    chmod +x "$SCRIPT_DIR/.githooks/pre-commit" "$SCRIPT_DIR/build.sh" 2>/dev/null || true
    git -C "$SCRIPT_DIR" config core.hooksPath .githooks
    echo "Configured git core.hooksPath -> .githooks"
else
    echo "git not found; skipped hook wiring. Run later: git config core.hooksPath .githooks" >&2
fi

echo "Next:"
echo "  1. Install the plugin:  /plugin marketplace add <your-github-username>/claude-kit ; /plugin install claude-kit@applefeld"
echo "  2. (Claude Code, once per machine) add to ~/.claude/CLAUDE.md so the doctrine loads always-on:  @claude-kit-doctrine.md"
echo "  3. (Cowork/Chat, once per account) add to your account preferences:  Before any non-trivial task, consult the operating-instructions skill."

# The git-hooks wiring and the hints above still run after a refused signpost,
# since they are worth having either way, but the run does not report success:
# a link standing at the signpost path is either a deliberate arrangement the
# operator must resolve or an indicator of compromise, and a zero exit would
# tell an unattended caller the signpost was written when it was not.
if [ "$SIGNPOST_REFUSED" -ne 0 ]; then
    echo "setup.sh did not record the kaizen signpost: $SIGNPOST is a link (see above)." >&2
    exit 1
fi
