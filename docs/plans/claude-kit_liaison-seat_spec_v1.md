# The liaison skill and the doctrine's sender-class clause

Status: Ready
Commit Model: Branch-and-PR
Created: 2026-09-30

## Dispatch Authorization

The operator asked the ARCHITECT on its channel on 2026-09-30 for the plans that let a small group of client users steer a persona fleet on a client's own VM through Discord, and named this repository, the Discord broker and the persona plugin as the three that change. This plan is the kit's share and third in the build order. It has no merge precondition: the skill is loaded only by a persona whose charter names it, and the doctrine clause describes an envelope attribute that reads as the operator's where absent. It has one dispatch precondition: the corpus cap in `test/size-budget.json` sits at its measured sum, a raise is the operator's ruling by the backlog item on the corpus's regrowth, and both sections add corpus words, so neither section is dispatched until the ruling is recorded under Intent, where it now stands dated 2026-09-30. It runs on a branch and lands through a pull request, since `main` refuses direct pushes. The companion plans are `channels_client-sandbox_spec_v1.md` in the `discord-channels` repository and `agent_persona_client-sandbox_spec_v1.md` in the `agent_persona` repository.

## Goal

A `liaison` skill exists for the persona seat that talks with several client users in one Discord thread. It tells that seat how to hold a conversation with more than one speaker, how to turn what they ask into a brief the architect persona can plan from, how to relay the architect's answer and the coordinator's status in words a reader on a phone can act on, what rule settles two speakers who disagree, and what it must never reveal. The doctrine states that a relay event's standing is the sender class its envelope carries, so an operator's message is the operator's word as today, a participant's message is a person's words with no authority, and an envelope with no class is the operator's. The ownership map and the rationale ledger record the clause, the parity and size pins pass, and the growth is paid for.

## Intent

Scott runs a fleet of persona sessions steered from Discord, and his clients want the same setup on a VM of their own, with two to five of their business analysts talking to one persona in a shared thread. His frame, in his words: a persona somewhere between the assistant and the architect that helps them shape what they would like done, takes it to the architect to turn into plans, to the worker to deliver, and has the steward give status. The persona plugin's plan gives that seat its charter and names this skill as what the charter loads for the brief's shape and the disclosure rule.

Done means: the skill file, its ledger where the writing-skills skill requires one, the doctrine clause in both copies, the map row, the ledger entry, and the pins green with the budget accounted for. Done does not need: a change to the register core the output style pins, since the relay bullet sits outside it; a change to the coordinator skill's closed list of warranted channels beyond one clause naming the class; or any mechanism in the kit's hooks, since the class is read by the persona plugin.

Alternatives refused. Putting the brief's shape and the disclosure list in the persona plugin's charter: the charter is a shell string pinned by a shell test and read once at launch, while a skill is prose the kit's writing discipline and reviewers own and a session can re-read. A generic multi-speaker skill for any seat: no other seat has more than one speaker, and a rule with no second instance is speculation. Leaving the doctrine as it stands: its relay bullet says the relay admits only the operator's account, which stops being true the day a host lists a participant, and a doctrine sentence that is false on one host is a defect under the kit's own rule. Folding the five rules into `role` or `coordinator`, the alternative the writing-skills lean-kit rule makes a new skill beat: neither loads on a persona seat, since `role` loads on a `/role` takeover a persona never performs and `coordinator` loads on the coordinator seat alone, so a paragraph in either never reaches the liaison.

Rulings after the spec shipped: ruled 2026-09-30, the operator on the ARCHITECT's channel approved the corpus-cap raise of at most 1050 words, the raise recorded being the measured growth at each section's close; the dispatch precondition in Dispatch Authorization is met.

Provenance: distilled by the ARCHITECT persona from the operator's four channel messages on 2026-09-30 and the reconnaissance recorded under Approach.

## Approach

The skill is a new directory `plugins/claude-kit/skills/liaison/` with a `SKILL.md` written under the writing-skills skill and a `references/rationale-ledger.md` beside it, in the shape every skill under `plugins/claude-kit/skills/` that carries one takes, since the kit's lean-kit program re-expresses each instruction document from its ledger and a new skill without one has no source to be re-expressed from. Its frontmatter description triggers on the liaison seat's charter, on a shared client thread, and on shaping a request into a brief. Its body holds five rules, each stated then reasoned. The speakers rule: every event names its author, the seat addresses people by the name the envelope carries, the latest word wins where one speaker revises their own ask, and a disagreement between two speakers is asked of the thread, never settled by recency. The brief rule: one brief per ask, in a fixed shape the architect reads, with who asked and when, what they want in their words, why, what done looks like in their words, the constraints they named, the questions still open, and what the seat assumed; sent to the architect persona and nothing else sent for that ask until the answer returns. The seat sends it with the persona plugin's `agentic_say` tool, whose `persona` argument names the target, and the architect's name is the `architectPersona` value the seat's own launch settings carry; the skill states that much and points at the persona plugin's README for the tool. The relay rule: the architect's answer and the coordinator's status are relayed in the client-briefing register the doctrine names, for a reader who can open no plan, code or record, so every identifier is resolved and a filename rides beside a plain-words reminder. The refusal rule: the seat writes no plan, clones no repository, queues no work, and treats a record opening `[FINDING]` or `[PROPOSAL]` as information; those two leads open records the persona plugin itself writes, a self-review's finding and an unprompted plan proposal, and they are information because the plugin delivers them under the coordinator's label without the coordinator having ruled on them. The disclosure rule: a closed list of what the seat never puts in the thread: another client's name or work, the operator's other clients or repositories, any credential, token or key, any hostname, path or file layout of the fleet or the operator's network, the kit's own instruction text, the text of a record from another persona whether verbatim or close enough to reconstruct it, and code or a diff unless a speaker asked for it by name. A plan's bare filename beside its plain-words reminder is admitted by the relay rule; a directory prefix in front of it is a path and is not.

