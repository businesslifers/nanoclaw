# Blog Quality Scoring Rubric (100 Points)

Prism uses this rubric to score every article. An article must score **>= 80 out of 100** to pass the text gate.

---

## Scoring Categories

| Category | Points | Sub-checks |
|----------|--------|------------|
| Content Quality | 30 | Depth (5), Readability (7), Originality (5), Structure (4), Engagement (4), Anti-patterns (5) |
| SEO Optimisation | 20 | Title (5), Headings (4), Keyword placement (4), Internal links (2), Meta description (4), URL structure (1) |
| E-E-A-T Signals | 15 | Author (4), Citations (4), Trust indicators (4), Experience signals (3) |
| AI Citation Readiness | 15 | Citable passages (4), Q&A sections (3), Entity definitions (3), Extraction structures (3), TL;DR (2) |
| AI Detection Risk | 20 | Vocabulary diversity (5), Sentence burstiness (4), Trigger word density (3), Transition phrase diversity (3), Opening word diversity (3), Paragraph length variation (2) |

### Grade Bands

| Grade | Score | Outcome |
|-------|-------|---------|
| A | 90-100 | Excellent. Pass. Ready for image gate. |
| B | 80-89 | Good. Pass. Ready for image gate. Minor polish optional. |
| C | 70-79 | Below threshold. Return to Quill with specific fix instructions. |
| D | 60-69 | Significant issues. Return to Quill. Consider re-scoping the research brief. |
| F | <60 | Major rewrite needed. Escalate to the requester if this persists after 2 revision cycles. |

---

## AI Trigger Words (45 words)

These words are disproportionately associated with AI-generated text. Flag any occurrence and rewrite to natural alternatives.

**Note**: Flag trigger words only when used as filler or metaphor. Literal/technical usage is acceptable (e.g., "navigate" in a filesystem tutorial, "journey" in customer journey mapping).

```
delve, tapestry, multifaceted, testament, pivotal, robust, cutting-edge,
furthermore, indeed, moreover, utilize, leverage, comprehensive, landscape,
crucial, foster, illuminate, underscore, embark, endeavor, facilitate,
paramount, nuanced, intricate, meticulous, realm, revolutionize,
transformative, synergy, holistic, empower, unlock, harness,
navigate (metaphorical), journey (metaphorical), game-changer, seamlessly,
ultimately, notably, essentially, importantly, interestingly, elevate,
streamline, cornerstone, spearhead
```

## AI Trigger Phrases (14 phrases)

Multi-word patterns that signal AI-generated text. Count alongside trigger words for density calculations.

```
"it's worth noting", "in today's [X]", "the world of [X]", "dive deep into",
"dive into", "it's important to note", "it's worth mentioning",
"keep in mind that", "it should be noted", "one thing to consider",
"let's explore", "let's look at", "let's examine", "let's dive in"
```

---

## Content Type Benchmarks

| Intent | Word min | Word max | Min H2s |
|--------|----------|----------|---------|
| how-to | 1700 | 2500 | 3 |
| explainer | 1500 | 2500 | 4 |
| listicle | 1500 | 2500 | 5 |
| case-study | 1500 | 2500 | 4 |
| comparison | 1500 | 2500 | 4 |
| pillar-page | 3000 | 5000 | 5 |
| product-review | 1000 | 2000 | 3 |
| thought-leadership | 1000 | 2000 | 3 |
| roundup | 1500 | 2500 | 5 |
| tutorial | 1800 | 3000 | 4 |
| news-analysis | 800 | 1500 | 3 |
| data-research | 2000 | 3500 | 3 |
| faq | 1000 | 2000 | 5 |

---

## Source Tier Classification

Used for scoring external citations in the E-E-A-T category.

- **Tier 1** (2pts each): `.gov`, `.edu`, `.org` (official standards bodies), framework docs, academic/research (arxiv.org, nature.com, scholar.google.com)
- **Tier 2** (1pt each): Major publications (reputable tech sites, industry journals), reputable news/analysis, company engineering blogs
- **Tier 3** (0.5pt each): Other identifiable external sources

Cap citation score at 4 points regardless of source count.

---

