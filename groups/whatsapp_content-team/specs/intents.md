# Blog Post Intents

Reference file defining structural templates, tone adjustments, and quality checks for each blog post intent. Consumed by Quill (writer) and Prism (scorer).

## Valid Intents

`how-to`, `explainer`, `listicle`, `case-study`, `comparison`, `pillar-page`, `product-review`, `thought-leadership`, `roundup`, `tutorial`, `news-analysis`, `data-research`, `faq`

## Defaults

- **Word count**: 1,500–2,500 (unless overridden per intent)
- **Min H2s**: 3 (unless overridden per intent)

Every intent below specifies its own values explicitly for quick reference.

## Choosing Between Similar Intents

| If the post... | Use | Not |
|----------------|-----|-----|
| Teaches a single task with numbered steps, no code | `how-to` | `tutorial` |
| Walks through code with expected output at each stage | `tutorial` | `how-to` |
| Explains a concept in depth without steps to follow | `explainer` | `how-to` |
| Lists items with brief takes on each, picks a favourite | `listicle` | `roundup` |
| Lists items with comparison grid and "use X for Y" picks | `roundup` | `listicle` |
| Evaluates 2-3 options in depth with a single verdict | `comparison` | `roundup` |
| Surveys 5+ options broadly, mapping each to a use case | `roundup` | `comparison` |

## Cross-Intent Requirements

These apply to every intent unless explicitly exempted in the intent definition.

- **TL;DR section:** Every article must include a TL;DR. Place it after the intro, before the first main body H2. Exception: `faq` intent places TL;DR after the last Q/A pair, before the Summary.
- **FAQ section:** Every article should include a `## Frequently Asked Questions` section with 3+ H3 questions, placed before the final wrap-up/next-steps section. Exemptions: `pillar-page` (has FAQ built into its structure — do not duplicate) and `faq` (the entire article IS the FAQ).

## Structure Compliance

Structure templates below define the **expected H2 flow** -- the semantic progression, not exact heading text. A `how-to` can use `## Before You Start` instead of `## Prerequisites` as long as the content fulfils the role. Extra H2s beyond the template are allowed. The min H2 count is the hard requirement; the structure is a guide.

**Heading levels**: Unless noted otherwise, the structural segments map to H2 sections. Items within a listicle/roundup/faq are H2s (one per item/question), not H3s under a single parent H2. This ensures H2 counts align with scoring minimums.

---

### how-to: How-to Guide
**Description:** Step-by-step instructions to accomplish a specific task.
**Structure:** Intro -> TL;DR -> Prerequisites -> Step 1-N -> Troubleshooting/Common Mistakes -> FAQ
**Tone:** Instructional, direct, second-person ("you") is OK. Keep steps scannable.
**Words:** 1,700-2,500
**Min H2s:** 3
**Quality checks:**
- Has clear prerequisite list or "what you need" section
- Steps are numbered and sequential
- Each step has a concrete action (not just explanation)
- Includes at least one troubleshooting tip or common mistake

---

### explainer: Explainer
**Description:** Deep educational content that explains a concept, technology, or phenomenon.
**Structure:** Definition-style opening -> TL;DR -> Core explanation (2-4 sections) -> Practical implications -> FAQ
**Tone:** Authoritative, clear. First 2 sentences must directly answer "what is X".
**Words:** 1,500–2,500
**Min H2s:** 4
**Quality checks:**
- Opening 2 sentences directly answer the primary query (definition-style)
- Each section explains one facet of the concept with a concrete example
- Includes practical implications (why this matters, what changes)
- Avoids "textbook voice" -- uses real-world examples, not abstract descriptions

---

### listicle: Listicle
**Description:** Curated list of items (tools, tips, examples) with brief commentary on each.
**Structure:** Intro with selection criteria -> TL;DR -> Items 1-N as H2s (min 5) -> FAQ -> Wrap-up with recommendation
**Tone:** Conversational, opinionated. Each item gets a stance, not just a description.
**Words:** 1,500–2,500
**Min H2s:** 5
**Quality checks:**
- Has at least 5 list items, each as its own H2
- Each item has a concrete reason for inclusion (not just a feature list)
- Intro states the selection criteria or angle
- Wrap-up includes a specific recommendation or "start here" pick

