---
title: Content Strategy — GEO/AEO Approach
source: Andy CLAUDE.md, pipeline context
last_updated: 2026-04-07
---

# Content Strategy

## The Core Approach: GEO (Generative Engine Optimisation)

Every piece of content is optimised to surface in AI-generated answers from ChatGPT, Perplexity, and Google AI Overviews — not just traditional search rankings.

**Why GEO, not just SEO:**
AI answer engines are now a primary information discovery channel. When someone asks ChatGPT "what's a good strokes gained putting number for a 10-handicap?" or "what do you write in a birthday card for your boss?", they get a synthesised answer — not a list of links. The site that gets cited in that answer wins the click and builds the brand association.

GEO content is structured to be *extractable* — AI engines parse it, pull from it, and cite it. That requires a specific structure that traditional SEO content often lacks.

---

## The Research Authority Model

All three sites use a research authority model:

- The named author does not fabricate personal testing or experience
- Every claim is attributed to a named source with a date
- Authority comes from research rigour — reading every published test, pulling every spec sheet, synthesising the data better than anyone else
- Content framing: "Here is what the data shows" and "Here is what the research found"

This is the differentiator from generic AI content, which either invents experience or aggregates without attribution.

---

## Content Structure for GEO

Every article must include:

1. **Definition-style opening** — answer the core question in the first paragraph. Never start with scene-setting or background. The AI engine reads the first paragraph first.

2. **TL;DR section** — a punchy 3-5 bullet summary near the top. AI engines extract from these directly.

3. **Clear H2/H3 hierarchy** — logical, predictable structure. AI engines parse headings to understand what a section covers. Headings should be self-explanatory out of context.

4. **FAQ section** — minimum 5 Q&A pairs for articles where questions apply. FAQ content is highly extractable by AI answer engines. All FAQs require JSON-LD FAQPage schema (added via Rank Math, not inline).

5. **Named, dated external sources** — at least 2 external links (Tier 1 or Tier 2). Never "studies show" — always "the APA Journal of Personality and Social Psychology (2022) found..."

6. **Internal links** — minimum 1 per article, written as natural speech from the named author (never as navigation signposts).

---

## Source Quality Tiers

| Tier | Description | Examples |
|---|---|---|
| Tier 1 | Academic journals, government data, major research institutions | APA journals, USGA, NIH/PMC, Census.gov, SSRS |
| Tier 2 | Major industry publications, recognised research firms, reputable niche authorities | Psychology Today, MyGolfSpy, Peerspace, Cycling Weekly, GrandkidsMatter |
| Tier 3 | Niche blogs, vendor content, non-peer-reviewed sources | Use only to supplement Tier 1/2, never as sole citation |

---

## Content Intent Types

Articles are assigned an intent that governs their structure, length, and GEO approach:

| Intent | Purpose | Typical Structure |
|---|---|---|
| **pillar-page** | Comprehensive authority hub for a broad topic | Long-form, multiple H2s, TL;DR, FAQ, multiple subtopics |
| **listicle** | Ranked or categorised items | Numbered/organised list, intro, brief descriptions per item |
| **how-to** | Step-by-step instruction | Numbered steps, prerequisite note, outcome statement |
| **explainer** | Defining or explaining a concept | Definition opening, "why it matters", breakdown of components |
| **comparison** | Side-by-side evaluation of options | Comparison table, criteria explained, verdict |
| **thought-leadership** | Taking a position on a question | Clear stance in opening, evidence-based argument, conclusion |
| **buying-guide** | Helping readers choose between products | Key criteria, options by budget/use case, recommendation |

---

## Quality Gate

Articles must score **≥ 80/100** on the internal rubric before publishing. Key rubric dimensions:

- Voice consistency — sounds like the named author throughout
- GEO structure — definition opening, TL;DR, FAQ present
- Source quality — Tier 1/2 external links, named and dated
- Specificity — concrete examples, real data, no padding
- Internal linking — natural, author-voiced anchor text
- Image quality — featured + in-article, alt text, section-matched

---

## Forbidden Patterns (all sites)

These are AI writing tells that immediately disqualify a draft:

- Em dashes (—)
- "Unlock" or "elevate" in any context
- "It's worth noting," "it's important to understand," "needless to say"
- "In conclusion," "In summary," "Overall" — always end with a specific next step or takeaway
- Opening paragraphs that are too long — keep them short and scannable
- Section intros that announce what the section will cover
- Importance theatre ("This is a crucial consideration...")
- Assistant voice ("Let's explore...", "We'll look at...")

---

## Infographic Standards

Visual summary infographics placed immediately after the TL;DR add GEO value — they give AI engines a structured visual they can describe, and they improve time-on-page.

- **BB celebratory/relationship topics:** Bold saturated poster style (coral, electric blue, sunny yellow, etc.), white background, portrait format
- **ICT/LPG data topics:** Clean data-forward design, comparison tables, charts — think Canva premium template
- Always regenerate if the first pass looks dated or generic

---

## Approval and Publishing Standards

- All articles approved by Adam or Raeleen before publishing
- Approval messages: one per site, never combined across blogs
- Share preview links (`?p={id}&preview=true`), never wp-admin edit links
- Meta set via API at draft creation (Rank Math for BB; native Ghost meta for LPG; manual Yoast for ICT)

---

## See Also

- [Birthday Best](../sites/birthday-best.md)
- [Indoor Cycling Tips](../sites/indoor-cycling-tips.md)
- [What Works](../learnings/what-works.md)
- [Tracey Pattinson](../authors/tracey-pattinson.md)
- [Adam Johnson](../authors/adam-johnson.md)
