#!/usr/bin/env node
// kit-statusline launcher: the stable entry point for the kit's status-line
// widget. Doctor -Fix copies this file to ~/.claude/bin/kit-statusline.js
// beside memq-shim.js, and a status-line tool (ccstatusline's Custom Command
// widget) runs it by that path:
//
//   node "%USERPROFILE%\.claude\bin\kit-statusline.js"
//
// The widget itself (scripts/kit-goal-statusline.js) stays inside the
// installed plugin payload, whose cache path carries the release version and
// so rots at the next kit update if baked into a durable setting. This file
// bakes in nothing: it resolves the installed payload through memq-shim.js's
// resolver on every invocation, and runs the widget from there, so a kit
// update needs no doctor re-run. The status-line JSON on stdin passes
// straight through to the widget.
//
// Blank output is the widget's own "nothing armed" answer, so this launcher
// prints nothing on the failures a status line cannot act on either (no
// installed payload, a payload from before the widget existed): a status
// line is no place for an error message, and exit 0 keeps the tool from
// reporting one.

'use strict';

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { resolveMemq } = require('./memq-shim.js');

const WIDGET_REL = 'kit-goal-statusline.js';

function main() {
    const memqPath = resolveMemq();
    if (memqPath === null) return;
    const widget = path.join(path.dirname(memqPath), WIDGET_REL);
    if (!fs.existsSync(widget)) return;
    const child = spawnSync(process.execPath, [widget], { stdio: 'inherit' });
    if (child.error) return;
    process.exitCode = child.status === null ? 0 : child.status;
}

if (require.main === module) main();
