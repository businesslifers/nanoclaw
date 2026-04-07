---
title: Theme Component Library
tags: [theme, components, ghost, handlebars]
updated: 2026-04-07
---

# Theme Component Library

The businesslifers-theme is a single shared Ghost theme deployed across all Lifers content sites. It follows a **Medium-style, content-first, editorial** design philosophy — clean, fast, no heavy frameworks.

## Design Principles

- **Content-first:** Maximum 680px content width, generous line-height (1.8), readable serif body font in posts
- **Fast:** No npm dependencies, no jQuery, no build step — vanilla CSS and JS only
- **Editorial:** Affiliate/product cards look editorial, never like display ads
- **Mobile-first:** All components designed at 375px first, enhanced at wider breakpoints
- **Accessible:** WCAG AA required — all text/background colour pairs must meet 4.5:1 contrast ratio (3:1 for large text ≥18px or ≥14px bold)

## File Structure

```
ghost-theme/
  default.hbs              ← base layout (header, footer, ghost_head, ghost_foot)
  index.hbs                ← blog listing / homepage
  post.hbs                 ← individual article
  tag.hbs                  ← category/topic pages
  author.hbs               ← author archive
  page.hbs                 ← generic static page
  404.hbs                  ← error page
  error.hbs                ← Ghost error page
  custom-category-guide.hbs  ← affiliate listicle template
  custom-partner-feature.hbs ← partner/sponsored feature template
  partials/
    site-header.hbs        ← site header + nav
    footer.hbs             ← site footer
    sidenav.hbs            ← persistent left sidebar (currently inactive)
    breadcrumb.hbs         ← breadcrumb nav + BreadcrumbList JSON-LD
    affiliate-card.hbs     ← reusable affiliate/product card
    digital-product.hbs    ← own product promo block
    email-capture.hbs      ← inline newsletter signup
    author-bio.hbs         ← post author bio block
  assets/
    css/screen.css         ← all styles (single file, no preprocessor)
    js/main.js             ← minimal vanilla JS
    images/                ← theme images (logos, placeholders)
  scripts/
    deploy.js              ← deployment script (SSH git pull + ghost restart)
```

## CSS Architecture

- Single `screen.css` — no preprocessors, no build step
- CSS custom properties (variables) for all colours, fonts, spacing — defined in `:root`
- **Never hardcode hex values in CSS** — always use variables
- Class naming: BEM-style, hyphenated (e.g. `.feed-item-title`)
- No external font imports — system font stack only

### Core CSS variables

```css
:root {
  --color-text: /* darkest — headlines, body */
  --color-text-secondary: /* secondary copy */
  --color-meta: /* tags, reading time, author */
  --color-accent: /* links, buttons, CTAs */
  --color-border: /* dividers, table lines */
  --color-bg: /* page background */
  --color-white: #ffffff;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-serif: Georgia, "Times New Roman", serif;
}
```

Per-site colour overrides go in Ghost Admin → Code Injection → Site Header. See `SITE_COLOURS.md` for the template.

## Component Reference

### Tier 1 — Present in every article

#### TL;DR Block
- **Ghost native:** Koenig Callout card with specific emoji/colour
- **Authors:** Insert → Callout card, select TL;DR colour/emoji
- **CSS target:** `.kg-callout-card` with TL;DR colour variant
- **Placement:** Immediately after intro paragraph, before any infographic

#### FAQ Block
- **Ghost native:** H3 headings as questions, paragraphs as answers; HTML card wraps FAQ section
- **Authors:** Write H3 questions and paragraph answers. Wrap FAQ section in HTML card: `<div class="faq-section">`
- **Schema:** `FAQPage` JSON-LD injected automatically via `post.hbs`
- **Rule:** Answers must be fully visible (no accordion) — required for Google and AI crawlers
- **CSS target:** `.post-content h3 + p` within `.faq-section`

#### Responsive Data Table
- **Ghost native:** Standard table in Koenig
- **CSS target:** `.gh-content table`
- Bordered cells, bold grey `<thead>`, zebra-striped rows, horizontally scrollable on mobile

#### Author Bio
- **Ghost partial:** `{{> author-bio}}`
- Fields: photo, name, credential paragraph, link to author archive
- Data source: Ghost author profile (`{{#foreach authors}}`)
- Desktop: photo left, text right. Mobile: stacked
- E-E-A-T load-bearing — must feel credible and editorial