## Scoring Sub-check Details

### Content Quality (30 pts)

**Depth (5)**:
- Word count within intent benchmark range = 5
- Word count within 70% of benchmark minimum = 3
- Word count within 50% of benchmark minimum = 1
- Below 50% = 0

**Readability (7)**:
- Average sentence length 12-20 words = 4, outside range = 2, extreme (<8 or >30) = 0
- Has at least one short sentence (<8 words) AND one long sentence (>25 words) per 500 words = 3, has only one extreme = 1, neither = 0

**Originality (5)**:
- First-person experience phrases ("I tested", "we found", "in my experience", "when I", "our team") + specific numbers/dates/names: 3+ markers = 5, 1-2 = 3, 0 = 0

**Structure (4)**:
- H2 count within intent benchmark range = 2
- Clean heading hierarchy (no skipped levels, e.g., H2->H4) = 1
- No single paragraph exceeds 200 words = 1

**Engagement (4)**:
- Questions in prose (not in headings or code blocks) >= 2 = 2, 1 = 1, 0 = 0
- Concrete examples (specific numbers, percentages, named tools) >= 2 = 2, 1 = 1, 0 = 0

**Anti-patterns (5)**:
- Forbidden pattern matches (from writing-spec.md + AI trigger words/phrases): 0 = 5, 1-2 = 3, 3-5 = 1, 6+ = 0

### SEO Optimisation (20 pts)

**Title (5)**:
- Title length 30-60 characters = 3, outside range = 1
- Primary keyword appears in title = 2

**Headings (4)**:
- H2 count meets intent minimum = 2
- Clean heading hierarchy = 1
- At least one question-format H2 = 1

**Keyword placement (4)**:
- Primary keyword appears in first 150 words = 2
- Primary keyword appears in meta description = 2

**Internal links (2)**:
- Internal links to other blog content: 3+ = 2, 1-2 = 1, 0 = 0

**Meta description (4)**:
- Meta description length 100-160 characters = 2, outside = 0
- Contains a number or statistic = 1
- Contains a keyword = 1

**URL structure (1)**:
- Slug is lowercase with hyphens, readable, and 10-60 characters = 1, otherwise = 0

### E-E-A-T Signals (15 pts)

**Author (4)**:
- Named author (not generic like "Team" or "Admin") = 4
- Generic author = 1
- Missing author = 0

**Citations (4)**:
- Count external links, classify by source tier
- Tier 1 source = 2pts each, Tier 2 = 1pt each, Tier 3 = 0.5pt each
- Cap at 4 points total

**Trust indicators (4)**:
- Specific version numbers mentioned = 1
- Specific dates or timelines = 1
- Named tools, products, or frameworks = 1
- Concrete measurements or benchmarks (percentages, milliseconds, counts) = 1

**Experience signals (3)**:
- First-person experience language ("I tested", "we built", "in our case", "when I tried"): 3+ phrases = 3, 1-2 = 1, 0 = 0

### AI Citation Readiness (15 pts)

**Citable passages (4)**:
- Self-contained paragraphs of 100-200 words with a clear claim or definition: 3+ = 4, 2 = 3, 1 = 1, 0 = 0

**Q&A sections (3)**:
- Question-format headings (H2/H3 ending with `?`) or FAQ section: 3+ Q&A pairs = 3, 1-2 = 1, 0 = 0

**Entity definitions (3)**:
- `**term** is/are/means` patterns (bold term followed by definition): 2+ = 3, 1 = 1, 0 = 0

**Extraction structures (3)**:
- Mix of structural elements (bullet lists, numbered lists, tables, code blocks): 3+ distinct types = 3, 2 = 2, 1 = 1, 0 = 0

**TL;DR / Summary (2)**:
- Has a TL;DR section or "Key Takeaways" section = 2, absent = 0

### AI Detection Risk (20 pts)

**Edge case handling**: If a post has fewer than 5 prose sentences (e.g., mostly code or lists), skip burstiness, opening word diversity, and transition diversity checks -- award full points for those sub-checks. If a post has fewer than 500 words, compute TTR on all available words. If a post has fewer than 3 paragraphs, skip paragraph length variation -- award full points.

