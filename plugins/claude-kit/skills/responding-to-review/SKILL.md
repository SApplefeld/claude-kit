---
name: responding-to-review
description: "Use when a review agent returns findings, when I give feedback or a correction, or before implementing a suggestion from either, especially when it seems wrong, unclear, or larger than the problem. Triggers: adversarial/blind/security/qa/docs review output to adjudicate, a 'you're right' about to be typed, pushback you are tempted to swallow."
---

# Responding to Review

A review finding is an input to your judgment, not an order to execute. Evaluate before you act.

## Two Sources

**Review-agent findings** (adversarial-reviewer, blind-reviewer, prose-reviewer, blind-reader, plan-reviewer, security-reviewer, performance-reviewer, qa-verifier, and any other lens that returns findings) are fallible. A finding can be wrong, out of scope, or built on context the agent lacked. Each one owes you an honest verdict. Pushing back on a wrong finding with the reason is correct, not insubordinate. Adjudicate every finding. Do not rubber-stamp, and do not reflexively defer.

Read a finding's trace before its severity. A `trace: none` on a Major claims that no acceptance bullet, Goal sentence or Intent clause asked for what the finding names. Re-trace that claim against the trace target before holding anything on it. Then send the finding to the provenance paragraph in executing-work's step 4, not into a fix. A blind lens carries no trace by design, so trace its findings yourself. A Critical from a correctness lens keeps its own route whatever its trace. An advisory lens's Critical or Major, the performance-reviewer's or the security-reviewer's, takes the advisory disposition paragraph at executing-work's step 4 for its route, and nothing here. The docs-curator's Drift Report carries no severity ratings, and you route it to me per finishing-work. Finishing-work's step 5 defines the adjudications that are yours and how each is recorded. The pre-change read a `mistake`'s `Basis:` line calls for is one of them.

**My feedback** is trusted: implement once you understand it. Still verify scope when it is unclear, and still say so when you see a problem with it.

## How to Respond

1. **Read the whole set before reacting.** Understand the set, then act, not finding-by-finding in a panic.
2. **Verify against the code, not the claim.** Before implementing a finding, confirm it is real in the actual code and on this stack. A finding whose substance is an absence is a scope claim first, so re-read the spec section before you design the fix. An absence outside what the section asked for takes executing-work's out-of-scope route at its step 4 rather than a fix here.
3. **YAGNI-check "do it properly."** A pushed-for configurability, abstraction, or "professional" feature must be needed now. Grep for its caller. Unused means say so and leave it out.
4. **Push back with the reason, up front.** When a finding is wrong, say why and show the evidence (the code, the test, the constraint). Hold under pushback. Move on a new fact, not on tone. A bare challenge (pushback carrying no new fact) buys one re-verification of your cited evidence before you restate: re-open the code, re-run the test. A re-check that reproduces the evidence means hold, saying what you re-checked. One that finds it thinner than you claimed is the new fact - downgrade out loud. If you pushed back and were wrong, say so plainly and implement, with no defense of why you pushed back.
5. **Triage and record.** Critical, Major, Minor are handled exactly as executing-work's "Address findings" step defines. This skill governs how you weigh and answer a finding before that triage.

## Corroboration Outranks Severity

When two lenses with no contact land on the same defect, weight that convergence above either finding's severity when you order the fixes. So a corroborated Major goes ahead of a lone Critical. A lone Critical still gets step 2's verification against the code before it is implemented.

The kit builds its lenses to have no contact. Blind lenses get only the base ref or the document, and sighted ones hold the spec. A round's lenses are dispatched together, and none reads another's output. Order does not break independence: finishing runs its qa-verifier before the reviews and its docs-curator after them. What breaks it is what the lenses share.

Two findings from one lens, a reviewer handed another's output, and two agents given the same contaminating framing are one observation reported twice. Shared standing-brief content counts the same way. A `Standing Brief Amendments` entry riding every sighted brief, or a repo-wide defect class named in both briefs, points two lenses at one defect class. Executing-work's contamination test clears that content, but the convergence it produces is still one input answered twice. Check what each lens was given, standing content included, before you count them as two.

Shared evidence breaks independence too. Two lenses given nothing in common can converge on an artifact this effort wrote, such as a fixture or a stub. So separate what the convergence is about. The effort's own artifacts are the review's subject, and two lenses landing on the same defect in them is corroboration. Two lenses citing such an artifact as evidence of a fact the effort does not own are one finding, not two. That fact is what a contract requires, what a tool prints, or how a system outside the effort behaves. Corroboration about it takes evidence originating outside the effort.

An artifact authored before this effort began counts toward independence, though it still states no contract. Merge state is not the test, since a section that pushes as it closes leaves the effort's own artifacts merged.

A claim about a contract cites the contract's owning surface, which outranks any artifact written to exercise it. Among those surfaces are the schema, the interface, the directory or protocol spec, the published shape, and, for what a tool prints, the line in the tool's own source that emits it. Those surfaces are instances rather than the boundary: the owning surface is wherever the fact's own producer defines it, never a copy that restates it. Where no owning surface states the contract, the contract is unstated and the artifact asserting it is a proposal rather than the source. Fixtures, stubs, golden files, sample payloads, and generated files are instances rather than the boundary: the class is any artifact this effort authored, cited as evidence of a fact the effort does not own.

## Claim Finding Fixes

The class and its exceptions are executing-work's (`skills/executing-work/SKILL.md` under the kit plugin root). So are the dispositions of a claim the exceptions do not hold, listed at its step 4. A fix brief for such a claim never carries a replacement sentence. A claim an exception holds is owed the behavior bar in the same fix round. Every other claim lands in the close pass that step owns.

## Reviewer Clearances

A reviewer's explicit clearance ("this line is fine", "no issue here", "no finding on X") is a claim about the code, not a fact you inherit. Never adopt a load-bearing clearance on the agent's word alone. It owes step 2's verification against the code before the section closes on it.

A clearance is load-bearing when believing it retires a check you would otherwise run. The lens may say the trust boundary holds, that model-writable input cannot reach the sink, or that the code refuses a case. Each is a property you now rely on and nobody verified, so verify it. A bare `APPROVED` verdict retires no specific check and does not put you back in the diff. Executing-work's orchestrator-stays-lean rule keeps you out of a full diff you are not adjudicating.

When two lenses contradict on one passage, one clearing what the other rates a defect, adopt neither verdict. The artifact settles which holds, and which artifact depends on the question. For what the code does, trace the code yourself. Record the trace's evidence (the branch order you read, the file:line, the path you followed), not the verdict you sided with. For whether the code does what was asked, the spec settles it, since internally consistent code can still be the wrong behavior. Read the section's own words in the spec and record that reading.

Neither severity nor specialty breaks the tie, though specialty tells you which lens could see what. A verdict from a lens structurally denied the relevant input is evidence about the artifact it did hold and never a ruling on the one it did not.

## No Performative Agreement

The anti-sycophancy rule in the kit doctrine (imported via `~/.claude/CLAUDE.md`) governs here in full. In a review reply that means no "Good catch", no "You're absolutely right", no thanking the reviewer or me for the finding. State the fix, or state the disagreement. The changed code shows you heard it.
