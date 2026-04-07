# BIRTHDAY-BEST — Site Specification

- **Codename:** BIRTHDAY-BEST
- **Domain:** thebirthdaybest.com
- **Platform:** WordPress
- **Niche:** Birthday party planning, gifts, celebration ideas, birthday wishes and messages
- **Target Audience:** Parents and adults planning birthday celebrations — for themselves, their children, partners, friends, and family. Tier 1 markets: US, UK, Australia, Canada. Tier 2 high-value markets: New Zealand, Germany, Netherlands, Nordics (Sweden/Norway/Denmark/Finland). Do not target broad/global audiences beyond these — this attracts bot and low-quality traffic. Primary age 25-50. Both AUD and USD pricing required. Metric and imperial measurements.
- **Revenue Model:** TBD
- **Site Positioning:** The go-to resource for birthday celebration ideas, wishes, and gifts across every relationship type and milestone age. Tracey Pattinson writes as a thorough researcher and relatable mum — she doesn't claim to have personally tried every idea, but she's done the research so her readers don't have to. Same research-authority model as LAUNCHPOINT-GOLF: every recommendation is backed by a source, not invented personal experience.

---

## Named Author — Tracey Pattinson

- **WP User ID:** 5
- **Background:** Mum of three. Interested in other languages and cultures. A thorough researcher — Tracey doesn't claim to have personally tried every party idea or gift she writes about, but she researches everything carefully before recommending it. Her authority comes from rigour and relatability, not professional credentials.

### Voice and Tone Rules (strictly enforced — Mindy must apply these)

1. Warm, practical, personal. Conversational — never keyword-stuffed or AI-ish.
2. Tracey shares genuine opinions and personal anecdotes. Self-deprecating where appropriate.
3. Not a professional party planner. A relatable mum who has figured things out the hard way.
4. Voice test: would Tracey actually say this out loud to a friend? If not, rewrite it.
5. Reads like a text message from a knowledgeable friend, not a listicle factory.
6. No corporate speak, no importance theatre, no assistant voice. Never start a section by announcing what the section will cover.
7. No "In conclusion," "In summary," or "Overall." End with a next step, caveat, specific takeaway, or question.
8. Australian English spelling throughout.

### Tracey's Perspective (Quill must write consistently with these)

- Birthday celebrations matter — not just for kids, but for adults who often deprioritise their own milestones
- The best party ideas are the ones that actually work in real life, not just on Instagram
- Personalisation beats spending. A thoughtful $30 gift beats a generic $100 one.
- International audience: Tracey is aware her readers are in the US, UK, Australia, and beyond — she references both AUD and USD prices, metric and imperial measurements

---

## Content Pillars

| Pillar | Purpose |
|---|---|
| Birthday Party Ideas (by age and milestone) | Core traffic driver |
| Birthday Wishes and Messages (by relationship) | High-volume search, long-tail |
| Birthday Gift Ideas (by relationship and budget) | Affiliate opportunity |
| Birthday Activities and Experiences | Engagement and differentiation |
| What to Write in a Birthday Card | GEO priority |

---

## Editorial Standards (BB-specific additions to universal pipeline rules)

- **Both AUD and USD pricing** required on any gift or product recommendation.
- **Both metric and imperial** measurements where relevant.
- **Age-matched images:** Never use children's party imagery in adult birthday content and vice versa. Images must match the demographic of the article's intended reader.
- **Infographic style for celebratory/relationship topics:** Bold saturated accent colours per section (coral, electric blue, sunny yellow, hot pink, lime green, lavender, orange, teal), white background, bold display font for title, portrait A4/letter format, site domain in footer. Approved by Adam Apr 3 2026 as high-impact and share-worthy. Apply proactively — do not submit a muted first draft.
- **Image placement:** First in-article image must appear in the upper third of the article. Infographics that summarise article content go immediately after the TL;DR.
- **Images must match sections:** In-article images must visually match the specific section they illustrate — not generic celebration photos as placeholders for sections with a distinct subject.
- **Longer listicles (10+ items):** Include 2 in-article photos — one in the upper third, one in the lower third.
- **Internal links must sound like Tracey talking:** Never "for more information, see..." or "this guide covers..." — rewrite any anchor text that sounds like a content editor.
- **Named brands in product/listicle articles** should be hyperlinked to their primary URL.
- **Consolidation workflow:** When merging satellite posts into hub articles, do not execute 301 redirects until explicit approval is given. Create the hub, publish it, then await redirect approval separately.

---

## Categories and Tags

- **Primary Categories:** Birthday Party Ideas, Milestone Birthdays (13th, 16th, 18th, 21st, 30th, 40th, 50th, 60th), Birthday Gifts, Birthday Wishes and Messages, Birthday Activities
- **Tags Convention:** Lowercase, descriptive: "birthday-party-ideas", "gift-ideas", "milestone-birthdays"

---

## Visual Style

Warm, vibrant, celebratory. Contemporary photography — no dated aesthetics, retro colour grading, or low-production-quality images. Pexels preferred (no attribution required). Nano Banana 2 for infographics and printables. Infographic design must look modern and well-designed — clean layout, contemporary type, deliberate colour choices. No muddy, brown, or drab tones. Think Canva premium template. Regenerate if the first pass looks dated or generic.

---

## Competing Sites

Shutterfly Blog, The Knot, Evite Blog, CountdowntoFun, TodaysMama

---

## GEO Priority Topics

"How to say happy birthday in [language]", birthday party ideas for [age/milestone], what to write in a birthday card, surprise party planning, gift ideas by relationship type

---

## Technical Notes

- WordPress REST API credentials in `/workspace/extra/wordpress-creds/wp-sites.json`
- SEO plugin: Rank Math — meta fields (`rank_math_title`, `rank_math_description`) are settable via REST API at draft creation. No manual admin entry required.
- Redirects: Redirection plugin — use REST API at `/wp-json/redirection/v1/redirect` (requires `group_id` field, fetch from `/wp-json/redirection/v1/group` first)
- Named author must be set on every post: WP User ID 5 (Tracey Pattinson)
- 301 redirect map for 16 pre-pipeline deleted posts in `birthday-best-audit.md` — still requires manual SmartCrawl entry (pre-dates Redirection plugin install)
- Backlog: ~371 articles still have "of 2022" in titles — many need full rewrites, not just title changes. Priority: high-traffic posts first.
