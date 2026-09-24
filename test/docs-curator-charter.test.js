// Tests for the docs-curator charter: plugins/claude-kit/agents/docs-curator.md
//
// The charter describes a deliverable under docs/, and a PreToolUse guard
// decides which subagent may write there. This pins that the charter states
// the guard's rule in one paragraph: the guard's name, the agent type it
// admits, and the route for any other dispatch. The assertions read that one
// paragraph rather than the whole file, since the charter names its own agent
// type and the .kit/ path elsewhere, and a whole-file match could not go red.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const CHARTER = path.join(__dirname, '..', 'plugins', 'claude-kit', 'agents', 'docs-curator.md');

// The paragraph naming the guard, line endings normalized so an LF-authored
// pattern matches on an autocrlf checkout. Null where no paragraph names it.
function guardParagraph(text) {
    const paragraphs = text.replace(/\r\n/g, '\n').split(/\n\s*\n/);
    return paragraphs.find((p) => p.includes('docs-write-guard')) || null;
}

test('the docs-curator charter states the docs-write-guard rule in one paragraph', () => {
    const paragraph = guardParagraph(fs.readFileSync(CHARTER, 'utf8'));
    assert.ok(paragraph, 'no paragraph of the charter names docs-write-guard');
    assert.match(paragraph, /`docs-curator`/, 'the guard paragraph must name the admitted agent type docs-curator');
    assert.match(paragraph, /`claude-kit:docs-curator`/, 'the guard paragraph must name the plugin-scoped agent type');
    assert.match(paragraph, /\.kit\//, 'the guard paragraph must name the .kit/ route for any other dispatch');
});
