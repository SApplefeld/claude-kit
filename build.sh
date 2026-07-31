#!/usr/bin/env sh
# build.sh - Package the claude-kit plugin into an installable zip (POSIX parity
# with build.ps1). Produces plugins/claude-kit.zip with claude-kit/ at the
# archive root. build.ps1 is the canonical builder on Windows; this path is for
# Linux/macOS, where the `zip` command is normally available.

set -eu

# Resolve Paths.
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PLUGIN_NAME=claude-kit
SOURCE_DIR="$SCRIPT_DIR/plugins/$PLUGIN_NAME"
ZIP_PATH="$SCRIPT_DIR/plugins/$PLUGIN_NAME.zip"

# Validate Tooling. A SHA-256 command is as required as zip: the build stamp
# carries hook hashes the canary verifies the installed cache against, and a build
# that quietly omitted them would ship an unverifiable payload. sha256sum is GNU,
# shasum is the macOS stock tool, openssl is the fallback; all three print lowercase
# hex, which is what the canary compares against.
if ! command -v zip >/dev/null 2>&1; then
    echo "build.sh requires the 'zip' command. On Windows use build.ps1 instead." >&2
    exit 1
fi
if command -v sha256sum >/dev/null 2>&1; then
    hash_file() { sha256sum "$1" | cut -d' ' -f1; }
elif command -v shasum >/dev/null 2>&1; then
    hash_file() { shasum -a 256 "$1" | cut -d' ' -f1; }
elif command -v openssl >/dev/null 2>&1; then
    hash_file() { openssl dgst -sha256 "$1" | sed 's/.*= *//'; }
else
    echo "build.sh requires one of: sha256sum, shasum, openssl." >&2
    exit 1
fi

# Validate Source.
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Plugin source not found: $SOURCE_DIR" >&2
    exit 1
fi

# Stamp Build Info. Record the git short hash (and a dirty flag) inside the plugin
# so the kit-version-nudge hook can tell, at session start, which build a session
# is running, plus a SHA-256 of every hook file packaged, which hook-canary.js
# compares the executing plugin cache against so a hook edited in place after
# install is not silent. hooks.json is hashed with the scripts because rewiring a
# guard out disarms it the same way editing it does. Hash-only - no wall-clock - so
# a clean rebuild of the same commit stays byte-identical. Gitignored; regenerated
# on every build. Must be written before the archive step so it lands inside the zip.
BUILD_INFO="$SOURCE_DIR/.claude-plugin/build-info.json"
if HASH=$(git -C "$SCRIPT_DIR" rev-parse --short HEAD 2>/dev/null); then
    if [ -n "$(git -C "$SCRIPT_DIR" status --porcelain -- "plugins/$PLUGIN_NAME" 2>/dev/null)" ]; then
        DIRTY=true
    else
        DIRTY=false
    fi
else
    HASH=unknown
    DIRTY=false
fi
# One "<filename>": "<sha256>" line per hook file, comma-separated. A hash that is
# not 64 hex characters ends the build: stamping an empty or partial entry would
# ship a manifest no cache can ever match, and the canary would then call every
# install tampered at every session start. The lines are accumulated in this shell
# rather than through a pipeline, so that exit is the build's and not a subshell's.
NL='
'
HOOK_HASHES=''
for f in "$SOURCE_DIR"/hooks/*.js "$SOURCE_DIR"/hooks/hooks.json; do
    [ -f "$f" ] || continue
    FILE_HASH=$(hash_file "$f")
    case "$FILE_HASH" in *[!0-9a-f]* | '') FILE_HASH='' ;; esac
    if [ "${#FILE_HASH}" -ne 64 ]; then
        echo "build.sh: no SHA-256 for $f - refusing to stamp an incomplete manifest." >&2
        exit 1
    fi
    [ -z "$HOOK_HASHES" ] || HOOK_HASHES="$HOOK_HASHES,$NL"
    HOOK_HASHES="$HOOK_HASHES    \"$(basename "$f")\": \"$FILE_HASH\""
done
printf '{\n  "name": "%s",\n  "hash": "%s",\n  "dirty": %s,\n  "hooks": {\n%s\n  }\n}\n' \
    "$PLUGIN_NAME" "$HASH" "$DIRTY" "$HOOK_HASHES" > "$BUILD_INFO"

# Recreate Archive From Scratch. Zipping from plugins/ stores claude-kit/ at the
# archive root. -X drops platform extra-attributes for more reproducible output.
rm -f "$ZIP_PATH"
cd "$SCRIPT_DIR/plugins"
zip -r -X -q "$PLUGIN_NAME.zip" "$PLUGIN_NAME" \
    -x "*/.DS_Store" -x "*/Thumbs.db" -x "*/desktop.ini"

echo "Built $ZIP_PATH"