---

### case-study: Case Study
**Description:** Analysis of a real scenario -- what happened, why, and what others can learn.
**Structure:** Background -> TL;DR -> Challenge -> Solution -> Results (measurable) -> Takeaways -> FAQ
**Tone:** Narrative, evidence-driven. Let the story carry the argument.
**Words:** 1,500–2,500
**Min H2s:** 4
**Quality checks:**
- Background establishes context without filler
- Challenge is specific (not generic "they needed to improve")
- Solution includes concrete implementation details
- Results section has at least one measurable outcome (number, percentage, timeline)
- Takeaways are actionable, not just "this was successful"

---

### comparison: Comparison
**Description:** Head-to-head evaluation of two or more options with a clear verdict.
**Structure:** Intro -> TL;DR -> Criteria definition -> Option A -> Option B -> Head-to-head -> Verdict -> FAQ
**Tone:** Balanced but decisive. State tradeoffs, then pick a winner (with caveats). If a genuine "it depends" scenario, the verdict must map specific use cases to specific winners -- never a vague "both are good."
**Words:** 1,500–2,500
**Min H2s:** 4
**Quality checks:**
- Criteria are defined before evaluation begins
- Each option is evaluated against the same criteria
- Head-to-head section directly compares (not just back-to-back descriptions)
- Verdict names a winner with reasoning and "pick the other if..." caveat

---

### pillar-page: Pillar Page
**Description:** Comprehensive overview of a broad topic with linkable subtopics.
**Structure:** Overview -> TL;DR -> 4-8 subtopics (each linkable as standalone) -> Frequently Asked Questions -> Next steps
**Tone:** Authoritative, structured. Each subtopic should work as a standalone summary.
**Words:** 3,000-5,000
**Min H2s:** 5
**Cross-intent FAQ note:** This intent already includes a FAQ section in its structure. The cross-intent `## Frequently Asked Questions` requirement is satisfied by this section -- do not create a duplicate.
**Quality checks:**
- Has 4-8 subtopic H2 sections
- Each subtopic could stand alone as a brief summary
- Includes internal links or "related reading" pointers where applicable
- FAQ section uses the heading `## Frequently Asked Questions` with 3+ H3 questions
- Next steps section points to specific actions or resources

---

### product-review: Product Review
**Description:** Hands-on evaluation of a product, tool, or service.
**Structure:** Overview -> TL;DR -> Setup/Getting Started -> Key Features -> Limitations -> Verdict -> FAQ
**Tone:** First-person experience. "I tested..." not "this product offers..."
**Words:** 1,000–2,000
**Min H2s:** 3
**Quality checks:**
- Overview states what the product does and who it's for
- Setup section describes actual onboarding experience
- Key features include at least one concrete usage example
- Limitations section is honest (not just "could be better")
- Verdict includes "use this if... / skip this if..." guidance

---

### thought-leadership: Thought Leadership
**Description:** Opinionated argument advancing a specific thesis or perspective.
**Structure:** Thesis -> TL;DR -> Arguments 1-3 (with evidence) -> Counterargument -> Call to action -> FAQ
**Tone:** Confident, first-person. Own every claim. "I think..." is fine.
**Words:** 1,000–2,000
**Min H2s:** 3
**Quality checks:**
- Thesis is stated clearly in the first 2-3 sentences
- Each argument has supporting evidence (not just assertion)
- Counterargument is addressed honestly (not straw-manned)
- Call to action is specific ("try X" or "stop doing Y"), not vague ("think about this")

---

### roundup: Roundup
**Description:** Curated collection with comparison notes and use-case-specific picks.
**Structure:** Intro with selection criteria -> TL;DR -> Items 1-N as H2s (min 5) -> Comparison notes -> Picks by use case -> FAQ
**Tone:** Practical, advisory. Focus on "which one for which situation."
**Words:** 1,500–2,500
**Min H2s:** 5
**Quality checks:**
- Has at least 5 items, each as its own H2
- Each item includes a differentiating detail (not just feature lists)
- Comparison notes highlight key differences between items
- "Picks by use case" section maps items to specific scenarios

