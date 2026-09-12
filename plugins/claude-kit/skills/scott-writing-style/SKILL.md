---
name: scott-writing-style
description: "Guide to writing in the style of Scott Applefeld. Use whenever asked for a document, draft, or other written output that will be sent by Scott Applefeld or intended to mimic his style."
---

# Scott's Writing Structure - Outline Skill

Rules for writing in the author's voice, drawn from samples of his own work: technical proposals, benefit analyses, architecture docs, and email replies.

Follow these rules when drafting in Scott's voice. Where the samples disagree, the dominant pattern is listed first and the exception is flagged.

---

## 1. OPENING

- Open with a **blunt declarative statement of the core premise**, not a question, not a quote, not a scene.
- Opening paragraph = **1 to 3 sentences, 25–55 words**.
- The opening sentence starts with a frame-setter: `"First, it's fundamentally important to understand…"`, `"The following diagram provides a high-level introduction to…"`, `"The most valuable resource to the business is…"`, `"To provide a complete solution for…"`.
- Never open with a question.
- Never open with a quote, anecdote, or scene-setting (no "Picture this…", no customer quote).
- **Email exception**: If the piece is an email reply, open with a one-line personal acknowledgement (`"Thanks [Name]!"`) before the frame-setter. Keep the acknowledgement to one line.

## 2. WHAT COMES SECOND

After the opener, deliver **context/definition before verdict**. The second move is always one of:

- A definitional clarification: what the thing under discussion actually is.
- A scope statement: what this document will and will not cover.
- A goal statement: the outcome the reader should expect.

Do **not** state the verdict or recommendation second. Verdicts land at the end of a section or the end of the piece, after the reasoning.

## 3. BODY - NUMBER OF SECTIONS

- Default to **4 to 6 top-level sections**, 4 a hard floor and 6 a hard ceiling, and collapse past 6.
- Most sections have **2 to 3 nested sub-sections** when the topic needs drill-down. Nest at most two levels deep (section → sub-section → bullet list) and never three levels deep in prose. Only two structures run three levels deep: the numbered 1 → a → i list for steps, components, and ranked items, and a field or parameter catalog.

## 4. SECTION HEADERS

- Headers are **short noun phrases**, 2–4 words, Title Case or ALL CAPS. Never longer than about 5 words.
  - Examples: `INTEGRATION DESIGN`, `Improving Retention`.
- Never question-form headers.
- Never command/imperative headers ("Do this", "Fix that").
- Never full-sentence headers.
- Case follows formality: ALL CAPS for technical and internal docs and for a short proposal-style enumeration (an email listing goal, approach, cost, timeframe), Title Case for longer client-facing proposals and benefit docs. Pick one style per document and stay consistent.
- Sub-section headers follow the same rule: short noun phrase, often 2–3 words, Title Case (`Turnover Costs`, `Pay Drivers Sooner`, `Quick Workflow Execution`).

## 5. SECTION LENGTH

- Average section body: **90–180 words** before any sub-sections or bullets.
- Each section opens with a **single declarative sentence that states the section's thesis**, followed by 2–4 paragraphs of 2–4 sentences each. The rest of the section supports it.
- If a section would exceed ~220 words without structure, break it into sub-sections rather than letting it run long.
- Sub-sections are typically **40–100 words**.

## 6. PATTERNS USED REPEATEDLY

Use these. They are the signature moves.

**"However" pivots.** Build the status quo the reader holds, then pivot with `However,` or `By comparison,` or `Comparatively,` to why it is not sufficient.

**Numbered lists for enumerated mechanics.** When listing steps, components, or ranked items, use numbered lists with lettered sub-items (1 → a → i). This appears across the proposal, benefit, and architecture samples.

**Bulleted lists for catalogs and field definitions.** Use them for non-ranked items such as fields, data points, and options. Each bullet is typically **bold term + colon or line break + explanation**.

**Italics for emphasis on a single word.** Pattern: `"any user"`, `"every"` record, `"all"`, `"nothing"`, a key technical term, `"per year"`. One italicized word per sentence, max. Used to stress magnitude, universality, or a key technical term.

**Bold numerics for anchoring quantitative claims.** In benefit and cost analyses especially: `**$X,XXX,XXX**`, `**X% reduction**`, `**$X.XX per unit per month**`, `**XX%**`. Bold the number and its unit together.

