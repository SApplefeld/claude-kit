# Machine-Prose Tells

Patterns that make a document read as machine-written. A writer avoids them before finishing a draft; a reviewer hunts them by name and quotes the passage, whatever the voice.

None is wrong alone. What marks the prose is the pattern held without variation: one triad is a sentence, a triad in every paragraph is a signature. A finding is usually about frequency and uniformity rather than one line, and it says which it is.

## Banned Outright

Each item here is a finding on one instance rather than on frequency. This catalog owns each item except the one pointing at its owner, listed so the hunt list is complete.

- Rhetorical questions in body prose. The one licensed form is the self-answer device (`"The answer to solve this? Impersonation."`), at most once per document. An opening on a question is the same tell. So is a question-form heading. The doctrine's heading bullet (Directness and Register) places the question form in a table's column headings, and the recipe's heading item in this skill's `SKILL.md` puts it nowhere else.
- Emoji, anywhere.
- Motivational vocabulary: "unlock", "leverage", "empower", "transform", "revolutionize", "game-changer", "world-class" and "cutting-edge" among them.
- Hype adjectives unsupported by a figure. "Significant" stays where its figure follows.
- "In conclusion" and "To summarize" signposting on a closing section. The final section states the result.
- Em dashes. The doctrine's Style bullet owns the rule and the replacements.
- Hedges stacked more than one deep on a single claim. One hedge claims confidence, and a stack claims nothing.

## Pattern Catalog

### Triadic Rhythm by Default

Three-item lists and three-clause sentences are the machine's resting cadence. Human enumeration is lumpy.

Tell: "The service is fast, reliable, and secure. It handles authentication, authorization, and auditing across the web, mobile, and API surfaces."

Rewrite: "The service handles authentication and authorization. It also writes an audit record for every call, which is the part that matters when a customer disputes a charge."

The rewrite drops one item, keeps two, and spends the saved words on why the second earns its place. A real three-member set takes three. The finding is a document where nearly every set has three.

### Negation-Then-Correction Framing

"It is not X, it is Y" stages a reversal against a view no reader proposed.

Tell: "This is not a configuration change. It is a change to how the system thinks about identity."

Rewrite: "The change moves identity resolution out of the config file and into the token itself."

The `However,` pivot `voice-scott.md` licenses is different: it argues against a position a real reader holds. The tell argues against a straw position invented one clause earlier.

### Uniform Paragraph and Sentence Length

Every paragraph three sentences, every sentence the same length. The doctrine's plain-prose bullet (Directness and Register) states the positive rule, that sentence length varies. To measure the tell, take a section's sentence lengths and read the spread. Sentences all within a few words of each other read as generated, even when every one is true.

Tell: "The service validates every inbound request against the schema before it reaches the handler, which keeps malformed payloads out of the business logic. The handler then resolves the tenant from the token rather than from the request body, so a caller cannot address another tenant's data. Each write is recorded in the audit table with the resolved tenant and the caller's identity attached, so every change can be traced." Three sentences of 23 words each, and the next two paragraphs are built the same way.

Rewrite: "The service validates every inbound request against the schema before it reaches the handler, and resolves the tenant from the token rather than the request body, so a caller cannot address another tenant's data. Every write lands in the audit table. That last part is what an auditor actually asks for."

### Bold Lead-In on Every Bullet

The doctrine's rule-then-reason bullet (Directness and Register) licenses a **Bold term:** lead where the passage is a catalog a reader scans, and owns that bound. On every bullet, argument bullets included, it turns prose into a rack of labels.

Tell:

- **Performance:** Queries return faster.
- **Reliability:** Fewer failures occur.
- **Cost:** Spend goes down.

Rewrite: "The cache is keyed on tenant, so a cross-tenant read cannot hit. Eviction is manual, because nothing here changes often enough to earn a timer. The cache is process-local and does not survive a restart."

Keep the bullets and the bold only where the reader will scan for that term later, as in a catalog entry or a lookup table.

### Signposting and Throat-Clearing

"It is worth noting that", "importantly", "in essence", "at its core", "simply put", "that said". Each spends a clause telling the reader how to receive the next. The test is to cut it: if the sentence is unchanged, it was throat-clearing. The hand-holding forms on a close, "Remember:" and "The takeaway is:", are the same tell and fail the same test.

Tell: "It is worth noting that the migration is reversible."

Rewrite: "The migration is reversible."

A contrast marker with an antecedent, such as `However,`, survives the test, because removing it changes the logical relation.

### Structural Previews

A paragraph describing the structure of the section that follows. The reader can see the section.

Tell: "The following section walks through the three components of the design, covering what each one does and how it connects to the others."

Rewrite: delete it and start with the section's thesis sentence.