---

### tutorial: Tutorial
**Description:** Guided walkthrough with code examples and expected output.
**Structure:** Intro -> TL;DR -> Prerequisites -> Step-by-step instructions -> Code examples -> Expected output -> Next steps -> FAQ
**Tone:** Patient, precise. Assume the reader is following along in real time.
**Words:** 1,800–3,000
**Min H2s:** 4
**Quality checks:**
- Prerequisites list specific versions, tools, or knowledge required
- Steps are numbered and sequential
- Code examples are complete and copy-pasteable (no pseudo-code)
- Expected output is shown for key steps
- Next steps suggest what to build or learn next

---

### news-analysis: News Analysis
**Description:** Breakdown of a recent event -- what happened, why it matters, what to expect.
**Structure:** What happened -> TL;DR -> Why it matters -> What it means (implications) -> What to watch -> FAQ
**Tone:** Informed, analytical. Separate facts from interpretation clearly.
**Words:** 800–1,500
**Min H2s:** 3
**Quality checks:**
- "What happened" is factual and specific (dates, names, numbers)
- "Why it matters" connects to the reader's context
- Implications are concrete (not "time will tell")
- "What to watch" includes specific signals or timelines

---

### data-research: Data & Research
**Description:** Analysis driven by data points, studies, or original research.
**Structure:** Key finding -> TL;DR -> Methodology -> Data points (cited) -> Implications -> Caveats -> FAQ
**Tone:** Evidence-first, precise. Lead with findings, not setup.
**Words:** 2,000–3,500
**Min H2s:** 3
**Quality checks:**
- Key finding is stated in the first 2 sentences
- Methodology is transparent (how data was gathered/analysed)
- Data points cite specific sources (no "studies show")
- Implications are grounded in the data (not speculation)
- Caveats section acknowledges limitations honestly

---

### faq: FAQ
**Description:** Question-and-answer format covering common queries on a topic.
**Structure:** Introduction -> Q/A pairs as H2s (min 5) -> TL;DR -> Summary/related resources
**Tone:** Direct, helpful. Each answer should be self-contained.
**Words:** 1,000–2,000
**Min H2s:** 5
**Cross-intent FAQ note:** This intent's entire body IS the FAQ. The cross-intent `## Frequently Asked Questions` requirement is **exempt** for this intent -- do not add a separate FAQ section inside a FAQ post. The TL;DR section should appear after the last Q/A pair, before the Summary.
**Quality checks:**
- Has at least 5 Q/A pairs, each as its own H2
- Questions are phrased as a real person would ask them
- Each answer is self-contained (doesn't rely on reading other answers)
- Answers include at least one concrete detail (not just general advice)
- Summary links to related resources or deeper reading

---

## Research Brief Format

Scout must deliver research briefs in this structure:

```
## Research Brief: [Topic]
**Target Blog:** [codename from blog-registry.md]
**Assigned Intent:** [from above]
**Date:** [date]
**Confidence:** [high/medium/low -- based on source quality and availability. Informational only: helps Quill and Prism calibrate expectations. Low confidence = flag to requester before writing.]

### Intent Compliance Notes
- Word count target: [min]-[max]
- Min H2s: [number]
- Required structural elements: [from intent definition]

### Target Queries
- Primary: [the main query this content should answer]
- Secondary: [2-3 related queries]
- AI prompt variants: [how someone might ask an AI about this]

### Competitor Analysis
| Rank | Article | Word Count | Intent Match | Key Strengths | Key Gaps |
|------|---------|------------|-------------|---------------|----------|

### Recommended Structure
[Suggested H1, H2s, H3s mapped to the intent template]

### Key Data Points to Include
1. [stat + source name + publication date + tier classification]
2. [stat + source name + publication date + tier classification]
...

### Internal Link Opportunities
[Based on recently published articles, suggest where internal links would fit]

### GEO Optimisation Opportunities
- [Structural recommendations for AI citation]
- [Gaps in competitor content that AI engines struggle to answer]

### Sources
[All sources used, classified by tier]
```
