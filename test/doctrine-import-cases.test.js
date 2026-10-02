// The one table of CLAUDE.md texts that both doctrine import predicates are
// held to: the doctrine-refresh hook's wiring offer, read by
// test/doctrine-refresh.test.js, and the doctor's Doctrine import check, read
// by test/doctor-rename-migration.test.js. Each row is a CLAUDE.md text and
// whether Claude Code imports ~/.claude/grimoire-doctrine.md from it, by the
// import grammar of https://code.claude.com/docs/en/memory: an import is
// `@path` anywhere in the text, code spans, fenced blocks and HTML comments are
// skipped, the path ends at whitespace, and a quoted path is not imported.
//
// The table lives in a .test.js file because every tracked file under test/
// other than the probes and the size budget is measured as a test file. Run
// directly by the suite, it checks its own shape; required by the two test
// files above, it only exports the rows.

'use strict';

const CASES = [
    { name: 'the bare token', text: '# Global notes\n@grimoire-doctrine.md\n', imported: true },
    { name: 'a ./ path', text: '@./grimoire-doctrine.md\n', imported: true },
    { name: 'a ~/.claude/ path', text: '@~/.claude/grimoire-doctrine.md\n', imported: true },
    { name: 'a mid-sentence import', text: 'See @grimoire-doctrine.md for the rules.\n', imported: true },
    { name: 'an annotated import, CRLF', text: '# Global\r\n@grimoire-doctrine.md  # kit doctrine\r\n', imported: true },
    { name: 'an import indented three spaces', text: '   @grimoire-doctrine.md\n', imported: true },
    { name: 'an import indented four spaces', text: '# Global\n\n    @grimoire-doctrine.md\n', imported: false },
    { name: 'an import indented by a tab', text: '\t@grimoire-doctrine.md\n', imported: false },
    { name: 'a code span', text: 'Import it with `@grimoire-doctrine.md` on its own line.\n', imported: false },
    { name: 'a fenced block, CRLF', text: '```\r\n@grimoire-doctrine.md\r\n```\r\n', imported: false },
    { name: 'an HTML comment', text: '<!--\n@grimoire-doctrine.md\n-->\n', imported: false },
    { name: 'the .bak name', text: '@grimoire-doctrine.md.bak\n', imported: false },
    { name: 'a quoted path', text: '"@grimoire-doctrine.md"\n', imported: false },
    { name: 'another directory', text: '@docs/grimoire-doctrine.md\n', imported: false },
    { name: 'another letter case', text: '@Grimoire-Doctrine.md\n', imported: false }
];

module.exports = { CASES };

if (require.main === module) {
    const { test } = require('node:test');
    const assert = require('node:assert');

    // Both consuming loops pass vacuously on an empty or one-sided table, so
    // the table carries rows of both answers, each with a distinct name.
    test('the doctrine import case table holds both answers, each row well-formed', () => {
        assert.ok(CASES.some((c) => c.imported) && CASES.some((c) => !c.imported));
        assert.strictEqual(new Set(CASES.map((c) => c.name)).size, CASES.length);
        for (const c of CASES) {
            assert.strictEqual(typeof c.text, 'string', c.name);
            assert.strictEqual(typeof c.imported, 'boolean', c.name);
        }
    });
}
