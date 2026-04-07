# GEO Strategy — Generative Engine Optimisation

## What GEO Is

GEO optimises content to be cited by AI engines — ChatGPT, Perplexity, Google AI Overviews, and similar generative search tools. Traditional SEO optimises for search engine ranking positions. GEO optimises for being the source an AI pulls from when generating an answer.

The two are not mutually exclusive, but when they conflict, GEO takes priority for this operation.

---

## Core Principles

### 1. Answer First, Elaborate Second

AI engines extract answers from the first substantive sentences of a section. Every H2 section should open with a direct, self-contained answer to the question implied by the heading, then elaborate with evidence and nuance.

**Bad:**
> Running shoes are a complex topic with many factors to consider. Different runners have different needs based on their gait, foot shape, and running surface preferences...

**Good:**
> The best running shoes for flat feet provide structured arch support and motion control to prevent overpronation. Brooks Adrenaline GTS and ASICS Gel-Kayano are the top-rated options for this foot type according to Podiatry Today (2025)...

### 2. Structured for Extraction

AI engines parse content structurally. Use patterns that make extraction easy:

- **Definition openings:** "X is [definition]. It works by [mechanism]."
- **Numbered lists for processes:** Steps that AI can extract as a sequence.
- **Comparison tables:** Structured data that AI can reference directly.
- **FAQ sections:** Q&A pairs where each answer is self-contained.
- **Data with attribution:** "According to [source] ([year]), [stat]" — AI engines prefer citable claims.

### 3. Authoritative Sourcing

AI engines weight content by perceived authority. Every article must demonstrate expertise through:

- Specific statistics with named sources and dates (never "studies show")
- Tier 1 and Tier 2 source prioritisation (see intents.md for tier definitions)
- Recency — data from the last 24 months where possible
- E-E-A-T signals — first-hand experience markers, expert quotes, methodology transparency

### 4. Query-Intent Alignment

AI engines match content to user prompts. Each article should target not just a keyword but a **prompt pattern** — how someone would ask an AI about this topic.

For every article, Scout identifies:
- **Primary query:** The traditional search keyword
- **AI prompt variants:** How someone would phrase this as a question to ChatGPT/Perplexity
- **Follow-up prompts:** What they'd ask next after getting the initial answer

Content should address all three layers.

---

## Structural Patterns for GEO

### The Definitive Answer Block

Place this within the first 200 words of the article and within the first 2 sentences of each major H2 section:

```
[Direct answer to the section's implied question — 1-2 sentences]
[Supporting evidence with cited source — 1-2 sentences]
[Nuance or caveat — 1 sentence]
```

This block is what AI engines are most likely to extract and cite.

### The Comparison Matrix

For comparison-type content, include a structured table early:

```
| Feature | Option A | Option B | Option C |
|---------|----------|----------|----------|
| [criterion] | [value] | [value] | [value] |
```

AI engines extract tabular data more reliably than prose comparisons.

### The FAQ Cluster

For pillar pages and guides, include a FAQ section with 3-8 questions. Each answer should be:
- Self-contained (makes sense without reading the rest of the article)
- 100-300 words
- Structured as: [Direct answer] → [Evidence] → [Practical implication]

### The Step Sequence

For how-to content, use explicitly numbered steps with clear action verbs:

```
## Step 1: [Action verb] [Object]
[2-3 sentence explanation]

## Step 2: [Action verb] [Object]
[2-3 sentence explanation]
```

AI engines parse numbered sequences as procedural knowledge and cite them as step-by-step instructions.

---

## What to Avoid

- **Vague hedging:** "It depends" without specifying what it depends on. Always follow conditional language with the conditions.
- **Intro fluff:** "In today's fast-paced world..." — AI engines skip filler and so do readers.
- **Unsourced claims:** Any factual claim without a named, dated source. AI engines deprioritise unattributed content.
- **Keyword stuffing:** Repeating the target keyword unnaturally. AI engines evaluate semantic relevance, not keyword density.
- **Thin sections:** H2 sections under 100 words. Either merge them or expand them. AI engines need enough content per section to extract a meaningful answer.
- **Orphan content:** Articles with no internal links to other content on the same blog. Internal linking signals topical authority to both search engines and AI systems.

---

## Measuring GEO Success

Track these signals over time (manually for now, automated later):

1. **AI citation checks:** Periodically ask ChatGPT, Perplexity, and Google AI Overviews questions your content targets. Note whether your content is cited.
2. **Referral traffic from AI platforms:** Monitor analytics for traffic from chat.openai.com, perplexity.ai, and similar referrers.
3. **Featured snippet capture:** Google featured snippets often feed into AI Overviews. Track snippet ownership.
4. **Content freshness:** AI engines prefer recent content. Flag articles older than 30 days since last meaningful edit for freshness review.
