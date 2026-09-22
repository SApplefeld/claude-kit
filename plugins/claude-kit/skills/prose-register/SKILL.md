---
name: prose-register
description: "Use when writing or reviewing any prose for a reader beyond a single passage: a deliverable document, an article, a ticket, an email and a pull request body are among the instances. Use also for any piece that names a voice."
---

# Prose register

This skill holds four things: the recipe, the scaling, the voice references and the tells catalog. It keeps three things out, each with its owner. The rule itself is the doctrine's, stated in its Directness and register section (`skills/operating-instructions/SKILL.md` under the kit plugin root). The sentence bars are `writing-skills`', in its "What a sentence has to earn" section. The review procedure is the `prose-reviewer` charter's: its pass order, its severity ladder and its conflict rule. So a sentence found here that states a rule, a bar or a review step is a defect. It is routed to its owner rather than kept as a fifth thing.

The doctrine's register bullet names the three layers and this skill's place among them. This skill states how a writer applies each structure bullet and how a reviewer checks it, and never what a bullet requires, which the doctrine states once.

## The recipe

Each item names a doctrine bullet from Directness and register by its lead, then the writer's move and the reviewer's check. The items are a catalog a reader scans, so each leads in bold.

- **The answer comes first, at every scale.** The writer drafts, then reads the last sentence of each unit, since a first draft tends to arrive at its point rather than open with it. The units are the piece, its sections, its paragraphs and its bullets. Where the last sentence carries the point, it moves to the front and the rest becomes support. The reviewer reads first sentences alone, across those same four units. A unit whose first sentence does not carry its point is a finding. The marketing override works in three parts. The piece declares the override in one sentence on the piece itself, naming it as marketing copy. The reviewer reads the declaration and withholds this bullet alone. Nothing else in the register changes, and a piece carrying no declaration takes the bullet whatever it is for.
- **Structure follows what the reader will look for, never the word count.** The writer places a heading only after naming the thing a reader would open the piece to find there, since a heading placed because the text ran long marks nothing. A heading names that thing, as a noun phrase. The question form belongs to a table's column headings, per the doctrine's bullet. So a heading is never a question and never an instruction. The reviewer reads the headings alone, as the piece's table of contents. A heading that names nothing a reader would look up is a finding, and so is one phrased as a question or an instruction. A table column headed with a label where the reader brought a question is a finding too.
- **A rule is stated, then its reason, as separate sentences.** The writer writes the rule as one sentence and the reason as the next. Then the writer reads each rule sentence for a "because" or a "so that" inside it, which is the reason riding in the rule's clause. Before bolding a lead, the writer decides whether the passage is a catalog a reader scans or an argument a reader follows, and bolds only in the first. The reviewer reads a bolded passage as a list of labels and asks whether the reader would scan it for those labels. Bold leads on an argument are a finding, and so is a rule whose reason sits inside its own clause.
- **A concrete case lands a passage and never leads one.** The writer writes the rule and its reason first, then asks whether a reader could follow them without a case. Where the answer is no, one case closes the passage, carrying the illustrative marking the doctrine's bullet requires. A list the writer cannot close is written as open, with its class named where the list ends, as `writing-skills`' close-every-enumeration rule states. The reviewer hunts four shapes: a case that opens a passage, and a second case where one would do. The other two are an unmarked instance a reader could take for the boundary, and a list written as closed whose class is open.
- **A claim is written in the form a reader can check.** The writer reads each claim and asks what the reader would need to verify it from where they sit, then supplies it. That is each form the doctrine's bullet lists, and the claim's status per its Verify before you claim section. The reviewer picks claims and tries to check each from the piece alone. A claim that cannot be checked without a research pass is a finding.

## The scaling

How much of the register a piece takes is decided by two readings the writer makes of the piece. The first reading: will a reader open the piece to look something up? The second reading: does the piece carry an argument or a catalog? The doctrine's scaling bullet fixes what its three sizes take, and this section states what each combination of the two readings takes.

- **Not looked up, an argument.** A passage. It takes what the doctrine's scaling bullet gives a headingless passage, in prose with plain leads. A reply, a code comment and a commit body are instances.
- **Not looked up, a catalog.** A short list. It takes the passage's share, with a bold lead on each item and the item's reason beside it. A field list in a pull request body and a list of defaults in a reply are instances.
- **Looked up, an argument.** A titled piece. It takes the passage's share plus the title's own rule, which is that the title states the piece's point. A heading sits only where the doctrine's heading bullet places one. An article and a ticket are instances.
- **Looked up, a catalog.** A document. It takes the titled piece's share plus every heading and column the doctrine's heading bullet governs, and a bold lead on each catalog item. A knowledge-base article and a deliverable document are instances.

The readings are made per piece and again per passage inside it, since a document carries argument sections and catalog sections side by side, and each takes its own combination. The artifact kinds above are instances of a combination and never the boundary. A kind named nowhere here takes the two readings and the combination they give. The voice layer rides on whichever combination the piece takes, wherever the piece names a voice.

## The voice layer

Which layer changes with whose name is on the piece is the doctrine's register bullet's to say, and this section states where each voice lives. `references/voice-scott.md` carries the operator's voice, and `Voice: scott` names it. Its admission is a gating definition. A voice rule is what changes with whose name is on the piece, and the reference carries voice rules only. A structure rule is the doctrine's, a sentence rule is the plain-prose bullet's and `writing-skills`', and a tell is the catalog's. None of the three is admitted, whatever voice it is written for. `Voice: company` and any other value name no reference today and take the register alone. A voice reference for another name is added as a sibling file under `references/`, under the same admission, when a piece in that voice is needed.

## The tells catalog

`references/ai-tells.md` catalogs the patterns that make a document read as machine-written. A writer reads it before finishing a draft, since the tells survive every structure bullet and voice rule. A reviewer hunts its patterns by name and quotes the passage, whatever the voice, so writer and reviewer work from one list. Where a pattern carries a licensed form, the catalog states the licence beside the pattern, and where the licence's owner is elsewhere the catalog points at it.
