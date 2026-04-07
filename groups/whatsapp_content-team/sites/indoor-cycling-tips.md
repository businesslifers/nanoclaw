# INDOOR-CYCLING-TIPS — Site Specification

- **Codename:** INDOOR-CYCLING-TIPS
- **Domain:** indoorcyclingtips.com
- **Platform:** WordPress
- **Theme:** Acabado by Income School
- **Niche:** Indoor cycling, spin classes, home fitness cycling, training apps, and exercise bikes
- **Target Audience:** Home cyclists and gym-goers interested in indoor cycling. Ages 25-55. Mix of beginners and committed cyclists. Tier 1 markets: US, UK, Australia, Canada. Tier 2 high-value markets: New Zealand, Germany, Netherlands, Nordics (Sweden/Norway/Denmark/Finland). Do not target broad/global audiences beyond these — this attracts bot and low-quality traffic.
- **Revenue Model:** TBD
- **Site Positioning:** Practical, evidence-based indoor cycling content written by a real cyclist — not a fitness influencer. Adam Johnson doesn't over-promise. If something is hard, he says it's hard.

---

## Named Author — Adam Johnson

- **WP User ID:** 1
- **Background:** Middle-aged cyclist (40s), former triathlete, flat bar and retro bike enthusiast. Regular person, not a fitness influencer. Honest about the grind. Has real cycling experience and cites research — doesn't claim to be an elite athlete.

### Voice and Tone Rules (strictly enforced — Mindy must apply these)

1. Practical, evidence-based, slightly self-deprecating.
2. Adam doesn't over-promise. He cites research, shares what works for him, and acknowledges what doesn't.
3. Not aspirational fitness copy — grounded, useful, direct. No hype.
4. If something is hard, say it's hard. If results take time, say they take time.
5. Evidence-grounded: cite published research and real data. Never fabricate statistics.
6. No "unlock your potential," "transform your body," "take your fitness to the next level," or similar aspiration copy.
7. Reads like advice from a knowledgeable training partner, not a fitness marketing campaign.

### Adam's Perspective (Quill must write consistently with these)

- Indoor cycling is genuinely good for fitness but requires consistency — not magic
- App-based training (Zwift, TrainerRoad) has changed what's possible for home cyclists
- The best equipment is the one you'll actually use — don't over-spec for your current fitness level
- Data and structured training matter, but so does enjoyment — boring training doesn't stick

---

## Content Pillars

| Pillar | Purpose |
|---|---|
| Training and Technique | Core expertise content |
| Equipment and Bikes | Product-driven, affiliate opportunity |
| Apps and Software | High-interest, fast-changing |
| Health and Fitness Benefits | GEO priority, high search volume |
| Nutrition | Audience broadening |
| Getting Started | Beginner funnel |

---

## Editorial Standards (ICT-specific additions to universal pipeline rules)

- **Research citations required:** Adam cites research — every health/fitness claim must be backed by a named source with date. No "studies show."
- **Personal experience framing:** Where Adam has personal experience (training, equipment, apps), write from that perspective. Where he doesn't, attribute clearly to published sources or community reports.
- **App and product reviews:** Note whether features or pricing have changed since the article was last updated — this space moves fast. Scout should flag publication date on all sources.
- **Canva API integration:** Pending (for infographic generation). Use Nano Banana 2 for diagrams and data infographics in the meantime.

---

## Categories and Tags

- **Primary Categories:** Training and Technique, Equipment and Bikes, Apps and Software, Health and Fitness Benefits, Nutrition, Getting Started
- **Tags Convention:** Lowercase, descriptive: "indoor-cycling", "spin-class", "zwift", "exercise-bikes"

---

## Visual Style

Clean, modern fitness photography. Real gym and home gym settings. No cheesy stock imagery. Performance infographics welcome (calorie charts, muscle diagrams, training zone visuals). Nano Banana 2 for diagrams and data infographics. Pexels for photography.

---

## Competing Sites

Cycling Weekly, TrainerRoad Blog, Zwift Insider, DC Rainmaker, Bicycling Magazine

---

## GEO Priority Topics

Indoor cycling health benefits, calorie burn by weight/intensity, muscle activation diagrams, app comparisons (Zwift vs alternatives), exercise bike buying guides, training plans for beginners

---

## Technical Notes

- WordPress REST API credentials in `/workspace/extra/wordpress-creds/wp-sites.json`
- SEO plugin: Yoast SEO — meta fields NOT exposed via REST API; manual entry required in WP editor after each publish
- Named author must be set on every post: WP User ID 1 (Adam Johnson)
- Theme: Acabado by Income School
