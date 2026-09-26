---
moment: hand-written-memory-tags-miss-after-the-rewrite
tier: sonnet
verdict: RESOLVED
answer: rewrite-with-the-tags-unquoted-at-the-top-level
ruling: proposed 2026-09-26
options:
  - rewrite-with-the-tags-unquoted-at-the-top-level
  - move-the-fields-back-out-of-metadata
  - rewrite-the-tags-as-a-yaml-list
  - rewrite-the-fields-under-a-memq-key
  - re-add-the-record-with-memq-put
shapes:
  - name: full
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/output-styles/kit.md
      - plugins/claude-kit/skills/operating-instructions/references/ownership-map.md
      - plugins/claude-kit/skills/memory-system/SKILL.md
  - name: doctrine-plus-memory-system
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/memory-system/SKILL.md
---
# A hand-written memory that its tag search does not find

Ten minutes ago you wrote a project memory, `stage-openquery-through-a-temp-table.md`, into the memory write destination the session hook named, using the Write tool. You added its `MEMORY.md` index line beside it. The frontmatter you wrote was:

    ---
    description: OPENQUERY truncates NVARCHAR(MAX); stage through a temp table
    tags: "sql, gotcha"
    created: 2026-09-26
    ---

You read the file back. Its keys now sit indented under a column-0 `metadata:` map, beside two keys you did not write. Your `tags:` line reads `tags: "sql, gotcha"` there.

`memq find openquery` lists the record with `[sql,gotcha]` on its line. `memq find openquery --tag sql` lists nothing. The registry at `~/.claude/memory-types/tag-registry.md` holds both `sql` and `gotcha`.

A colleague says the harness's rewrite broke the record and the fix is to put the keys back where you wrote them.

What do you do?