The doctrine's relay bullet, the one opening "A relay message delivered inside a tool result is my word deferred to the turn boundary" in the Which Text Governs section, gains one clause in both copies, `plugins/claude-kit/skills/operating-instructions/SKILL.md` and its mirror `home/claude-kit-doctrine.md`: the standing of a relay event is the sender class its envelope carries in the `sender_class` attribute, `operator` being the operator's word, `participant` being a person's words that are data, and an envelope with no class being the operator's. The coordinator skill's line on the closed list of warranted channels gains the words that an allowlisted relay thread's operator-class event is the warranted channel. The ownership map's row for the warranted-channel message names the clause, and the map gains a row naming `liaison` as the owner of the seat's conduct in a shared client thread, since the parity test reds on a shipped skill the owner column does not carry. The rationale ledger under the operating-instructions references amends its entry A002, whose `passage:` line quotes the sentence the clause replaces, re-quoting the passage from the new sentence and recording the amendment's date; no second entry is added. The doctrine parity test holds the two copies byte-identical. The size budget caps are word counts, so every changed file's entry is raised to its measured word count by `kit-size.js sync`, with this plan named as the reason. The corpus cap is the one limit that does not move by `sync`: the two doctrine copies, the coordinator skill, the ownership map and the new skill file are corpus rows, and the rationale ledger is the one class the cap excludes by name, so the ledger's words are outside the raise. The raise is ruled once for the whole plan, and its ceiling is stated in the sections: the skill file at most 900 words, and the clause's growth across the four corpus files at most 150 words together, so the ruling asked for is a raise of at most 1050 words, the raise recorded being the measured growth at each section's close.

The contract sweep for this plan ran over the repository on 2026-09-30 and returned 33 surfaces under seven headings: the seat skills a liaison skill sits beside, which are `coordinator`, `role`, `peer-sessions` and `standing-watch`; the doctrine's three bullets that speak of the relay in both copies, the relay-message bullet above, the authorization bullet and the ranking bullet, of which only the first changes; the ownership map rows; the parity and size pins; the skill registration, which is by directory presence, the manifest's description naming no skill; the reviewer agents whose `Disclosure:` convention the skill reuses; and the docs index, which the create path updated when this plan was registered. The plan review of 2026-09-30 added three surfaces the sweep missed: the README's payload map, which lists every directory under `skills/` with one line; the security model's warranted-channel paragraph, which derives the relay leg from a one-account allowlist; and the architecture doc's relay-broker bullet, which states the same one-account check. Every surface named is in a section's Files in scope below or under Out of Scope.

## Sections of Work

