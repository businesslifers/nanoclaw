# Blog Writing Spec: "Human Voice" (Model Guide)

Purpose: Produce blog articles that read like an authored piece, not generic assistant prose.
Source basis: Wikipedia's "Signs of AI writing" (quality signals).

---

## 1) Output Contract (must follow)

### Voice & stance

- Write as an **author**, not a helper.
- Use **plain language**. Prefer direct verbs over "analysis verbs".
- Avoid promotional or grandiose framing.

### Specificity requirement (hard rule)

Every section must include **at least one** of:

- a concrete example (numbers, timelines, constraints, tradeoffs), OR
- a named source/reference (only if provided), OR
- a clear personal stance + rationale ("I think X because Y"), OR
- an actionable step someone can do.

### Attribution rule (hard rule)

- Do not use vague authorities ("experts say", "research shows") unless the source is **named**.
- If no source is available: own the claim ("In my experience...") or remove it.

### Ending rule (hard rule)

- No "In conclusion / In summary / Overall".
- End with either: **next step**, **caveat**, **specific takeaway**, or **question**.

---

## 2) Forbidden Patterns (search-and-destroy)

If any appear, rewrite or delete.

### A) Importance theater (replace with consequences)

Forbidden phrases (examples):

- "pivotal", "crucial", "significant", "testament", "marks a shift", "evolving landscape"

Fix:

- Replace with *who/what changed* + *what measurable/observable impact occurred*.

### B) Promotional/tourism copy

Forbidden style:

- "vibrant", "rich tapestry", "nestled", "renowned", "groundbreaking", "stunning", "unlock", "elevate"

Fix:

- Replace with neutral descriptors + concrete specifics (features, numbers, constraints).

### C) Weasel attribution

Forbidden:

- "experts argue", "observers note", "industry reports", "it is widely believed"

Fix:

- Name a source (if provided) OR remove/downgrade to an authored opinion with reasons.

### D) Superficial analysis verbs

Forbidden (when they add no content):

- "highlights", "underscores", "reflects", "ensuring", "contributing"

Fix:

- Replace with "means", "caused", "led to", "so", "because".

### E) Em-dashes and en-dashes

Forbidden:

- `—` (em-dash), `–` (en-dash), and their ASCII equivalents (`---`, `--`)

Fix:

- Rewrite the sentence to avoid the dash entirely. Use a period, comma, colon, or parentheses instead.
- "We built three features --- auth, billing, and notifications" becomes "We built three features: auth, billing, and notifications."
- "The migration took two hours --- longer than expected" becomes "The migration took two hours, longer than expected."

### F) Assistant voice

Forbidden:

- "Of course", "You're absolutely right", "I hope this helps", "Would you like..."

Fix:

- Remove. Keep author tone.

### G) Hedging phrases

Forbidden:

- "it's important to note", "it's worth mentioning", "keep in mind that", "it should be noted", "one thing to consider", "it bears mentioning"

Fix:

- State the point directly. "It's worth noting that the API changed in version 3" becomes "The API changed in version 3."

### H) Connector phrase monotony

Forbidden pattern (repetition, not individual phrases):

- If "Let's explore/look at/examine/dive into" appears more than once in a post, rewrite all but the first occurrence.
- If any forward-reference phrase ("Let's...", "Now we'll...", "Next, we'll...") appears in more than 2 section endings, vary them.

Fix:

- Use direct transitions, end on a concrete claim, or simply start the next section without a bridge.

### I) Artificial balance

Forbidden:

- More than one "on one hand... on the other hand" construction per post.
- Sections that present exactly two equally-weighted sides without taking a stance.

Fix:

- Take a position. "On one hand X, on the other hand Y" becomes "X matters more here because Z. Y is a factor, but only when W."

---

## 3) Draft Structure Template (recommended)

### Title

Specific and concrete. Avoid hype.

### Lede (2-4 sentences)

