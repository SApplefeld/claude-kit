# Machine-Prose Tells

A catalog of the patterns that make a document read as machine-written. A writer drafting in this voice avoids them; a reviewer of a document in this voice hunts them by name and quotes the passage.

None of these is wrong in isolation. What marks the prose is the pattern held without variation: one triad is a sentence, a triad in every paragraph is a signature. So the finding is almost always about frequency and uniformity, not about a single line, and a reviewer should say which it is.

## Already prohibited in SKILL.md

SKILL.md owns these already, and each item below names the section that states its rule. This file only lists them so the hunt list is complete.

- Em dashes. Section 6's "No em dashes" pattern owns the rule and the replacements.
- Rhetorical questions. Section 8 bans them in body prose, Section 1 bans opening on one, Section 4 bans question-form headers. The one licensed exception is Section 8's self-answer device.
- Motivational and hype vocabulary (`unlock`, `leverage`, `empower`, `transform`, `game-changer`, `world-class`).
- Hedges stacked more than one deep on a single claim.
- "In conclusion" and "To summarize" signposting on the closing section.

## The catalog

### Triadic rhythm as the default

Three-item lists and three-clause sentences are the machine's resting cadence. Human enumeration is lumpy: two items here, five there, one that needs its own sentence.

Tell: "The service is fast, reliable, and secure. It handles authentication, authorization, and auditing across the web, mobile, and API surfaces."

Rewrite: "The service handles authentication and authorization. It also writes an audit record for every call, which is the part that matters when a customer disputes a charge."

The rewrite drops one item, keeps two, and spends the saved words on why the second one earns its place. When a real set has three members, write three. The finding is a document where nearly every set has three.

### "It is not X, it is Y" contrast framing

The negation-then-correction construction manufactures a reversal the reader never proposed. It also flatters: the writer sets up a naive view, attributes it to no one, and knocks it down.

Tell: "This is not a configuration change. It is a change to how the system thinks about identity."

Rewrite: "The change moves identity resolution out of the config file and into the token itself."

Same claim, no staged reversal. Note the family resemblance to Section 6's `However,` pivot, which is licensed: the pivot sets up a real position that a real reader holds, then argues against it. The tell is the pivot against a straw position invented one clause earlier.

### Uniform paragraph and sentence length

Every paragraph three sentences, every sentence twenty-five words. Human paragraphs vary because arguments vary: some points need a page, some need four words.

Section 6's "Sentence length varies deliberately" is the positive rule. The measurable version of the tell: take the sentence lengths in a section and look at the spread. A document whose sentences all sit within a few words of each other reads as generated even when every sentence is true.

Tell: "The service validates every inbound request against the schema before it reaches the handler, which keeps malformed payloads out of the business logic. The handler then resolves the tenant from the token rather than from the request body, so a caller cannot address another tenant's data. Each write is recorded in the audit table with the resolved tenant and the caller's identity attached." Three sentences, 26 to 31 words each, and the next two paragraphs are built the same way.

Rewrite: "The service validates every inbound request against the schema before it reaches the handler, and resolves the tenant from the token rather than the request body, so a caller cannot address another tenant's data. Every write lands in the audit table. That last part is what an auditor actually asks for."

### A bolded lead-in on every bullet

**Bold term:** followed by an explanation is a real pattern (Section 6 licenses it for catalogs and field lists). Applied to every bullet in a document, including bullets carrying an argument, it turns prose into a rack of labels and signals that the labels were generated before the content.

Tell:

- **Performance:** Queries return faster.
- **Reliability:** Fewer failures occur.
- **Cost:** Spend goes down.

Rewrite: run it as prose, or keep the bullets and drop the labels where the bullet is a sentence rather than a catalog entry. Bold the term when the reader will scan for that term later. Do not bold it to make the list look organized.

### Signposting and throat-clearing

"It is worth noting that", "importantly", "in essence", "at its core", "simply put", "that said". Each one spends a clause telling the reader how to receive the next clause. Cut them and the sentence is unchanged, which is the test.

Tell: "It is worth noting that the migration is reversible."

Rewrite: "The migration is reversible."

The one that survives the test is a genuine contrast marker with an antecedent (`However,`), because removing it changes the logical relation.

### Explaining what the reader is about to read

A paragraph that describes the structure of the section following it. The reader can see the section.

Tell: "The following section walks through the three components of the design, covering what each one does and how it connects to the others."

Rewrite: delete it and start with the section's thesis sentence.

Section 2 licenses one narrow version: a scope statement early in the document that says what the piece will and will not cover. That is a boundary, not a preview. The tell is the preview repeated at the head of every section.