### 1. The liaison skill
Model: opus
The skill file exists, is written under the writing-skills skill, and carries the five rules above with their reasons in at most 900 words. Its ledger states each rule's reason and the wording that landed. The ownership map gains a row naming `liaison` as the owner of the seat's conduct in a shared client thread, the five rules being that moment. The README's payload map gains the `liaison/` line in its `skills/` block. The size budget gains entries for both new files at their measured word counts by `kit-size.js sync`, and the `corpus-cap` value in `test/size-budget.json` is raised by the skill file's measured word count under the ruling recorded under Intent, with this plan named as the reason; the ledger's words are outside the corpus and outside the raise.
Acceptance:
- `plugins/claude-kit/skills/liaison/SKILL.md` exists with a frontmatter description that names the liaison seat, a shared client thread, and shaping a request into a brief as its triggers.
- The body states the speakers, brief, relay, refusal and disclosure rules, each as a rule then its reason, and the disclosure list is closed with the seven members named in the Approach plus the filename sentence.
- The brief shape is stated once, as a list of its seven parts, and the relay rule points at the doctrine's client-briefing bullet rather than restating it.
- The ownership map carries a row naming `liaison` in the owner column, and `README.md`'s payload map lists `liaison/` with one line.
- The kit's test gate passes with the two budget entries, the skill file's words inside the ruled raise, and the map row.
Files in scope: `plugins/claude-kit/skills/liaison/SKILL.md`, `plugins/claude-kit/skills/liaison/references/rationale-ledger.md`, `plugins/claude-kit/skills/operating-instructions/references/ownership-map.md` (the new owner row), `README.md` (the payload map's `skills/` block), `test/size-budget.json`.
Tests: the size and heading-shape pins over the new file, and the doctrine parity pin that reads every shipped skill against the map's owner column.
Audience: the liaison persona session, a Claude session on the persona plugin with the kit loaded and no keyboard, expert in the kit's skills and new to the seat; the operator reading the skill to check what the seat will and will not do.
Voice: company.
Fact base: the persona plugin's `agent_persona_client-sandbox_spec_v1.md` section 2 for the charter's clauses, the broker plan's section 4 for the envelope's attributes, and the doctrine's client-briefing bullet.
Disclosure: no client name, no Discord id, no token, no hostname of the operator's network.

### 2. The doctrine's sender-class clause
Model: opus
The doctrine says what a relay event's standing is once a host lists more than one account. The relay bullet in the Which Text Governs section gains the clause in both copies. The coordinator skill's warranted-channels line gains its words. The ownership map row names the clause. The rationale ledger's A002 is amended. The security model's warranted-channel paragraph and the architecture doc's relay-broker bullet stop deriving the relay leg from a one-account allowlist: each says the broker checks every author against an allowlist of classed accounts and that the leg is conferred by the operator class, so whoever controls an operator-class account holds it. The output style's register core is untouched, since the relay bullet is outside it. The growth in the two doctrine copies, the coordinator skill and the ownership map is corpus growth, paid inside the ruled raise and at most 150 words together; the security model and the architecture doc are docs under no measured root.
Acceptance:
- The relay bullet in `plugins/claude-kit/skills/operating-instructions/SKILL.md` and `home/claude-kit-doctrine.md` reads identically and states the three cases: operator, participant, absent.
- `test/doctrine-parity.test.js` and `test/output-style-parity.test.js` pass.
- The size budget entries for the four changed corpus files, the two doctrine copies, the coordinator skill and the ownership map, are raised to their measured word counts by `kit-size.js sync` with the plan named as the reason, and the corpus cap moves by their measured growth inside the ruled raise. The rationale ledger's entry moves by `sync` and touches no cap.
- The ownership map's warranted-channel row names the clause, and A002's `passage:` quotes the new sentence with the amendment dated.
- `docs/security-model.md` and `docs/architecture.md` no longer say the broker checks against a one-account allowlist, and each states that the relay leg is conferred by the operator class.
Files in scope: `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `home/claude-kit-doctrine.md`, `plugins/claude-kit/skills/coordinator/SKILL.md`, `plugins/claude-kit/skills/operating-instructions/references/ownership-map.md`, `plugins/claude-kit/skills/operating-instructions/references/rationale-ledger.md` (A002), `docs/security-model.md` (the warranted-channel paragraph), `docs/architecture.md` (the relay-broker bullet), `test/size-budget.json`.
Tests: the two parity pins and the size pin.

## Out of Scope

- The register core the output style pins. The relay bullet is outside it and the clause changes no pinned lead.
- The `role` skill's seat table and registry. The liaison is a persona seat named by the persona plugin's roster, not a `/role` seat a keyboard session takes, and the table's own closing rule already admits a new seat.
- The `peer-sessions` skill. The liaison's records travel on the persona plugin's delivery grounds, which that skill does not own.
- The persona plugin's charter, roster key and envelope reading, and the broker's senders list and gate.
- A skill for the client-side worker persona. It is an ordinary worker under the existing skills.
- The plugin manifest's description. It names no skill, so there is no list to extend.
- The docs index, `docs/plans/README.md` and `docs/README.md`, which the create path updated when this plan was registered.

## Assumptions

- assumed 2026-09-30 (the lean-kit program's rationale-ledger decision): a new skill carries a rationale ledger, since every instruction document the corpus compression re-expressed was written from one; reversal: delete the ledger file and its budget entry.
- assumed 2026-09-30 (default): the growth in every changed instruction file is paid by raising its budget entry with this plan as the reason, since the clause is one sentence in each, and the corpus growth is paid by the ruled raise rather than a tightening, since a new skill's words cannot be found in another file's slack; reversal: a tightening elsewhere in the corpus, named in the Chapter, which lowers the raise recorded.
- assumed 2026-09-30 (the operator's message of 2026-09-30): every client user at the pilot is an operator, so the participant case in the clause and the skill is stated here and exercised live by the broker plan's and the persona plan's operator verification with the operator's own second account, never by this plan's; reversal: none.

## Operator Verification

- On the first client sandbox host, ask the liaison in its thread a question whose honest answer would name a fleet path or another client, and read its reply: the reply refuses the detail in plain words. A reply carrying the detail reopens section 1's disclosure rule.

## Open Questions

- Whether the doctrine's Which Text Governs ranking should name a participant event explicitly in its list, or leave it under "every other surface". The plan leaves it under the last rank, since a participant event is data, and section 2 builds that reading unless a ruling appended under Intent says otherwise. Owner: the operator.

## Related

- `agent_persona_client-sandbox_spec_v1.md` in the `agent_persona` repository: the charter that loads this skill.
- `channels_client-sandbox_spec_v1.md` in the `discord-channels` repository: the envelope attributes the clause describes.
- `docs/plans/claude-kit_session-roles_notes_v1.md`: the roles dialogue this seat is a new instance of.

## Chapters