**Concrete numbers over adjectives.** Back every claim of impact with a concrete number rather than an adjective. Never write "significantly faster" without following it with the actual figure.

**Short summary paragraph at the end of each section.** 1–2 sentences restating the conclusion. Then move on.

**Concrete examples after abstract explanation.** After stating an abstract rule, introduce a single named example (`"The classic simple example for this is X. Let's say I want to update X…"`), walk through it, and resolve it.

**Prose paragraphs, not bulleted arguments.** Carry the reasoning in prose paragraphs, even in technical docs. Reserve bullets for catalogs and field lists.

**No em dashes.** Per the doctrine's style rule, which owns the replacement list.

**Parenthetical asides for caveats.** `"(as some of our customers have…)"`, `"(not every customer does)"`, `"(option A, option B, option C)"`. Use parentheses for scope-limiting caveats rather than a new sentence.

**Sentence length varies deliberately.** Long explanatory sentences (30–50 words) interleaved with short landing sentences (5–12 words) at the end of a paragraph. `"The answer to solve this? Impersonation."` `"This is a difficult problem."`

**First-person plural voice in technical/proposal writing.** Default to "we" (`"We create a new role with restricted permissions."`). Use "I" for subjective framing (`"In my opinion…"`), and freely only in a direct one-to-one email.

## 7. CLOSING

- Close with a **restatement of the end state / net result**, not a gut punch, not a rhetorical question, not a rallying cry.
- The final section is frequently labeled `END RESULT`, `Aftermath`, `Resolution`, or functions as a summary even without an explicit header.
- Structure of close: 2–4 short sentences that tell the reader *what you now have* after applying the design/approach/process. Past tense or present-indicative, not future-promise.
- Example pattern: `"The ultimate result of this design is that we have…"`
- **Email exception**: Emails close with an invitation to respond (`"I look forward to your feedback and thoughts. Let me know if you'd like to touch base via a call…"`) + signoff. That's the only place a CTA appears.
- No motivational closes. No exclamation marks at the end of a document body (email signoffs excepted). No "Remember:" or "The takeaway is:" hand-holding.

## 8. NEVER DO

Conspicuously absent across all the samples:

- **No rhetorical questions in the body prose.** The single exception is the self-answer device `"The answer to solve this? Impersonation."` - used maybe once per document, never more.
- **No emoji.** Zero.
- **No motivational language.** No "unlock", "leverage", "empower", "transform", "revolutionize", "game-changer", "world-class", "cutting-edge".
- **No marketing hype adjectives unsupported by numbers.** "Significant" appears, but always followed by the figure that justifies it.
- **No "In conclusion" / "To summarize" signposting.** The final section simply states the result.
- **No second person ("you") as the primary voice.** `"you"` appears occasionally for instructional framing (`"if you choose to…"`) but the dominant voice is `we` in proposal/technical work.
- **No contractions in technical documentation.** Contractions appear in emails (`"we've"`, `"I'll"`, `"don't"`) but are rare in the formal technical PDFs.
- **No Oxford-comma inconsistency within a document.** Pick and stick.
- **No passive voice as the default.** Write in active construction ("We create…") and reserve passive voice for describing third-party system behavior.
- **No hedging stacked deep.** Use at most one hedge per claim, such as `"typically"` or `"usually"`.

## MACHINE-PROSE TELLS

The NEVER DO list above covers what is absent from the samples. A second class of defect is present in no sample and appears in generated drafts constantly: patterns that read as machine-written regardless of whether the claims are true. The catalog lives in `references/ai-tells.md` beside this file, with the pattern, why it reads as machine-written, and a before/after rewrite for each.

Read it in both directions. A writer drafting in this voice reads it before finishing a draft, because the tells survive every rule above (a document can obey Sections 1 through 8 and still read as generated). A reviewer of a document in this voice reads the same file and hunts the patterns by name, so writer and reviewer work from one list rather than two.

---

## CONTRADICTIONS ACROSS THE SAMPLES

Flagged honestly:

**Section count**: Status/review writing is denser (a few major buckets with many nested items) than the proposal-style docs (4–6 roughly parallel sections). Status/review writing nests more; proposal/explanatory writing stays flatter.