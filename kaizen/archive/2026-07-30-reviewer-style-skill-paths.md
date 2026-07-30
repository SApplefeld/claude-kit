# Kaizen brief: the adversarial reviewer cannot find the style skills it must judge by

Friction: `plugins/claude-kit/agents/adversarial-reviewer.md:30` tells the reviewer to judge house style against "the csharp-style and sql-style skills," but subagents inherit no skills and the definition names no path. Observed in production: a reviewer reported it could not find the style skill at all and judged by repo convention, which the doctrine explicitly says is not the authority. Implementer dispatch briefs carry the paths; reviewer dispatches do not.

Change: fix at the point of action rather than the dispatch contract, so it holds even when an orchestrator forgets: the House style bullet in `adversarial-reviewer.md` names the two SKILL.md files by their stable marketplace-clone paths (`~/.claude/plugins/marketplaces/applefeld/plugins/claude-kit/skills/csharp-style/SKILL.md` and `.../sql-style/SKILL.md`, plus their references/ files when present), and gains a conditional for the absent case: when the files cannot be read, state that in the findings and do not silently substitute repo convention. Blind-reviewer needs nothing (its charter excludes style review); security-reviewer does not judge style.

Acceptance: the House style bullet names both paths in the stable form; the cannot-read case is an observable conditional, not an exemption clause; no dispatch-side restatement is added (one owner).

Discipline: follow writing-skills; baseline-test any behavior-shaping wording.