#### Email Capture
- **Ghost partial:** `{{> email-capture}}`
- Placement: mid-article (after TL;DR) AND end of article
- Uses `{{@site.title}}` and `{{@site.description}}` for per-site copy
- Style: single-input row, accent-coloured CTA button

### Tier 2 — Most articles

#### Affiliate / Product Card
- **Ghost native:** Koenig Product card
- **Authors:** Insert → Product card — fill image, name, descriptor, star rating, price, CTA button
- "Best for [use case]" uses the button text field
- **CSS target:** `.kg-product-card`
- Style: editorial feel — left accent border, NOT a banner ad

#### Callout Blocks (Tip / Note / Warning)
- **Ghost native:** Koenig Callout card with emoji/colour combos
- Tip: 💡 green tint (`.kg-callout-card-green`)
- Note: 📝 blue tint (`.kg-callout-card-blue`)
- Warning: ⚠️ amber tint (`.kg-callout-card-yellow`)
- Authors select the colour when inserting the card

#### Comparison Table
- **HTML card** with a structured table template
- Provide authors with a copy-paste HTML snippet
- Structure: criteria rows, 2–4 option columns, verdict row (accent background)
- **CSS target:** `.comparison-table`

### Tier 3 — Specific article types

#### Pillar Page Anchor Nav
- Auto-generated from H2s in the post
- Injected via `post.hbs` when post has tag `pillar-page`
- Sticky sidebar on desktop, inline block on mobile
- **CSS target:** `.pillar-toc`

#### Roundup Picks Summary Grid
- **HTML card** with copy-paste snippet
- Maps each product to a use case with a one-line reason
- **CSS target:** `.picks-grid`

### Custom Page Components (Category Guide + Partner Feature)

#### Guide Card
Used in Category Guide and Partner Feature "more picks" grids:
- **CSS target:** `.guide-card`
- Image, title, excerpt, price, CTA button
- Grid: 3-up at wide/full width (breaks out of content column)

#### Product Highlight Box
Used in Partner Feature template:
- **CSS target:** `.product-highlight-box`
- Featured product with full-bleed hero image above

#### Guide Disclosure Footer
On Category Guide pages:
- `<div class="guide-disclosure-footer">` at bottom of page
- Standard wording: "A note on our picks..."

#### Partner Disclosure
On Partner Feature pages:
- `<div class="partner-disclosure">` after article content
- Standard wording: "A note on this feature..."

## Breadcrumbs

Every post page includes a `breadcrumb` partial and `BreadcrumbList` JSON-LD:

```handlebars
{{> breadcrumb}}
```

Structure: Home › Primary Tag › Post Title

Custom templates include breadcrumbs too — placed inside the article header.

## Sidenav Suppression (Custom Templates)

Custom page templates (`custom-*.hbs`) suppress the sidenav via an inline `<style>` block as the first element. This is **intentional and exempted** from the "no inline styles" Inspector rule:

```html
<style>#site-sidenav,.site-sidenav{display:none!important}.site-layout{display:block!important}</style>
```

## Post Layout Order

Per spec:
1. Title (H1)
2. Meta (reading time, author, date, tags)
3. Feature image
4. Content

H1 must always appear above the hero image (Medium style). Never put the feature image before the title.

## Ghost Native Cards in Use

| Card | Usage | CSS target |
|------|-------|-----------|
| Callout | TL;DR, Tip, Note, Warning | `.kg-callout-card` |
| Product | Affiliate/product cards | `.kg-product-card` |
| Table | Data tables | `.gh-content table` |
| HTML | Comparison tables, FAQ wrappers | N/A |
| Image | Feature images, infographics | `.kg-image-card` |

## Handlebars Conventions

```handlebars
{{img_url feature_image size="m"}}   ← responsive images (never raw feature_image)
{{excerpt words="30"}}               ← feed excerpts
{{reading_time}}                     ← post meta
{{#unless @member}}...{{/unless}}    ← member/subscription gating
{{!< default}}                       ← required at top of every page template
```

## Related Pages

- [Deployment Workflow](deployment-workflow.md)
- [LaunchPoint Golf Site](../sites/launch-point-golf.md)
- [Ghost CMS Overview](../platform/ghost-overview.md)
- [Common Issues](../troubleshooting/common-issues.md)
