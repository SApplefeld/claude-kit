// The daemon's door onto the model endpoint: one request, and the
// classification of what came back.
//
// The transport itself lives in plugins/claude-kit/scripts/kit-endpoint-lib.js
// and is re-exported here. Only the plugin tree ships, and memq posts to the
// same endpoint for its own model-judged channel, so the bounded body read, the
// deterministic sampling and the four-way outcome classification are held once
// there rather than twice across a packaging boundary they cannot both cross.
// This module is where the daemon's side of that channel is documented.
//
// WHERE THE DATA GOES. This is the point at which the daemon's content leaves
// this machine. Every request POSTs whatever its caller built to the endpoint
// named in `~/.claude/kit-endpoint.json`. That endpoint does not run on this VM:
// it runs on the Hyper-V host, reached across the virtual switch, over plain
// HTTP with no authentication in the fleet's default configuration, and it is
// shared with other tenants of that host including the operator's own agent
// harness. Two callers send two different payloads across that boundary and
// both are unredacted: sidecar/judge.js sends the observed session's stated
// intent, the full text of the shell command it ran and that command's output,
// and sidecar/recognize.js sends the same situation text together with the
// project memory index, one line per record with its title and description.
// Nothing here redacts, and sidecar/CONTRACT.md states the posture in full.
//
// FOUR TRANSPORT OUTCOMES, NOT TWO. The caller's resilience policy differs by
// outcome, so the classification never collapses them:
//
//   ok           the endpoint answered 2xx with a JSON body and no error key
//   timeout      the request outran its own clock; the lane is serial and has a
//                standing second tenant, so this is a queue, not a fault
//   unreachable  the connection itself failed; the runner may be restarting,
//                which is the one outcome that earns a retry
//   refused      the endpoint answered and said no: a non-2xx status, an error
//                body, or a body that could not be read
//
// The fifth outcome the daemon acts on, `unusable`, is the caller's: whether an
// answer is a verdict or a list of record names is a question about the schema
// that caller asked for, and the transport never sees it.
//
// Collapsing unreachable into timeout would lose the retry, and collapsing
// refused into unreachable would spend a seven-second wait on a server that is
// answering perfectly well.

'use strict';

const lib = require('../plugins/claude-kit/scripts/kit-endpoint-lib.js');

module.exports = {
    MAX_BODY_BYTES: lib.MAX_BODY_BYTES,
    MAX_DETAIL_CHARS: lib.MAX_DETAIL_CHARS,
    TEMPERATURE: lib.TEMPERATURE,
    GAP_REASONS: lib.GAP_REASONS,
    CONNECTION_CODES: lib.CONNECTION_CODES,
    SLOW_CODES: lib.SLOW_CODES,
    errorCode: lib.errorCode,
    classifyThrow: lib.classifyThrow,
    discardBody: lib.discardBody,
    readBoundedBody: lib.readBoundedBody,
    postGenerate: lib.postGenerate
};
