---
title: Ghost Custom Settings
tags: [theme, package.json, custom-settings, handlebars]
updated: 2026-04-08
source: https://docs.ghost.org/themes/custom-settings
---

# Ghost Custom Settings

Custom theme settings let theme developers expose configuration options in Ghost Admin, allowing site owners to make stylistic choices without editing theme files.

## Overview

Custom settings are defined in `package.json` under `config.custom`. Once defined, they appear in Ghost Admin → Design → Site design.

Maximum: **20 custom settings per theme**.

```json
{
  "config": {
    "custom": {
      "typography": {
        "type": "select",
        "options": ["Modern sans-serif", "Elegant serif"],
        "default": "Modern sans-serif"
      },
      "cta_text": {
        "type": "text",
        "default": "Sign up for more like this",
        "group": "post"
      }
    }
  }
}
```

## Accessing Settings in Templates

Custom settings are available via the `@custom` object:

```handlebars
<body class="{{body_class}} {{#match @custom.typography "Elegant serif"}}font-alt{{/match}}">

<section class="footer-cta">
  {{#if @custom.cta_text}}<h2>{{@custom.cta_text}}</h2>{{/if}}
  <a href="#portal/signup">Sign up now</a>
</section>
```

Setting keys are displayed in Ghost Admin in title case (`cta_text` → "CTA Text") and accessed in templates as `@custom.cta_text`.

## Setting Types

### Select

Dropdown menu. User picks one option.

```json
{
  "typography": {
    "type": "select",
    "options": ["Modern sans-serif", "Elegant serif", "Classic serif"],
    "default": "Modern sans-serif"
  }
}
```

Use `{{#match @custom.typography "Elegant serif"}}` to conditionally apply classes.

### Boolean

Toggle (on/off).

```json
{
  "show_social_links": {
    "type": "boolean",
    "default": true
  }
}
```

Use `{{#if @custom.show_social_links}}` in templates.

### Color

Colour picker. Returns a hex value.

```json
{
  "header_color": {
    "type": "color",
    "default": "#15171a"
  }
}
```

```handlebars
<style>
  .site-header { background-color: {{@custom.header_color}}; }
</style>
```

### Image

Image uploader. Returns an image URL.

```json
{
  "hero_image": {
    "type": "image"
  }
}
```

```handlebars
{{#if @custom.hero_image}}
  <img src="{{@custom.hero_image}}">
{{/if}}
```

### Text

Free text input.

```json
{
  "footer_text": {
    "type": "text",
    "default": "© 2024 My Site"
  }
}
```

## Setting Groups

Groups control which tab in Ghost Admin the setting appears under:

```json
{
  "cta_text": {
    "type": "text",
    "group": "post"
  }
}
```

Available groups: `site`, `homepage`, `post` (default: `site`).

## Setting Description

```json
{
  "cta_text": {
    "type": "text",
    "description": "Displayed in large CTA on homepage and sidebar on posts",
    "default": "Sign up for more"
  }
}
```

## Visibility

Settings can be conditionally shown based on other settings:

```json
{
  "accent_color": {
    "type": "color",
    "visibility": "show_branding:true"
  }
}
```

## Custom Fonts

Custom settings support a special workflow for fonts:

```json
{
  "title_font": {
    "type": "select",
    "options": ["System font", "Playfair Display", "Space Grotesk"],
    "default": "System font"
  }
}
```

Ghost loads Google Fonts automatically when a font is selected. In the template:

```handlebars
<style>
  :root {
    {{#match @custom.title_font "Playfair Display"}}
    --font-heading: 'Playfair Display', Georgia, serif;
    {{/match}}
  }
</style>
```

## Usage Guidelines

Custom settings work best when they have a **very clear visual impact** (toggle dark/light mode, change font, swap colour scheme). Avoid settings that require technical knowledge to use. Settings should complement the theme's primary purpose, not add generic configurability.

## Applying Changes

Changes to `package.json` (including custom settings definitions) require:
```bash
su - ghost-user -c 'ghost restart --dir /var/www/launchpointgolf'
```

Or re-upload the theme in Ghost Admin (the theme will be re-validated by GScan).

## Related Pages

- [Ghost Theme Structure](ghost-theme-structure.md)
- [Component Library](component-library.md)
