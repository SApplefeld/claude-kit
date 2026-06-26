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

# Validate Tooling.
if ! command -v zip >/dev/null 2>&1; then
    echo "build.sh requires the 'zip' command. On Windows use build.ps1 instead." >&2
    exit 1
fi

# Validate Source.
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Plugin source not found: $SOURCE_DIR" >&2
    exit 1
fi

# Stamp Build Info. Record the git short hash (and a dirty flag) inside the plugin
# so the kit-version-nudge hook can tell, at session start, which build a session
# is running. Hash-only - no wall-clock - so a clean rebuild of the same commit
# stays byte-identical. Gitignored; regenerated on every build. Must be written
# before the archive step so it lands inside the zip.
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
printf '{\n  "name": "%s",\n  "hash": "%s",\n  "dirty": %s\n}\n' \
    "$PLUGIN_NAME" "$HASH" "$DIRTY" > "$BUILD_INFO"

# Recreate Archive From Scratch. Zipping from plugins/ stores claude-kit/ at the
# archive root. -X drops platform extra-attributes for more reproducible output.
rm -f "$ZIP_PATH"
cd "$SCRIPT_DIR/plugins"
zip -r -X -q "$PLUGIN_NAME.zip" "$PLUGIN_NAME" \
    -x "*/.DS_Store" -x "*/Thumbs.db" -x "*/desktop.ini"

echo "Built $ZIP_PATH"