### A closing paragraph that restates the body

The summary that adds nothing, recognizable because every sentence in it appeared earlier with different words.

Section 7's close is the opposite move: it states the *end state*, what the reader now has after applying the design. That is new information, arrived at by the body rather than repeated from it.

Tell: "In summary, the design separates the two roles, restricts the permissions on each, and audits the boundary between them."

Rewrite: "The result is an operator who can run every report and cannot read a single card number."

### Every section ending on a one-line moral

The aphoristic sentence, set off alone, that tells the reader what the section meant. Doing it once is emphasis. Doing it at the foot of every section is a template.

Tell: a section on retry policy that ends "Resilience is not a feature you add later." A section on logging that ends "You cannot fix what you cannot see."

Rewrite: end on the concrete consequence instead. "A request that fails all three retries lands in the dead-letter queue with the original payload intact."

Section 6's short summary paragraph is the licensed version, and it differs in kind: it restates the section's *conclusion about the subject*, not a portable maxim that would fit any document.

### The vocabulary set

Certain words appear far more often in generated prose than in written prose, and a reader who reads a lot of both now flags them on sight: `delve`, `robust`, `seamless`, `comprehensive`, `streamline`, `crucial`, `landscape` (figurative), `realm`, `myriad`, `testament to`, `navigate` (figurative), `in today's [adjective] world`, and `ensure` used where `make sure` or a plain verb would do. `leverage` belongs to the NEVER DO list already.

Tell: "In today's fast-moving compliance landscape, a comprehensive audit trail is crucial to ensuring seamless reporting."

Rewrite: "An auditor who asks who approved a refund on 14 March needs one query to answer it. The audit trail is what makes that query possible."

Two notes for a reviewer. First, these words are not banned: `robust` in a statistics context and `ensure` in a contract clause are the right words. The finding is density and figurative use. Second, replacing the word and keeping the empty sentence fixes nothing; the sentence above is a tell because it asserts no fact, and the rewrite works because it adds one.

### Over-parallel headers

Headers built from a template: five sections all reading "Understanding X", or all gerunds, or all the same syllable count. Real sections are not the same shape, and forcing the headers into one shape usually means a section was bent to fit its label.

Tell: `Understanding the Problem` / `Understanding the Solution` / `Understanding the Tradeoffs`

Rewrite: `The Failure` / `Split Permissions` / `Cost At Volume`

Section 4 already sets the header form (short noun phrases, one case convention per document). This tell is about the headers being too alike, which passes Section 4's checks and still reads as generated.

### Trailing participial clauses

The comma-plus-participle tail: ", ensuring that", ", allowing teams to", ", making it easy to", ", providing a foundation for". It appends a benefit to a fact without arguing for it, and it can be stacked forever, which is why generated prose stacks it.

Tell: "The gateway caches the token, reducing round trips and allowing downstream services to authorize locally, ensuring consistent latency."

Rewrite: "The gateway caches the token. Downstream services authorize against the cached copy, which removes a network hop from every call after the first."

One of these tails in a document is fine. Three in a paragraph is the pattern.

### The non-committal verdict

A close that lists options, assigns each a merit, and declines to pick.

Tell: "Both approaches have their merits, and the right choice depends on your specific needs and priorities."

Rewrite: "Take the queue. It costs an extra service to run, and it is the only option that survives the warehouse being offline for a shift."

This one is a defect against Section 7 as well as a tell: the close is supposed to state the net result. A document that reaches its last paragraph without a verdict usually did not have one.

### Bullets that restate the paragraph above them

A prose paragraph makes the argument; a bullet list immediately after repeats the same points as fragments. The list looks like structure and carries no new content.

Tell: "The rollout is staged by region. We start in Canada because it is the smallest book, move to the United Kingdom once a full billing cycle has closed there, and finish in the United States." Followed immediately by:

- **Canada:** first, because it is the smallest book.
- **United Kingdom:** second, after a full billing cycle closes in Canada.
- **United States:** last.

Rewrite: keep whichever one carries the detail. If the regions have distinct dates and owners, cut the paragraph's enumeration and let the list hold it. If the paragraph is the argument, cut the list.

### Weightless intensifiers

`truly`, `really`, `incredibly`, `highly`, `vital`, `essential`, `powerful`, `significantly` with no figure behind it. Section 8 bans hype adjectives unsupported by numbers; this is the adverbial version, and it survives that check by attaching to ordinary words instead of marketing ones.

Tell: "This is a highly effective approach that significantly reduces load."

Rewrite: "The approach cuts read load on the primary by about 60 percent at peak."
