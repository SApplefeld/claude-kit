// Shared predicate: does a hook payload belong to a subagent's tool call?
//
// A subagent's payload carries the PARENT session's `session_id`, byte for byte,
// so no session-id test can tell one from a main-thread call. The agent-identity
// keys can, and every hook that must not act inside a subagent asks the same
// question of the same five spellings. The breadth is the point: the cost of
// reading one key too many is a main-session call misread as a subagent's on a
// harness that never sends it, and the cost of reading one too few is a whole
// class of subagent calls invisible to every detector at once.
//
// This is its own module, holding nothing else, for the reason
// hooks/kit-network-lib.js states for its own predicate: a hot hook path cannot
// pay a large module's load to answer one question, and a hook that reached into
// a sibling hook for the answer would be taken down silently by any failure
// inside that sibling. Four hooks ask this question on a per-tool-call boundary,
// and one hand-copied set that gains a spelling in three places out of four is a
// leak nothing detects: the sites that kept the old set simply keep answering.
//
// THREE READINGS, because the four call sites genuinely need three and this
// module exists to unify the key set rather than to flatten behaviour that
// differs on purpose:
//
//   agentIdentity      the first truthy value, or null. The caller that wants
//                      to know WHICH identity it saw.
//   isSubagentCall     the same reading as a boolean.
//   carriesAgentKey    presence rather than truthiness, for the caller whose
//                      stand-down is deliberately the wider one.
//
// Truthiness is the reading most callers take. A harness emitting a null or
// empty `agent_id` on every main-session payload would otherwise stand those
// hooks down on every call and retire their features outright, which is a
// failure nothing would report; presence is the stricter reading, and a caller
// takes it when standing down too often is the cheaper of its two errors.
//
// A non-object answers "no identity" rather than throwing: every caller here
// runs inside a hook that must never disturb the session it observes, and each
// one screens the payload's shape on its own account before it gets this far.

'use strict';

const AGENT_KEYS = ['agent_id', 'agent_type', 'agentType', 'subagent_type', 'subagentType'];

function agentIdentity(payload) {
    if (payload === null || typeof payload !== 'object') return null;
    for (const key of AGENT_KEYS) {
        if (payload[key]) return payload[key];
    }
    return null;
}

function isSubagentCall(payload) {
    return agentIdentity(payload) !== null;
}

function carriesAgentKey(payload) {
    if (payload === null || typeof payload !== 'object') return false;
    for (const key of AGENT_KEYS) {
        if (key in payload) return true;
    }
    return false;
}

module.exports = { AGENT_KEYS, agentIdentity, isSubagentCall, carriesAgentKey };