An early scope statement saying what the piece will and will not cover is licensed, since it draws a boundary rather than previewing structure. The tell is the preview repeated at the head of every section.

### Restating Close

A closing summary whose every sentence appeared earlier in different words.

The end-state close in `voice-scott.md` is the opposite move: it states what the reader now has after applying the design. That is new information the body arrived at, not repeated from it.

Tell: "In summary, the design separates the two roles, restricts the permissions on each, and audits the boundary between them."

Rewrite: "The result is an operator who can run every report and cannot read a single card number."

### One-Line Moral Endings

An aphoristic sentence, set off alone, telling the reader what the section meant. Once is emphasis. At the foot of every section it is a template.

Tell: a section on retry policy that ends "Resilience is not a feature you add later." A section on logging that ends "You cannot fix what you cannot see."

Rewrite: end on the concrete consequence instead. "A request that fails all three retries lands in the dead-letter queue with the original payload intact."

### Generated Vocabulary

Practised readers flag these words on sight as generated: `delve`, `robust`, `seamless`, `comprehensive`, `streamline`, `crucial`, `landscape` (figurative), `realm`, `myriad`, `testament to`, `navigate` (figurative), `in today's [adjective] world`, and `ensure` where `make sure` or a plain verb would do. `leverage` is in the Banned Outright list above.

Tell: "In today's fast-moving compliance landscape, a comprehensive audit trail is crucial to ensuring seamless reporting."

Rewrite: "An auditor who asks who approved a refund on 14 March needs one query to answer it. The audit trail is what makes that query possible."

These words are not banned: `robust` in a statistics context and `ensure` in a contract clause are the right words. The finding is density and figurative use. Swapping the word and keeping the empty sentence fixes nothing. The tell above asserts no fact, and the rewrite works because it adds one.

### Over-Parallel Headers

Headers built from one template: five sections all reading "Understanding X", all gerunds, or all one syllable count. Forcing one shape usually bends a section to fit its label.

Tell: `Understanding the Problem` / `Understanding the Solution` / `Understanding the Tradeoffs`

Rewrite: `Original Failure` / `Split Permissions` / `Cost At Volume`

The doctrine's heading bullet (Directness and Register) sets what a header names, and `voice-scott.md` sets its case. This tell is headers too alike, which passes both checks and still reads as generated. A standard name reused for a recurring section, such as "Test Coverage" or "Operator Notes" across pieces, is that bullet's own rule and never this tell.

### Trailing Participial Clauses

The comma-plus-participle tail: ", ensuring that", ", allowing teams to", ", making it easy to", ", providing a foundation for". It appends a benefit to a fact without arguing for it, and it stacks without limit.

Tell: "The gateway caches the token, reducing round trips and allowing downstream services to authorize locally, ensuring consistent latency."

Rewrite: "The gateway caches the token. Downstream services authorize against the cached copy, which removes a network hop from every call after the first."

One tail in a document is fine. Three in a paragraph is the pattern.

### Non-Committal Verdict

A close that lists options, gives each a merit, and declines to pick.

Tell: "Both approaches have their merits, and the right choice depends on your specific needs and priorities."

Rewrite: "Take the queue. It costs an extra service to run, and it is the only option that survives the warehouse being offline for a shift."

This is also a defect against the doctrine's answer-first bullet (Directness and Register), since a piece opens with its verdict. A document reaching its last paragraph without one usually never had one to open with.

### Bullets Restating the Paragraph

A bullet list right after a prose paragraph repeats its points as fragments. It looks like structure and carries nothing new.

Tell: "The rollout is staged by region. We start in Canada because it is the smallest book, move to the United Kingdom once a full billing cycle has closed there, and finish in the United States." Followed immediately by:

- **Canada:** first, because it is the smallest book.
- **United Kingdom:** second, after a full billing cycle closes in Canada.
- **United States:** last.

Rewrite: "The rollout is staged by region, smallest book first, each region waiting on a full billing cycle in the one before it."

- **Canada:** 3 March, owned by Priya.
- **United Kingdom:** 7 April, owned by Tom.
- **United States:** 12 May, owned by Priya.

Keep whichever carries the detail. Here the paragraph holds the argument and the list holds dates and owners the paragraph never had. Where the list would only re-say the sentence, cut the list.

### Weightless Intensifiers

`truly`, `really`, `incredibly`, `highly`, `vital`, `essential`, `powerful`, and `significantly` with no figure behind it. This is the adverbial form of the Banned Outright hype-adjective ban, and it slips past that ban by attaching to ordinary words.

Tell: "This is a highly effective approach that significantly reduces load."

Rewrite: "The approach cuts read load on the primary by about 60 percent at peak."
