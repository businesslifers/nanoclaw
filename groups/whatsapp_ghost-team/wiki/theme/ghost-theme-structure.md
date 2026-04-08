---
title: Ghost Theme Structure (Official)
tags: [theme, handlebars, structure, templates]
updated: 2026-04-08
source: https://docs.ghost.org/themes/structure
---

# Ghost Theme Structure

Official documentation reference for Ghost Handlebars theme structure. For our specific theme conventions, see [Component Library](component-library.md).

## Required File Structure

```
.
├── /assets
│   ├── /css
│   │   └── screen.css
│   ├── /fonts
│   ├── /images
│   └── /js
├── /partials          (optional but recommended)
│   └── list-post.hbs
├── default.hbs        (recommended base layout)
├── index.hbs          ← REQUIRED
├── post.hbs           ← REQUIRED
└── package.json       ← REQUIRED
```

## Required Helpers

Every Ghost theme must include these helpers to function:

| Helper | Purpose |
|--------|---------|
| `{{asset}}` | Reference theme assets (CSS, JS, images) |
| `{{body_class}}` | CSS class for the body element |
| `{{post_class}}` | CSS class for the post element |
| `{{ghost_head}}` | Ghost meta tags, styles, scripts (in `<head>`) |
| `{{ghost_foot}}` | Ghost scripts (before `</body>`) |

## Template Hierarchy

### `default.hbs` (recommended base)

Base layout containing `<html>`, `<head>`, `<body>`, plus `{{ghost_head}}`, `{{ghost_foot}}`, and shared header/footer HTML. All other templates typically extend this with `{{!< default}}`.

### `index.hbs` ← REQUIRED

Standard template for the post listing (homepage, tag archives, author archives if no specific template exists). Uses `{{#foreach posts}}` to iterate.

### `home.hbs` (optional)

If present, used exclusively for `/` (the homepage). Allows a different layout from the index feed.

### `post.hbs` ← REQUIRED

Template for individual posts. **Must** use `{{#post}}...{{/post}}` wrapper — without it, all helpers silently return `undefined`.

### `page.hbs` (optional)

Template for static pages. Falls back to `post.hbs` if not present. **Must** use `{{#page}}...{{/page}}` wrapper.

### `custom-{template-name}.hbs` (optional)

Custom templates selectable per-post in Ghost Admin. Can be used for both posts and pages.

### `tag.hbs` (optional)

Archive template for tag pages. Falls back to `index.hbs` if not present. Individual tag templates: `tag-{slug}.hbs`.

### `author.hbs` (optional)

Archive template for author pages. Falls back to `index.hbs`. Individual author templates: `author-{slug}.hbs`.

### `error.hbs` (optional)

Renders 404 and 500 errors. Ghost uses its own default if absent.

- `error-4xx.hbs` — all 400-level errors
- `error-404.hbs` — specific to 404 (highest priority)

### `robots.txt` (optional)

Overrides Ghost's default robots.txt.

## Contexts

Each URL maps to a **context** that determines the template, data available, and `{{body_class}}` output:

| URL pattern | Context | Template |
|------------|---------|---------|
| `/` | `home`, `index` | `home.hbs` → `index.hbs` |
| `/{slug}/` | `post` | `post.hbs` |
| `/tag/{slug}/` | `tag` | `tag.hbs` → `index.hbs` |
| `/author/{slug}/` | `author` | `author.hbs` → `index.hbs` |

## package.json

Required configuration file for the theme:

```json
{
  "name": "businesslifers-theme",
  "description": "Ghost Team theme",
  "version": "1.0.0",
  "license": "MIT",
  "author": {
    "email": "ghostteam@businesslifers.com"
  },
  "config": {
    "posts_per_page": 10,
    "image_sizes": {
      "xs": {"width": 150},
      "s": {"width": 300},
      "m": {"width": 600},
      "l": {"width": 1000},
      "xl": {"width": 2000}
    },
    "card_assets": true
  }
}
```

Key config properties:
- `posts_per_page` — default 5, override here
- `image_sizes` — up to 10 sizes; Ghost auto-generates responsive copies
- `card_assets` — include Ghost's card CSS/JS (required for editor cards to render)
- `custom` — custom settings (see [Ghost Custom Settings](ghost-custom-settings.md))

**Changes to package.json require `ghost restart`.**

## Development Notes

- In production, HBS templates are cached — `ghost restart` needed to see template changes
- In development (local install), templates reload automatically
- Ghost checks for fatal errors when a theme is uploaded in Admin; use GScan for full validation during development

## Critical Pitfalls (from experience)

- Never name a partial the same as a Ghost built-in helper (`navigation`, `pagination`, `ghost_head`, `ghost_foot`, `body_class`, `post_class`) — causes infinite recursion stack overflow
- `{{#post}}...{{/post}}` is required in post.hbs — without it, all data helpers return `undefined` silently
- `{{navigation}}` renders its own `<ul class="nav">` — wrap in `<nav>` or `<div>`, never `<ul>`

## Related Pages

- [Component Library](component-library.md) — our specific theme file structure and conventions
- [Ghost Editor Cards](ghost-editor-cards.md) — kg-* CSS classes for editor content
- [Ghost Routing](ghost-routing.md) — routes.yaml for custom URL structures
- [Ghost Custom Settings](ghost-custom-settings.md) — package.json custom settings API
- [Deployment Workflow](deployment-workflow.md)
