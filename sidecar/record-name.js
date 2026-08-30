// Which memory record names this daemon will handle.
//
// The name is spelled into a `memq get <name>` line that the delivery valve
// puts in front of a session and a reader may run, so the kit's capture hook
// screens it on its own side and drops any item whose record name falls outside
// this set. That makes the pattern a property of the channel rather than of
// whichever module needed it first, and two modules here need it: the index
// reader, which must not offer a name the delivery side would refuse, and the
// inbox writer, which must not queue an item nothing will ever deliver.
//
// It lives in its own module for that reason. A pattern reached by requiring
// whichever sibling happens to hold it makes the borrower fail when that
// sibling does, and a pattern copied into the second consumer is one the third
// gets wrong.
//
// The kit's hook holds the other implementation of this same property, in
// plugins/claude-kit/hooks/kit-sidecar-capture.js, because the process boundary
// forbids a shared require: the contract between the two halves is a file on
// disk. The two are pinned equal by a test rather than shared.

'use strict';

const RECORD_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;

function isRecordName(name) {
    return typeof name === 'string' && RECORD_NAME_RE.test(name);
}

module.exports = {
    RECORD_NAME_RE,
    isRecordName
};