- State the actual problem/topic.
- Include one concrete detail (number, scenario, constraint).

### Body sections (3-6)

Each section must satisfy the **Specificity requirement**:

- A claim
- Evidence/example/constraint
- A "so what" that is concrete (decision, tradeoff, action)

### Close (2-4 sentences)

- Next step / caveat / memorable takeaway / question
- No generic future-gazing.

---

## 4) Quality Gates (must pass before final)

### Gate 1: Specificity audit

For each paragraph:

- What is the single main claim?
- What detail makes this paragraph non-interchangeable?
- If none -> add example/constraint or cut.

### Gate 2: Puffery & weasel purge

- Remove importance theater words.
- Remove promo adjectives.
- Remove unnamed "experts say" claims.
- Remove hedging phrases ("it's important to note", "it's worth mentioning", etc.).
- **Adverb density**: Count "-ly" adverbs (exclude "only", "early", "likely", "family", "daily", "apply", "supply"). Target: <4 per 1K words. Watch for: "significantly", "dramatically", "effectively", "essentially", "fundamentally", "incredibly".

### Gate 3: Cadence & texture

1. **Sentence length variation**: Vary sentence length. Standard deviation of sentence word counts must be >4. Include at least one short sentence (<8 words) per section for emphasis.
2. **Paragraph length variation**: Not every paragraph should be 3-4 sentences. Mix single-sentence paragraphs, 2-sentence paragraphs, and 4-5 sentence paragraphs. Standard deviation of paragraph word counts must be >15.
3. **Opening word diversity**: No single word should start more than 20% of all sentences. Watch for "This", "It", "The" as repetitive openers.
4. **Transition diversity**: No transition/connector phrase should appear more than twice in a post. Ratio of unique transitions to total transitions must be >0.5.
5. **List-to-prose ratio**: Bullet/numbered lists should comprise no more than 40% of the post's word count (excluding FAQ and TL;DR sections). For listicle/roundup/faq intents, threshold is 60%. If exceeded, convert some lists back to prose.
6. **Prose/list mixing**: Avoid repetitive "**Bold**: explanation" formatting. Mix prose with occasional lists.

---

## 5) Rewrite Recipes (use when text feels AI-ish)

### Recipe A: "Show the consequence"

Before: "This is significant because it changes the landscape."
After: "It cut onboarding from 5 steps to 2, and support tickets dropped the next week."

### Recipe B: "Own the claim"

Before: "Experts say consistency matters."
After: "Consistency matters because it reduces the number of decisions you have to make under stress."

### Recipe C: "De-hype"

Before: "A groundbreaking solution..."
After: "It does three things: X, Y, Z. The tradeoff is A."

### Recipe D: "Cut the hedge"

Before: "It's worth noting that the API changed in version 3."
After: "The API changed in version 3."

Before: "It's important to keep in mind that caching adds complexity."
After: "Caching adds complexity."

### Recipe E: "Break the pattern"

Before: Every section follows "Topic sentence. Supporting detail. Example. Transition to next."
After: Vary section openings (start with an example, a question, a short declarative). Vary section endings (end on a claim, end on a caveat, end mid-thought and let the next section pick it up). Not every section needs a transition out.

---

## 6) Quick self-check list (one screen)

- [ ] Each section has a concrete example/constraint/tradeoff
- [ ] No "experts say" without naming who
- [ ] No hype adjectives / brochure tone
- [ ] No template conclusion phrases
- [ ] No em-dashes or en-dashes anywhere
- [ ] No assistant voice
- [ ] Verbs are direct ("means/caused/led to"), not "underscores/highlights"
- [ ] No hedging phrases ("it's important to note", "it's worth mentioning")
- [ ] Forward-reference phrases ("Let's explore...") appear at most once
- [ ] Each section takes a stance rather than presenting artificial balance
- [ ] Fewer than 4 "-ly" adverbs per 1K words
- [ ] No single word starts more than 20% of sentences