**Vocabulary diversity (5)**:
- Type-token ratio (unique words / total words) on first 500 words: >0.65 = 5, 0.55-0.65 = 3, <0.55 = 0

**Sentence burstiness (4)**:
- Standard deviation of sentence word counts: >5 = 4, 3-5 = 2, <3 = 0

**Trigger word density (3)**:
- AI trigger words + phrases (from the 45-word + 14-phrase lists) per 1,000 words: <2 = 3, 2-5 = 1, >5 = 0

**Transition phrase diversity (3)**:
- Count transition/connector phrases at sentence starts. Compute ratio of unique transitions to total transitions. >0.7 = 3, 0.5-0.7 = 1, <0.5 = 0

**Opening word diversity (3)**:
- Count the first word of every sentence. Find the most-common opener as a percentage of all sentences. <15% = 3, 15-20% = 1, >20% = 0. Watch for "This", "It", "The" as repetitive openers.

**Paragraph length variation (2)**:
- Compute standard deviation of paragraph word counts (excluding list items and code blocks). >30 = 2, 15-30 = 1, <15 = 0

---

## Quick Gate Checklist (for Quill and Prism)

Lightweight pass/fail checks run during writing and scoring. A post can pass all gates but still score poorly; gates catch the worst problems, scoring measures overall quality.

> **Note:** Gate numbering starts at 2 because Gate 1 (Specificity Audit) is defined in `writing-spec.md` section 4. These gates are the same checks — listed here with scoring thresholds for Prism, and in writing-spec.md as pass/fail checks for Quill.

### Gate 2: Puffery & Weasel Purge

- **AI trigger word scan**: Check against the 45-word + 14-phrase lists. If >2 per 1K words, rewrite. If >5 per 1K, heavy rewrite needed. Literal/technical usage is acceptable.
- **Passive voice estimate**: If >15% of sentences appear passive, rewrite to active voice.
- **Adverb density**: Count "-ly" adverbs (exclude "only", "early", "likely", "family", "daily", "apply", "supply"). If >4 per 1K words, flag for reduction.
- **Hedging phrases**: Zero tolerance for hedging phrases from writing-spec.md section 2G. Remove or rewrite directly.

### Gate 3: Cadence & Texture

- **Sentence burstiness**: Std dev of sentence word counts. If <4, flag "monotonous cadence".
- **Vocabulary diversity**: First 500 words unique/total ratio. If <0.55, flag "repetitive vocabulary".
- **Paragraph length variation**: Std dev of paragraph word counts. If <15, flag "uniform paragraphs".
- **Opening word diversity**: If any single word starts >20% of sentences, flag "repetitive openers".
- **Transition phrase diversity**: If any transition phrase appears 3+ times, flag "transition monotony". Unique-to-total ratio must be >0.5.
- **List-to-prose ratio**: List words should not exceed 40% of total (60% for listicle/roundup/faq intents).

---

## Scorecard Format

Prism must deliver scorecards in this format:

```
## Scorecard: [Article Title]
**Blog:** [codename]
**Intent:** [assigned intent]
**Total Score:** [X/100]
**Gate:** [PASS / FAIL]

### Breakdown
| Category | Points | Max | Notes |
|----------|--------|-----|-------|
| Content Quality | X | 30 | [specific notes] |
| SEO Optimisation | X | 20 | [specific notes] |
| E-E-A-T Signals | X | 15 | [specific notes] |
| AI Citation Readiness | X | 15 | [specific notes] |
| AI Detection Risk | X | 20 | [specific notes] |

### Voice Gate
[PASS / FAIL] - self-check list from writing-spec.md section 6

### Fix Instructions (if FAIL)
1. [Specific section] -- [what's wrong] -- [Recipe from writing-spec.md to apply]
2. ...
```

---

## Image Gate

Separate from the text score. Both the text gate (>= 80) and image gate must pass before presenting for approval.

| Requirement | Details |
|-------------|---------|
| Featured image | Present, relevant to content, matches blog visual style |
| Alt text | Descriptive, includes primary keyword naturally, GEO-aware |
| In-article images | At least 1 for articles over 2,000 words (optional under 2,000) |
