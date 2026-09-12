# Global instructions
@claude-kit-doctrine.md

# graphify
- **graphify** (`~/.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, invoke the Skill tool with `skill: "graphify"` before doing anything else.

**Using an existing graph.** When a codebase has a `graphify-out/` directory, treat `/graphify query` as the first orientation pass for architecture and relationship questions before reading files broadly. The graph is one more secondary source under the doctrine's Verify before you claim rules. A graph claim is a finding to confirm against the file it cites before you act on it, and commits after its last build are its staleness signal. Query an existing graph freely. Building a new one is the user's call, not an unprompted step.
