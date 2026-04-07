# Content Team Wiki — Build Plan

## Purpose
The wiki stores what the Content Team *knows* — accumulated intelligence about audiences, niches, competitors, and editorial decisions that would otherwise be lost to context compaction. It supplements (not replaces) the operational files (CLAUDE.md, writing-spec.md, etc.).

## Top-Level Structure

### /sites/
One page per active site. Deep context beyond what's in blog-registry.md.
- `birthday-best.md` — niche depth, audience, brand positioning, what's worked
- `indoor-cycling-tips.md` — same
- `launch-point-golf.md` — same
- (one page per site as new ones come online)

### /audience/
Who actually reads each site — beyond surface demographics.
- `birthday-best-audience.md` — parents, gift-buyers, party planners; what they search, what they fear, what they want
- `indoor-cycling-audience.md` — fitness enthusiasts, home gym builders, Zwift users
- `launch-point-golf-audience.md` — golfers, skill levels, equipment considerations

### /competitors/
What we know about competing sites per niche.
- `birthday-best-competitors.md` — who ranks for our target keywords, what they do well, gaps we exploit
- `indoor-cycling-competitors.md` — same

### /niches/
Topic authority maps — what's been covered, what's missing, trending angles.
- `birthday-niche-map.md` — topic clusters, seasonal patterns, commercial intent opportunities
- `indoor-cycling-niche-map.md` — same
- `golf-niche-map.md` — same

### /authors/
Deep author persona files — beyond the brief in blog-registry.md.
- `tracey-pattinson.md` — who she is, her voice, her experience, how she thinks about birthdays
- `adam-johnson.md` — same for cycling

### /editorial/
Key decisions and their rationale — the "why" behind choices.
- `platform-decisions.md` — why Ghost, why DigitalOcean, etc.
- `content-strategy.md` — GEO approach, AEO rationale, why we structure content as we do
- `monetisation-strategy.md` — affiliate approach, product card philosophy, email list strategy

### /learnings/
Patterns discovered from production — what the self-reviews and changelogs tell us.
- `what-works.md` — content formats, structures, approaches that consistently score well
- `common-mistakes.md` — patterns that get caught by Prism, voice issues, recurring problems

---

## Phase 1 — Seed from existing files (Week 1)
Build initial wiki pages from knowledge already in the workspace:
1. `birthday-best.md` — seed from blog-registry.md + changelog entries
2. `indoor-cycling-tips.md` — same
3. `tracey-pattinson.md` — seed from author_tracey_pattinson.md memory file
4. `adam-johnson.md` — seed from blog-registry.md
5. `content-strategy.md` — seed from geo-strategy.md + writing-spec.md rationale
6. `what-works.md` — seed from high-scoring articles in changelog (98/100, 99/100, 100/100 entries)

## Phase 2 — Research-led build (Week 2+)
Scout runs dedicated research sessions to populate:
- Competitor pages per niche
- Audience deep-dives
- Niche topic maps

## Phase 3 — Ongoing ingestion
Any source Adam or Raels drops in gets ingested and cross-referenced into the wiki automatically.
