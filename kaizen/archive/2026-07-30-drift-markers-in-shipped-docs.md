# Kaizen brief: docs-curator writes drift markers into shipped docs

Friction: `plugins/claude-kit/agents/docs-curator.md:58` instructs the curator to mark drifted passages with `<!-- DRIFT: Dn pending adjudication -->` in the shipped doc. Nothing sweeps the markers, so they accumulate: the AI OS repo carried seven unadjudicated markers across four finishing passes, and a later pass had to renumber its report from D8 to avoid colliding with them. A marker is change-narrative inside a curated artifact, which the doctrine's state-not-journey rule forbids, and the report numbering has no slot that survives without it.

Change: in `docs-curator.md`, remove the marker instruction. Replace the mechanism: every Drift Report entry carries the file:line of the passage it concerns, so adjudication can find it from the report alone; and add an explicit prohibition on writing drift, adjudication, or any change-narrative marker into a shipped doc, with the report named as the only channel. The failure is production-observed (the seven standing markers), so the RED stands on that evidence; the fix is structural (a required file:line slot plus a prohibition at the point of the removed instruction), not pressure-sensitive wording.

Acceptance: `docs-curator.md` contains no instruction to write a marker; the Drift Report format's per-item template requires a file:line; a prohibition names the marker pattern and the report as the only drift channel.

Discipline: follow writing-skills; baseline-test any behavior-shaping wording.
